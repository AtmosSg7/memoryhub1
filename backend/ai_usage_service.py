"""
AI usage gateway — the ONLY path for AI credit consumption.

Application code must never call CreditService.consume() directly for AI actions.
Use AIUsageService instead so costs, enforcement, and auditing stay centralized.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from analysis_presentation_service import import_analysis_cost_credits
from credit_exceptions import InsufficientCreditsError
from credit_models import AIUsageRequest, ConsumeCreditsResult, CreditBalancePublic
from credit_service import can_consume, consume, credits_enforced, get_balance, rollback_debit


async def check_before_action(
    db,
    user_id: str,
    action_key: str,
    *,
    cost: Optional[int] = None,
    tier_key: Optional[str] = None,
) -> tuple[bool, int, CreditBalancePublic]:
    """Pre-flight check — use before expensive AI calls (e.g. OpenAI)."""
    return await can_consume(db, user_id, action_key, cost=cost, tier_key=tier_key)


async def record_usage(
    db,
    request: AIUsageRequest,
) -> ConsumeCreditsResult:
    """
    Record AI credit consumption after a successful operation.

    For import with variable tiers, pass request.cost once complexity is estimated.
    """
    return await consume(
        db,
        request.userId,
        request.actionKey,
        cost=request.cost,
        tier_key=request.tierKey,
        idempotency_key=request.idempotencyKey,
        reference_type=request.referenceType,
        reference_id=request.referenceId,
        metadata=request.metadata,
    )


async def consume_for_import(
    db,
    user_id: str,
    *,
    session_id: str,
    cost: Optional[int] = None,
    tier_key: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> ConsumeCreditsResult:
    """Debit one analysis (= flat internal credits) for document import."""
    idempotency_key = f"import:{session_id}"
    resolved_cost = import_analysis_cost_credits() if cost is None else cost
    return await consume(
        db,
        user_id,
        "IMPORT_DOCUMENT",
        cost=resolved_cost,
        tier_key=tier_key,
        idempotency_key=idempotency_key,
        reference_type="import_session",
        reference_id=session_id,
        metadata=metadata,
    )


async def require_credits_for_import(
    db,
    user_id: str,
    *,
    cost: Optional[int] = None,
    tier_key: Optional[str] = None,
) -> int:
    """Validate sufficient balance for one import analysis."""
    resolved_cost = import_analysis_cost_credits() if cost is None else cost
    ok, resolved, _balance = await can_consume(
        db, user_id, "IMPORT_DOCUMENT", cost=resolved_cost, tier_key=tier_key
    )
    if credits_enforced() and not ok:
        raise InsufficientCreditsError(
            required=resolved,
            available=_balance.totalRemaining,
            monthly_remaining=_balance.monthlyRemaining,
            permanent_remaining=_balance.permanentRemaining,
            action_key="IMPORT_DOCUMENT",
        )
    return resolved


async def rollback_usage(db, user_id: str, transaction_id: str) -> None:
    """Rollback a failed AI operation after credits were debited."""
    await rollback_debit(db, user_id, transaction_id)


async def preview_import_cost(
    db,
    *,
    tier_key: Optional[str] = None,
    override_cost: Optional[int] = None,
) -> int:
    """Internal credit cost for one import analysis."""
    if override_cost is not None:
        return override_cost
    return import_analysis_cost_credits()
