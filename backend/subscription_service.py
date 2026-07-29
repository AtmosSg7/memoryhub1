"""
Subscription engine — business logic for trials, plans, lifecycle.

Stripe webhooks (future) should call BillingService, which delegates here.
Credit mutations always go through CreditService.
"""

from __future__ import annotations

import uuid
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from credit_service import (
    ensure_account,
    get_account_doc,
    grant_monthly_credits,
    rollover_to_period,
)
from plan_service import get_plan
from subscription_constants import (
    COLLECTION_SUBSCRIPTIONS,
    CREDIT_ELIGIBLE_STATUSES,
    PLAN_TIER_ORDER,
    TRIAL_DAYS,
)
from subscription_exceptions import (
    InvalidPlanChangeError,
    InvalidSubscriptionTransitionError,
    SubscriptionAlreadyExistsError,
    SubscriptionConcurrencyError,
    SubscriptionNotFoundError,
)
from subscription_history_service import append_event, find_by_idempotency_key
from subscription_models import SubscriptionPublic


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _add_months(dt: datetime, months: int = 1) -> datetime:
    month = dt.month - 1 + months
    year = dt.year + month // 12
    month = month % 12 + 1
    day = min(dt.day, monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day, hour=dt.hour, minute=dt.minute, second=dt.second)


def _period_key(subscription_id: str, period_start: datetime) -> str:
    return f"sub-{subscription_id[:8]}-{period_start.strftime('%Y%m%d')}"


def _billing_period(
    subscription_id: str,
    start: datetime,
    *,
    trial: bool = False,
) -> Tuple[str, str, str, str]:
    """Return (periodKey, periodStart ISO, periodEnd ISO, trialEndsAt ISO?)."""
    if trial:
        end = start + timedelta(days=TRIAL_DAYS)
    else:
        end = _add_months(start, 1)
    key = _period_key(subscription_id, start)
    return key, start.isoformat(), end.isoformat(), end.isoformat() if trial else None


def subscription_public(doc: dict) -> SubscriptionPublic:
    return SubscriptionPublic(
        id=doc["id"],
        userId=doc["userId"],
        status=doc["status"],
        planId=doc["planId"],
        trialStartedAt=doc.get("trialStartedAt"),
        trialEndsAt=doc.get("trialEndsAt"),
        currentPeriodStart=doc["currentPeriodStart"],
        currentPeriodEnd=doc["currentPeriodEnd"],
        periodKey=doc["periodKey"],
        cancelAtPeriodEnd=bool(doc.get("cancelAtPeriodEnd", False)),
        cancelledAt=doc.get("cancelledAt"),
        activatedAt=doc.get("activatedAt"),
        expiredAt=doc.get("expiredAt"),
        suspendedAt=doc.get("suspendedAt"),
        pastDueAt=doc.get("pastDueAt"),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    )


ACTIVE_LIKE_STATUSES = frozenset({"trial", "active", "past_due", "suspended"})


async def get_subscription_doc(db, user_id: str) -> Optional[dict]:
    return await db[COLLECTION_SUBSCRIPTIONS].find_one({"userId": user_id}, {"_id": 0})


async def get_subscription(db, user_id: str) -> SubscriptionPublic:
    doc = await get_subscription_doc(db, user_id)
    if not doc:
        raise SubscriptionNotFoundError(user_id)
    doc = await sync_lifecycle(db, user_id, doc)
    return subscription_public(doc)


async def sync_lifecycle(db, user_id: str, doc: Optional[dict] = None) -> dict:
    """Lazy expiration: trial end, scheduled cancellation, period end without renewal."""
    doc = doc or await get_subscription_doc(db, user_id)
    if not doc:
        raise SubscriptionNotFoundError(user_id)

    now = _now()
    changed = False

    if doc["status"] == "trial" and doc.get("trialEndsAt"):
        if now >= datetime.fromisoformat(doc["trialEndsAt"]):
            doc = await _transition(
                db,
                doc,
                new_status="expired",
                event="expired",
                label="Trial expired",
                extra_fields={"expiredAt": _now_iso(), "cancelAtPeriodEnd": False},
            )
            changed = True

    elif doc["status"] == "active" and doc.get("cancelAtPeriodEnd"):
        if now >= datetime.fromisoformat(doc["currentPeriodEnd"]):
            doc = await _transition(
                db,
                doc,
                new_status="cancelled",
                event="cancelled",
                label="Subscription cancelled at period end",
                extra_fields={"cancelledAt": _now_iso(), "cancelAtPeriodEnd": False},
            )
            changed = True

    elif doc["status"] == "active" and not doc.get("cancelAtPeriodEnd"):
        if now >= datetime.fromisoformat(doc["currentPeriodEnd"]):
            doc = await _transition(
                db,
                doc,
                new_status="expired",
                event="expired",
                label="Billing period ended without renewal",
                extra_fields={"expiredAt": _now_iso()},
            )
            changed = True

    if changed:
        await _clear_credit_plan_if_inactive(db, user_id, doc)

    return doc


async def _clear_credit_plan_if_inactive(db, user_id: str, doc: dict) -> None:
    if doc["status"] not in CREDIT_ELIGIBLE_STATUSES:
        await db.user_credit_accounts.update_one(
            {"userId": user_id},
            {"$set": {"planId": None, "updatedAt": _now_iso()}, "$inc": {"version": 1}},
        )


async def _sync_credits(
    db,
    user_id: str,
    doc: dict,
    *,
    idempotency_key: Optional[str] = None,
    force_regrant: bool = False,
) -> None:
    """Grant or rollover credits according to subscription state and period."""
    if doc["status"] not in CREDIT_ELIGIBLE_STATUSES:
        return

    account = await ensure_account(db, user_id)
    period_key = doc["periodKey"]
    period_start = doc["currentPeriodStart"]
    period_end = doc["currentPeriodEnd"]
    plan_id = doc["planId"]

    if account.get("periodKey") != period_key or force_regrant:
        if account.get("periodKey") != period_key and account.get("periodKey"):
            account = await rollover_to_period(
                db,
                user_id,
                account,
                period_key=period_key,
                period_start=period_start,
                period_end=period_end,
                auto_regrant=False,
            )

        grant_key = idempotency_key or f"sub-grant:{doc['id']}:{period_key}:{plan_id}"
        await grant_monthly_credits(
            db,
            user_id,
            plan_id,
            account=account,
            skip_rollover=True,
            period_key=period_key,
            period_start=period_start,
            period_end=period_end,
            idempotency_key=grant_key,
        )


async def _transition(
    db,
    doc: dict,
    *,
    new_status: str,
    event: str,
    label: str,
    new_plan_id: Optional[str] = None,
    extra_fields: Optional[Dict[str, Any]] = None,
    idempotency_key: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> dict:
    now = _now_iso()
    previous_status = doc["status"]
    previous_plan_id = doc.get("planId")
    update: Dict[str, Any] = {
        "status": new_status,
        "updatedAt": now,
    }
    if new_plan_id is not None:
        update["planId"] = new_plan_id
    if extra_fields:
        update.update(extra_fields)

    result = await db[COLLECTION_SUBSCRIPTIONS].find_one_and_update(
        {"id": doc["id"], "version": doc.get("version", 0)},
        {"$set": update, "$inc": {"version": 1}},
        return_document=True,
    )
    if not result:
        raise SubscriptionConcurrencyError()

    await append_event(
        db,
        user_id=doc["userId"],
        subscription_id=doc["id"],
        event=event,
        previous_status=previous_status,
        new_status=new_status,
        previous_plan_id=previous_plan_id,
        new_plan_id=result.get("planId"),
        label=label,
        metadata=metadata,
        idempotency_key=idempotency_key,
    )
    return result


def _assert_status(doc: dict, allowed: frozenset, action: str) -> None:
    if doc["status"] not in allowed:
        raise InvalidSubscriptionTransitionError(current_status=doc["status"], action=action)


async def create_subscription(
    db,
    user_id: str,
    plan_id: str,
    *,
    start_with_trial: bool = True,
    idempotency_key: Optional[str] = None,
) -> SubscriptionPublic:
    """Create a new subscription — trial (14 days) or direct active."""
    if idempotency_key:
        existing = await find_by_idempotency_key(db, user_id, idempotency_key)
        if existing:
            doc = await get_subscription_doc(db, user_id)
            if doc:
                return subscription_public(doc)

    existing = await get_subscription_doc(db, user_id)
    if existing and existing["status"] in ACTIVE_LIKE_STATUSES:
        raise SubscriptionAlreadyExistsError(user_id)

    await get_plan(db, plan_id)

    now = _now()
    now_iso = now.isoformat()
    sub_id = str(uuid.uuid4())
    is_trial = start_with_trial
    period_key, period_start, period_end, trial_end = _billing_period(sub_id, now, trial=is_trial)

    doc = {
        "id": sub_id,
        "userId": user_id,
        "status": "trial" if is_trial else "active",
        "planId": plan_id,
        "trialStartedAt": now_iso if is_trial else None,
        "trialEndsAt": trial_end if is_trial else None,
        "currentPeriodStart": period_start,
        "currentPeriodEnd": period_end,
        "periodKey": period_key,
        "cancelAtPeriodEnd": False,
        "cancelledAt": None,
        "activatedAt": None if is_trial else now_iso,
        "expiredAt": None,
        "suspendedAt": None,
        "pastDueAt": None,
        "version": 0,
        "createdAt": now_iso,
        "updatedAt": now_iso,
    }

    if existing and existing["status"] in {"cancelled", "expired"}:
        previous_status = existing["status"]
        await db[COLLECTION_SUBSCRIPTIONS].delete_one({"userId": user_id})
    else:
        previous_status = None

    await db[COLLECTION_SUBSCRIPTIONS].insert_one(doc)

    event = "trial_started" if is_trial else "activated"
    await append_event(
        db,
        user_id=user_id,
        subscription_id=sub_id,
        event=event,
        previous_status=previous_status,
        new_status=doc["status"],
        new_plan_id=plan_id,
        label=f"{'Trial started' if is_trial else 'Subscription activated'} — {plan_id}",
        idempotency_key=idempotency_key,
    )

    await _sync_credits(db, user_id, doc, idempotency_key=idempotency_key)
    return subscription_public(doc)


async def activate_subscription(
    db,
    user_id: str,
    *,
    idempotency_key: Optional[str] = None,
) -> SubscriptionPublic:
    """Convert trial to paid active subscription (future: first payment succeeded)."""
    doc = await get_subscription_doc(db, user_id)
    if not doc:
        raise SubscriptionNotFoundError(user_id)

    if idempotency_key:
        existing = await find_by_idempotency_key(db, user_id, idempotency_key)
        if existing:
            return subscription_public(await sync_lifecycle(db, user_id, doc))

    _assert_status(doc, frozenset({"trial"}), "activate")

    now = _now()
    now_iso = now.isoformat()
    period_key, period_start, period_end, _ = _billing_period(doc["id"], now, trial=False)

    doc = await _transition(
        db,
        doc,
        new_status="active",
        event="activated",
        label="Trial converted to active subscription",
        extra_fields={
            "activatedAt": now_iso,
            "currentPeriodStart": period_start,
            "currentPeriodEnd": period_end,
            "periodKey": period_key,
            "trialEndsAt": None,
        },
        idempotency_key=idempotency_key,
    )

    await _sync_credits(db, user_id, doc, idempotency_key=idempotency_key, force_regrant=True)
    return subscription_public(doc)


async def activate_paid_subscription(
    db,
    user_id: str,
    plan_id: str,
    *,
    start_with_trial: bool = False,
    idempotency_key: Optional[str] = None,
) -> SubscriptionPublic:
    """
    Entry point for new paid subscription without existing record.

    Used by dev helpers and future Stripe checkout completion.
    """
    doc = await get_subscription_doc(db, user_id)
    if doc and doc["status"] in ACTIVE_LIKE_STATUSES:
        if doc["planId"] == plan_id and doc["status"] == "active":
            await _sync_credits(db, user_id, doc)
            return subscription_public(doc)
        return await change_plan(db, user_id, plan_id, effective="immediate")

    if doc and doc["status"] == "trial":
        if doc["planId"] != plan_id:
            doc = await change_plan(db, user_id, plan_id, effective="immediate")
        return await activate_subscription(db, user_id, idempotency_key=idempotency_key)

    return await create_subscription(
        db,
        user_id,
        plan_id,
        start_with_trial=start_with_trial,
        idempotency_key=idempotency_key,
    )


async def renew_subscription(
    db,
    user_id: str,
    *,
    idempotency_key: Optional[str] = None,
) -> SubscriptionPublic:
    """Renew billing period — future Stripe invoice.paid webhook."""
    doc = await get_subscription_doc(db, user_id)
    if not doc:
        raise SubscriptionNotFoundError(user_id)

    if idempotency_key:
        existing = await find_by_idempotency_key(db, user_id, idempotency_key)
        if existing:
            return subscription_public(await sync_lifecycle(db, user_id, doc))

    _assert_status(doc, frozenset({"active", "past_due"}), "renew")

    period_start = datetime.fromisoformat(doc["currentPeriodEnd"])
    period_key, new_start, new_end, _ = _billing_period(doc["id"], period_start, trial=False)

    extra: Dict[str, Any] = {
        "currentPeriodStart": new_start,
        "currentPeriodEnd": new_end,
        "periodKey": period_key,
        "pastDueAt": None,
    }
    if doc["status"] == "past_due":
        extra["status"] = "active"

    doc = await _transition(
        db,
        doc,
        new_status="active",
        event="renewed",
        label="Subscription renewed",
        extra_fields=extra,
        idempotency_key=idempotency_key,
    )

    account = await get_account_doc(db, user_id) or await ensure_account(db, user_id)
    await rollover_to_period(
        db,
        user_id,
        account,
        period_key=period_key,
        period_start=new_start,
        period_end=new_end,
        auto_regrant=False,
    )
    await _sync_credits(
        db,
        user_id,
        doc,
        idempotency_key=idempotency_key or f"sub-renew:{doc['id']}:{period_key}",
        force_regrant=True,
    )
    return subscription_public(doc)


async def change_plan(
    db,
    user_id: str,
    new_plan_id: str,
    *,
    effective: str = "immediate",
    idempotency_key: Optional[str] = None,
) -> SubscriptionPublic:
    """Change plan — detects upgrade vs downgrade."""
    doc = await sync_lifecycle(db, user_id)
    _assert_status(doc, frozenset({"trial", "active", "past_due"}), "change plan")

    await get_plan(db, new_plan_id)
    old_plan_id = doc["planId"]
    if old_plan_id == new_plan_id:
        return subscription_public(doc)

    old_tier = PLAN_TIER_ORDER.get(old_plan_id, 0)
    new_tier = PLAN_TIER_ORDER.get(new_plan_id, 0)
    if new_tier == 0 or old_tier == 0:
        raise InvalidPlanChangeError("Unknown plan tier.")

    if effective == "next_period":
        raise InvalidPlanChangeError("Scheduled plan changes are not implemented yet.")

    event = "upgraded" if new_tier > old_tier else "downgraded"
    doc = await _transition(
        db,
        doc,
        new_status=doc["status"],
        event=event,
        label=f"Plan {event}: {old_plan_id} → {new_plan_id}",
        new_plan_id=new_plan_id,
        idempotency_key=idempotency_key,
        metadata={"effective": effective},
    )

    await _sync_credits(db, user_id, doc, force_regrant=True)
    return subscription_public(doc)


async def upgrade_subscription(
    db,
    user_id: str,
    new_plan_id: str,
    *,
    idempotency_key: Optional[str] = None,
) -> SubscriptionPublic:
    doc = await get_subscription_doc(db, user_id)
    if not doc:
        raise SubscriptionNotFoundError(user_id)
    old_tier = PLAN_TIER_ORDER.get(doc["planId"], 0)
    new_tier = PLAN_TIER_ORDER.get(new_plan_id, 0)
    if new_tier <= old_tier:
        raise InvalidPlanChangeError("Target plan is not an upgrade.")
    return await change_plan(db, user_id, new_plan_id, idempotency_key=idempotency_key)


async def downgrade_subscription(
    db,
    user_id: str,
    new_plan_id: str,
    *,
    idempotency_key: Optional[str] = None,
) -> SubscriptionPublic:
    doc = await get_subscription_doc(db, user_id)
    if not doc:
        raise SubscriptionNotFoundError(user_id)
    old_tier = PLAN_TIER_ORDER.get(doc["planId"], 0)
    new_tier = PLAN_TIER_ORDER.get(new_plan_id, 0)
    if new_tier >= old_tier:
        raise InvalidPlanChangeError("Target plan is not a downgrade.")
    return await change_plan(db, user_id, new_plan_id, idempotency_key=idempotency_key)


async def cancel_subscription(
    db,
    user_id: str,
    *,
    at_period_end: bool = True,
    reason: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> SubscriptionPublic:
    """Cancel subscription — immediately or at period end."""
    doc = await sync_lifecycle(db, user_id)
    _assert_status(doc, frozenset({"trial", "active", "past_due"}), "cancel")

    if at_period_end and doc["status"] in {"active", "past_due"}:
        now_iso = _now_iso()
        result = await db[COLLECTION_SUBSCRIPTIONS].find_one_and_update(
            {"id": doc["id"], "version": doc.get("version", 0)},
            {
                "$set": {
                    "cancelAtPeriodEnd": True,
                    "updatedAt": now_iso,
                },
                "$inc": {"version": 1},
            },
            return_document=True,
        )
        if not result:
            raise SubscriptionConcurrencyError()

        await append_event(
            db,
            user_id=user_id,
            subscription_id=doc["id"],
            event="cancellation_scheduled",
            previous_status=doc["status"],
            new_status=doc["status"],
            previous_plan_id=doc["planId"],
            new_plan_id=doc["planId"],
            label="Cancellation scheduled at period end",
            metadata={"reason": reason} if reason else None,
            idempotency_key=idempotency_key,
        )
        return subscription_public(result)

    doc = await _transition(
        db,
        doc,
        new_status="cancelled",
        event="cancelled",
        label="Subscription cancelled",
        extra_fields={
            "cancelAtPeriodEnd": False,
            "cancelledAt": _now_iso(),
        },
        idempotency_key=idempotency_key,
        metadata={"reason": reason} if reason else None,
    )
    await _clear_credit_plan_if_inactive(db, user_id, doc)
    return subscription_public(doc)


async def reactivate_subscription(
    db,
    user_id: str,
    *,
    plan_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> SubscriptionPublic:
    """Reactivate a cancelled or expired subscription."""
    doc = await get_subscription_doc(db, user_id)
    if not doc:
        raise SubscriptionNotFoundError(user_id)

    _assert_status(doc, frozenset({"cancelled", "expired"}), "reactivate")

    target_plan = plan_id or doc["planId"]
    await get_plan(db, target_plan)

    now = _now()
    now_iso = now.isoformat()
    period_key, period_start, period_end, _ = _billing_period(doc["id"], now, trial=False)

    doc = await _transition(
        db,
        doc,
        new_status="active",
        event="reactivated",
        label="Subscription reactivated",
        new_plan_id=target_plan,
        extra_fields={
            "activatedAt": now_iso,
            "currentPeriodStart": period_start,
            "currentPeriodEnd": period_end,
            "periodKey": period_key,
            "cancelAtPeriodEnd": False,
            "cancelledAt": None,
            "expiredAt": None,
            "pastDueAt": None,
            "suspendedAt": None,
        },
        idempotency_key=idempotency_key,
    )

    await _sync_credits(db, user_id, doc, force_regrant=True)
    return subscription_public(doc)


async def mark_past_due(
    db,
    user_id: str,
    *,
    idempotency_key: Optional[str] = None,
) -> SubscriptionPublic:
    """Payment failed — future Stripe invoice.payment_failed webhook."""
    doc = await sync_lifecycle(db, user_id)
    _assert_status(doc, frozenset({"active"}), "mark past due")

    doc = await _transition(
        db,
        doc,
        new_status="past_due",
        event="past_due",
        label="Payment past due",
        extra_fields={"pastDueAt": _now_iso()},
        idempotency_key=idempotency_key,
    )
    return subscription_public(doc)


async def suspend_subscription(
    db,
    user_id: str,
    *,
    reason: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> SubscriptionPublic:
    """Admin suspension."""
    doc = await sync_lifecycle(db, user_id)
    _assert_status(doc, frozenset({"trial", "active", "past_due"}), "suspend")

    doc = await _transition(
        db,
        doc,
        new_status="suspended",
        event="suspended",
        label="Subscription suspended",
        extra_fields={"suspendedAt": _now_iso()},
        idempotency_key=idempotency_key,
        metadata={"reason": reason} if reason else None,
    )
    await _clear_credit_plan_if_inactive(db, user_id, doc)
    return subscription_public(doc)


async def resume_subscription(
    db,
    user_id: str,
    *,
    idempotency_key: Optional[str] = None,
) -> SubscriptionPublic:
    """Resume after admin suspension."""
    doc = await get_subscription_doc(db, user_id)
    if not doc:
        raise SubscriptionNotFoundError(user_id)

    _assert_status(doc, frozenset({"suspended"}), "resume")

    doc = await _transition(
        db,
        doc,
        new_status="active",
        event="resumed",
        label="Subscription resumed",
        extra_fields={"suspendedAt": None},
        idempotency_key=idempotency_key,
    )
    await _sync_credits(db, user_id, doc, force_regrant=True)
    return subscription_public(doc)


async def expire_subscription(
    db,
    user_id: str,
    *,
    idempotency_key: Optional[str] = None,
) -> SubscriptionPublic:
    """Force expiration (admin or system)."""
    doc = await get_subscription_doc(db, user_id)
    if not doc:
        raise SubscriptionNotFoundError(user_id)

    _assert_status(doc, frozenset({"trial", "active", "past_due", "cancelled"}), "expire")

    doc = await _transition(
        db,
        doc,
        new_status="expired",
        event="expired",
        label="Subscription expired",
        extra_fields={
            "expiredAt": _now_iso(),
            "cancelAtPeriodEnd": False,
        },
        idempotency_key=idempotency_key,
    )
    await _clear_credit_plan_if_inactive(db, user_id, doc)
    return subscription_public(doc)


async def user_has_trial_history(db, user_id: str) -> bool:
    """True if user already consumed a trial (no second trial)."""
    count = await db.subscription_history.count_documents(
        {"userId": user_id, "event": "trial_started"},
    )
    return count > 0


async def update_stripe_metadata(
    db,
    user_id: str,
    *,
    stripe_customer_id: Optional[str] = None,
    stripe_subscription_id: Optional[str] = None,
    stripe_price_id: Optional[str] = None,
    stripe_checkout_session_id: Optional[str] = None,
    stripe_current_period_end: Optional[str] = None,
    stripe_status: Optional[str] = None,
    cancel_at_period_end: Optional[bool] = None,
    last_stripe_event_id: Optional[str] = None,
) -> None:
    """Persist Stripe identifiers on the subscription document."""
    doc = await get_subscription_doc(db, user_id)
    if not doc:
        return

    update: Dict[str, Any] = {"updatedAt": _now_iso()}
    if stripe_customer_id is not None:
        update["stripeCustomerId"] = stripe_customer_id
    if stripe_subscription_id is not None:
        update["stripeSubscriptionId"] = stripe_subscription_id
    if stripe_price_id is not None:
        update["stripePriceId"] = stripe_price_id
    if stripe_checkout_session_id is not None:
        update["stripeCheckoutSessionId"] = stripe_checkout_session_id
    if stripe_current_period_end is not None:
        update["stripeCurrentPeriodEnd"] = stripe_current_period_end
    if stripe_status is not None:
        update["stripeStatus"] = stripe_status
    if cancel_at_period_end is not None:
        update["cancelAtPeriodEnd"] = cancel_at_period_end
    if last_stripe_event_id is not None:
        update["lastStripeEventId"] = last_stripe_event_id

    await db[COLLECTION_SUBSCRIPTIONS].update_one(
        {"userId": user_id},
        {"$set": update, "$inc": {"version": 1}},
    )


def _ts_to_iso(ts: Optional[int]) -> Optional[str]:
    if not ts:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


async def sync_periods_from_stripe(
    db,
    user_id: str,
    *,
    period_start_ts: int,
    period_end_ts: int,
    trial_end_ts: Optional[int] = None,
) -> None:
    """Align MemoryHub billing period with Stripe timestamps."""
    doc = await get_subscription_doc(db, user_id)
    if not doc:
        return

    start_dt = datetime.fromtimestamp(period_start_ts, tz=timezone.utc)
    period_key = _period_key(doc["id"], start_dt)
    update = {
        "currentPeriodStart": _ts_to_iso(period_start_ts),
        "currentPeriodEnd": _ts_to_iso(period_end_ts),
        "periodKey": period_key,
        "stripeCurrentPeriodEnd": _ts_to_iso(period_end_ts),
        "updatedAt": _now_iso(),
    }
    if trial_end_ts:
        update["trialEndsAt"] = _ts_to_iso(trial_end_ts)

    await db[COLLECTION_SUBSCRIPTIONS].update_one(
        {"userId": user_id},
        {"$set": update, "$inc": {"version": 1}},
    )


async def apply_stripe_status(
    db,
    user_id: str,
    *,
    plan_id: str,
    stripe_status: str,
    idempotency_key: Optional[str] = None,
) -> SubscriptionPublic:
    """Apply Stripe subscription status via existing subscription flows."""
    from stripe_constants import STRIPE_TO_SUBSCRIPTION_STATUS

    internal = STRIPE_TO_SUBSCRIPTION_STATUS.get(stripe_status, "active")
    doc = await get_subscription_doc(db, user_id)

    if not doc:
        if internal == "trial":
            return await create_subscription(
                db,
                user_id,
                plan_id,
                start_with_trial=True,
                idempotency_key=idempotency_key,
            )
        return await create_subscription(
            db,
            user_id,
            plan_id,
            start_with_trial=False,
            idempotency_key=idempotency_key,
        )

    if internal == "trial" and doc["status"] not in ACTIVE_LIKE_STATUSES:
        return await create_subscription(
            db,
            user_id,
            plan_id,
            start_with_trial=True,
            idempotency_key=idempotency_key,
        )

    if internal == "active" and doc["status"] == "trial":
        return await activate_subscription(db, user_id, idempotency_key=idempotency_key)

    if internal == "active" and doc["status"] in {"expired", "cancelled"}:
        return await reactivate_subscription(db, user_id, plan_id=plan_id, idempotency_key=idempotency_key)

    if internal == "past_due" and doc["status"] == "active":
        return await mark_past_due(db, user_id, idempotency_key=idempotency_key)

    if internal == "cancelled":
        return await cancel_subscription(db, user_id, at_period_end=False, idempotency_key=idempotency_key)

    if internal == "expired":
        return await expire_subscription(db, user_id, idempotency_key=idempotency_key)

    if doc["planId"] != plan_id and doc["status"] in CREDIT_ELIGIBLE_STATUSES:
        return await change_plan(db, user_id, plan_id, idempotency_key=idempotency_key)

    return subscription_public(await sync_lifecycle(db, user_id, doc))
