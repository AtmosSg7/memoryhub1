"""
Core AI credit engine.

All credit mutations flow through this module.
Buckets:
  - monthlyCreditsRemaining  → expires each billing period
  - permanentCreditsRemaining → purchased / bonus / admin / refunds — never expire

Consumption priority: monthly first, then permanent.
"""

from __future__ import annotations

import os
import uuid
from calendar import monthrange
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from credit_constants import COLLECTION_ACCOUNTS, COLLECTION_TRANSACTIONS
from credit_cost_service import resolve_cost
from credit_exceptions import (
    CreditAccountNotFoundError,
    CreditConcurrencyError,
    CreditTransactionNotFoundError,
    InsufficientCreditsError,
)
from credit_models import ConsumeCreditsResult, CreditBalancePublic
from credit_transaction_service import (
    append_transaction,
    find_by_idempotency_key,
    get_transaction,
    transaction_public,
)
from plan_service import get_plan_doc


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def credits_enforced() -> bool:
    return os.environ.get("CREDITS_ENFORCED", "false").lower() in {"1", "true", "yes"}


def _current_period(now: Optional[datetime] = None) -> tuple[str, str, str]:
    """Return (periodKey YYYY-MM, periodStart ISO, periodEnd ISO) in UTC."""
    now = now or datetime.now(timezone.utc)
    year, month = now.year, now.month
    period_key = f"{year:04d}-{month:02d}"
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    last_day = monthrange(year, month)[1]
    end = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
    return period_key, start.isoformat(), end.isoformat()


def _total_remaining(account: dict) -> int:
    monthly = account.get("monthlyCreditsRemaining")
    permanent = account.get("permanentCreditsRemaining")
    return max(0, int(monthly or 0)) + max(0, int(permanent or 0))


def balance_public(account: dict) -> CreditBalancePublic:
    monthly = max(0, int(account.get("monthlyCreditsRemaining") or 0))
    permanent = max(0, int(account.get("permanentCreditsRemaining") or 0))
    return CreditBalancePublic(
        monthlyRemaining=monthly,
        monthlyAllocated=max(0, int(account.get("monthlyCreditsAllocated") or 0)),
        permanentRemaining=permanent,
        totalRemaining=monthly + permanent,
        planId=account.get("planId"),
        periodKey=account.get("periodKey"),
        periodStart=account.get("periodStart"),
        periodEnd=account.get("periodEnd"),
    )


async def get_account_doc(db, user_id: str) -> Optional[dict]:
    return await db[COLLECTION_ACCOUNTS].find_one({"userId": user_id}, {"_id": 0})


async def ensure_account(db, user_id: str) -> dict:
    existing = await get_account_doc(db, user_id)
    if existing:
        return existing

    now = _now_iso()
    period_key, period_start, period_end = _current_period()
    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "planId": None,
        "periodKey": period_key,
        "periodStart": period_start,
        "periodEnd": period_end,
        "monthlyCreditsRemaining": 0,
        "monthlyCreditsAllocated": 0,
        "permanentCreditsRemaining": 0,
        "version": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    await db[COLLECTION_ACCOUNTS].insert_one(doc)
    return doc


async def get_balance(db, user_id: str) -> CreditBalancePublic:
    account = await ensure_account(db, user_id)
    period_key = account.get("periodKey") or ""
    if not str(period_key).startswith("sub-"):
        account = await rollover_period_if_needed(db, user_id, account)
    return balance_public(account)


async def rollover_period_if_needed(db, user_id: str, account: dict) -> dict:
    """Expire unused monthly credits and grant new allocation when period changes."""
    period_key, period_start, period_end = _current_period()
    return await rollover_to_period(
        db,
        user_id,
        account,
        period_key=period_key,
        period_start=period_start,
        period_end=period_end,
        auto_regrant=bool(account.get("planId")),
    )


async def rollover_to_period(
    db,
    user_id: str,
    account: dict,
    *,
    period_key: str,
    period_start: str,
    period_end: str,
    auto_regrant: bool = False,
) -> dict:
    """Expire unused monthly credits when moving to a new billing period."""
    if account.get("periodKey") == period_key:
        return account

    now = _now_iso()
    expired_monthly = max(0, int(account.get("monthlyCreditsRemaining", 0)))

    update_fields: Dict[str, Any] = {
        "periodKey": period_key,
        "periodStart": period_start,
        "periodEnd": period_end,
        "monthlyCreditsRemaining": 0,
        "monthlyCreditsAllocated": 0,
        "updatedAt": now,
    }

    result = await db[COLLECTION_ACCOUNTS].find_one_and_update(
        {"userId": user_id, "periodKey": account.get("periodKey")},
        {"$set": update_fields, "$inc": {"version": 1}},
        return_document=True,
    )
    if not result:
        return await get_account_doc(db, user_id) or account

    if expired_monthly > 0:
        await append_transaction(
            db,
            user_id=user_id,
            transaction_type="monthly_expiry",
            monthly_delta=-expired_monthly,
            permanent_delta=0,
            monthly_balance_after=0,
            permanent_balance_after=max(0, int(result.get("permanentCreditsRemaining", 0))),
            source="subscription",
            label="Monthly credits expired",
            metadata={"expiredPeriod": account.get("periodKey"), "expiredAmount": expired_monthly},
        )

    plan_id = result.get("planId")
    if auto_regrant and plan_id:
        result = await grant_monthly_credits(
            db,
            user_id,
            plan_id,
            account=result,
            skip_rollover=True,
            period_key=period_key,
            period_start=period_start,
            period_end=period_end,
        )

    return result


async def grant_monthly_credits(
    db,
    user_id: str,
    plan_id: str,
    *,
    account: Optional[dict] = None,
    skip_rollover: bool = False,
    period_key: Optional[str] = None,
    period_start: Optional[str] = None,
    period_end: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> dict:
    """Allocate monthly subscription credits for the current or provided billing period."""
    if idempotency_key:
        existing = await find_by_idempotency_key(db, user_id, idempotency_key)
        if existing:
            return await get_account_doc(db, user_id) or await ensure_account(db, user_id)

    account = account or await ensure_account(db, user_id)
    if not skip_rollover:
        account = await rollover_period_if_needed(db, user_id, account)

    plan_doc = await get_plan_doc(db, plan_id)
    amount = int(plan_doc["monthlyCredits"])
    plan_name = plan_doc["name"]
    now = _now_iso()
    if period_key is None or period_start is None or period_end is None:
        period_key, period_start, period_end = _current_period()

    updated = await db[COLLECTION_ACCOUNTS].find_one_and_update(
        {"userId": user_id},
        {
            "$set": {
                "planId": plan_id,
                "periodKey": period_key,
                "periodStart": period_start,
                "periodEnd": period_end,
                "monthlyCreditsRemaining": amount,
                "monthlyCreditsAllocated": amount,
                "updatedAt": now,
            },
            "$inc": {"version": 1},
        },
        return_document=True,
    )
    if not updated:
        raise CreditAccountNotFoundError(user_id)

    await append_transaction(
        db,
        user_id=user_id,
        transaction_type="monthly_grant",
        monthly_delta=amount,
        permanent_delta=0,
        monthly_balance_after=amount,
        permanent_balance_after=max(0, int(updated.get("permanentCreditsRemaining", 0))),
        source="subscription",
        reference_type="plan",
        reference_id=plan_id,
        idempotency_key=idempotency_key,
        label=f"Monthly allocation — {plan_name}",
        metadata={"planId": plan_id, "periodKey": period_key},
    )
    return updated


async def grant_permanent_credits(
    db,
    user_id: str,
    amount: int,
    *,
    source: str = "admin",
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    label: Optional[str] = None,
    metadata: Optional[dict] = None,
    transaction_type: str = "permanent_grant",
    idempotency_key: Optional[str] = None,
) -> dict:
    if amount <= 0:
        raise ValueError("amount must be positive.")

    if idempotency_key:
        existing = await find_by_idempotency_key(db, user_id, idempotency_key)
        if existing:
            account = await get_account_doc(db, user_id)
            return account or await ensure_account(db, user_id)

    account = await ensure_account(db, user_id)
    account = await rollover_period_if_needed(db, user_id, account)
    now = _now_iso()

    updated = await db[COLLECTION_ACCOUNTS].find_one_and_update(
        {"userId": user_id},
        {
            "$inc": {"permanentCreditsRemaining": amount, "version": 1},
            "$set": {"updatedAt": now},
        },
        return_document=True,
    )
    if not updated:
        raise CreditAccountNotFoundError(user_id)

    await append_transaction(
        db,
        user_id=user_id,
        transaction_type=transaction_type,
        monthly_delta=0,
        permanent_delta=amount,
        monthly_balance_after=max(0, int(updated.get("monthlyCreditsRemaining", 0))),
        permanent_balance_after=max(0, int(updated.get("permanentCreditsRemaining", 0))),
        source=source,
        reference_type=reference_type,
        reference_id=reference_id,
        label=label or f"Permanent credits +{amount}",
        metadata=metadata,
        idempotency_key=idempotency_key,
    )
    return updated


async def can_consume(
    db,
    user_id: str,
    action_key: str,
    *,
    cost: Optional[int] = None,
    tier_key: Optional[str] = None,
) -> tuple[bool, int, CreditBalancePublic]:
    resolved = await resolve_cost(db, action_key, tier_key=tier_key, override_cost=cost)
    account = await ensure_account(db, user_id)
    account = await rollover_period_if_needed(db, user_id, account)
    balance = balance_public(account)
    if not credits_enforced():
        return True, resolved, balance
    return balance.totalRemaining >= resolved, resolved, balance


async def consume(
    db,
    user_id: str,
    action_key: str,
    *,
    cost: Optional[int] = None,
    tier_key: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    max_retries: int = 5,
) -> ConsumeCreditsResult:
    """
    Debit credits for an AI action.

    Uses versioned optimistic locking for monthly-then-permanent priority.
    Supports idempotency keys to prevent double-charging retries.
    """
    if idempotency_key:
        existing = await find_by_idempotency_key(db, user_id, idempotency_key)
        if existing:
            return ConsumeCreditsResult(
                transactionId=existing["id"],
                costApplied=existing.get("costApplied") or 0,
                monthlyDebited=abs(min(0, existing.get("monthlyDelta", 0))),
                permanentDebited=abs(min(0, existing.get("permanentDelta", 0))),
                monthlyBalanceAfter=existing["monthlyBalanceAfter"],
                permanentBalanceAfter=existing["permanentBalanceAfter"],
                idempotentReplay=True,
            )

    resolved_cost = await resolve_cost(db, action_key, tier_key=tier_key, override_cost=cost)

    account = await ensure_account(db, user_id)
    account = await rollover_period_if_needed(db, user_id, account)

    available = _total_remaining(account)
    if credits_enforced() and available < resolved_cost:
        raise InsufficientCreditsError(
            required=resolved_cost,
            available=available,
            monthly_remaining=max(0, int(account.get("monthlyCreditsRemaining", 0))),
            permanent_remaining=max(0, int(account.get("permanentCreditsRemaining", 0))),
            action_key=action_key,
        )

    charge_amount = resolved_cost
    waived = 0
    if not credits_enforced() and available < resolved_cost:
        charge_amount = available
        waived = resolved_cost - available

    if charge_amount == 0:
        tx = await append_transaction(
            db,
            user_id=user_id,
            transaction_type="debit",
            monthly_delta=0,
            permanent_delta=0,
            monthly_balance_after=max(0, int(account.get("monthlyCreditsRemaining", 0))),
            permanent_balance_after=max(0, int(account.get("permanentCreditsRemaining", 0))),
            action_key=action_key,
            tier_key=tier_key,
            cost_applied=0,
            source="ai_usage",
            reference_type=reference_type,
            reference_id=reference_id,
            idempotency_key=idempotency_key,
            label=f"AI action (waived) — {action_key}",
            metadata={**(metadata or {}), "waived": True, "requestedCost": resolved_cost},
        )
        return ConsumeCreditsResult(
            transactionId=tx.id,
            costApplied=0,
            monthlyDebited=0,
            permanentDebited=0,
            monthlyBalanceAfter=tx.monthlyBalanceAfter,
            permanentBalanceAfter=tx.permanentBalanceAfter,
        )

    now = _now_iso()

    for _ in range(max_retries):
        account = await get_account_doc(db, user_id)
        if not account:
            raise CreditAccountNotFoundError(user_id)

        if credits_enforced() and _total_remaining(account) < charge_amount:
            raise InsufficientCreditsError(
                required=charge_amount,
                available=_total_remaining(account),
                monthly_remaining=max(0, int(account.get("monthlyCreditsRemaining") or 0)),
                permanent_remaining=max(0, int(account.get("permanentCreditsRemaining") or 0)),
                action_key=action_key,
            )

        monthly_available = max(0, int(account.get("monthlyCreditsRemaining") or 0))
        from_monthly = min(charge_amount, monthly_available)
        from_permanent = charge_amount - from_monthly
        version = int(account.get("version") or 0)

        result = await db[COLLECTION_ACCOUNTS].update_one(
            {
                "userId": user_id,
                "version": version,
                "monthlyCreditsRemaining": {"$gte": from_monthly},
                "permanentCreditsRemaining": {"$gte": from_permanent},
            },
            {
                "$inc": {
                    "monthlyCreditsRemaining": -from_monthly,
                    "permanentCreditsRemaining": -from_permanent,
                    "version": 1,
                },
                "$set": {"updatedAt": now},
            },
        )

        if result.modified_count == 1:
            monthly_after = monthly_available - from_monthly
            permanent_after = max(0, int(account.get("permanentCreditsRemaining") or 0)) - from_permanent

            tx_meta = dict(metadata or {})
            if waived:
                tx_meta["waived"] = waived
                tx_meta["requestedCost"] = resolved_cost

            tx = await append_transaction(
                db,
                user_id=user_id,
                transaction_type="debit",
                monthly_delta=-from_monthly,
                permanent_delta=-from_permanent,
                monthly_balance_after=monthly_after,
                permanent_balance_after=permanent_after,
                action_key=action_key,
                tier_key=tier_key,
                cost_applied=charge_amount,
                source="ai_usage",
                reference_type=reference_type,
                reference_id=reference_id,
                idempotency_key=idempotency_key,
                label=f"AI action — {action_key}",
                metadata=tx_meta,
            )
            return ConsumeCreditsResult(
                transactionId=tx.id,
                costApplied=charge_amount,
                monthlyDebited=from_monthly,
                permanentDebited=from_permanent,
                monthlyBalanceAfter=monthly_after,
                permanentBalanceAfter=permanent_after,
            )

    raise CreditConcurrencyError()


async def rollback_debit(db, user_id: str, transaction_id: str) -> dict:
    """Reverse a prior debit transaction by restoring bucket balances."""
    original = await db[COLLECTION_TRANSACTIONS].find_one(
        {"userId": user_id, "id": transaction_id, "type": "debit"},
        {"_id": 0},
    )
    if not original:
        raise CreditTransactionNotFoundError(transaction_id)

    if original.get("metadata", {}).get("rolledBack"):
        return await get_account_doc(db, user_id) or {}

    monthly_restore = abs(min(0, int(original.get("monthlyDelta", 0))))
    permanent_restore = abs(min(0, int(original.get("permanentDelta", 0))))
    now = _now_iso()

    updated = await db[COLLECTION_ACCOUNTS].find_one_and_update(
        {"userId": user_id},
        {
            "$inc": {
                "monthlyCreditsRemaining": monthly_restore,
                "permanentCreditsRemaining": permanent_restore,
                "version": 1,
            },
            "$set": {"updatedAt": now},
        },
        return_document=True,
    )
    if not updated:
        raise CreditAccountNotFoundError(user_id)

    await append_transaction(
        db,
        user_id=user_id,
        transaction_type="rollback",
        monthly_delta=monthly_restore,
        permanent_delta=permanent_restore,
        monthly_balance_after=max(0, int(updated.get("monthlyCreditsRemaining", 0))),
        permanent_balance_after=max(0, int(updated.get("permanentCreditsRemaining", 0))),
        source="rollback",
        reference_type="transaction",
        reference_id=transaction_id,
        reversed_transaction_id=transaction_id,
        label=f"Rollback — {original.get('actionKey', 'debit')}",
        metadata={"originalTransactionId": transaction_id},
    )

    await db[COLLECTION_TRANSACTIONS].update_one(
        {"id": transaction_id},
        {"$set": {"metadata.rolledBack": True, "metadata.rolledBackAt": now}},
    )
    return updated


async def refund_to_permanent(
    db,
    user_id: str,
    amount: int,
    *,
    reference_transaction_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> dict:
    return await grant_permanent_credits(
        db,
        user_id,
        amount,
        source="refund",
        reference_type="transaction" if reference_transaction_id else None,
        reference_id=reference_transaction_id,
        label=f"Refund +{amount}",
        metadata=metadata,
        transaction_type="refund",
    )
