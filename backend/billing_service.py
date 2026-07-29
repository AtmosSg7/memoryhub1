"""
Billing integration layer — future Stripe hook.

Stripe webhooks call this module only.
Subscription lifecycle → SubscriptionService.
Credit purchases / grants → CreditService.
"""

from __future__ import annotations

from typing import Optional

from credit_service import get_balance, grant_permanent_credits
from credit_models import CreditBalancePublic
from subscription_models import SubscriptionPublic
from subscription_service import (
    activate_paid_subscription,
    activate_subscription,
    cancel_subscription,
    change_plan,
    create_subscription,
    downgrade_subscription,
    expire_subscription,
    mark_past_due,
    reactivate_subscription,
    renew_subscription,
    resume_subscription,
    suspend_subscription,
    upgrade_subscription,
)


async def start_subscription(
    db,
    user_id: str,
    plan_id: str,
    *,
    start_with_trial: bool = True,
    payment_reference: Optional[str] = None,
) -> SubscriptionPublic:
    """Future: Stripe checkout with trial."""
    return await create_subscription(
        db,
        user_id,
        plan_id,
        start_with_trial=start_with_trial,
        idempotency_key=payment_reference,
    )


async def activate_subscription(
    db,
    user_id: str,
    plan_id: str,
    *,
    payment_reference: Optional[str] = None,
) -> CreditBalancePublic:
    """
    Called when a user subscribes or completes checkout (future Stripe webhook).

    Creates or activates subscription and grants monthly credits.
    """
    await activate_paid_subscription(
        db,
        user_id,
        plan_id,
        start_with_trial=False,
        idempotency_key=payment_reference,
    )
    return await get_balance(db, user_id)


async def handle_subscription_renewed(
    db,
    user_id: str,
    *,
    invoice_reference: Optional[str] = None,
) -> SubscriptionPublic:
    """Future: Stripe invoice.paid."""
    return await renew_subscription(db, user_id, idempotency_key=invoice_reference)


async def handle_payment_failed(
    db,
    user_id: str,
    *,
    invoice_reference: Optional[str] = None,
) -> SubscriptionPublic:
    """Future: Stripe invoice.payment_failed."""
    return await mark_past_due(db, user_id, idempotency_key=invoice_reference)


async def handle_subscription_cancelled(
    db,
    user_id: str,
    *,
    at_period_end: bool = True,
    payment_reference: Optional[str] = None,
) -> SubscriptionPublic:
    """Future: Stripe customer.subscription.deleted."""
    return await cancel_subscription(
        db,
        user_id,
        at_period_end=at_period_end,
        idempotency_key=payment_reference,
    )


async def handle_plan_changed(
    db,
    user_id: str,
    new_plan_id: str,
    *,
    payment_reference: Optional[str] = None,
) -> SubscriptionPublic:
    """Future: Stripe subscription updated."""
    return await change_plan(db, user_id, new_plan_id, idempotency_key=payment_reference)


async def record_credit_purchase(
    db,
    user_id: str,
    credits: int,
    *,
    payment_reference: Optional[str] = None,
    pack_key: Optional[str] = None,
    purchase_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    method: str = "stripe",
    price_cents: Optional[int] = None,
    currency: Optional[str] = None,
) -> CreditBalancePublic:
    """
    Called when a user buys additional credits (Stripe webhook or dev simulation).

    Purchased credits are permanent — they never expire.
    """
    meta: dict = {
        "paymentReference": payment_reference,
        "purchaseId": purchase_id,
        "packKey": pack_key,
        "method": method,
    }
    if price_cents is not None:
        meta["priceCents"] = price_cents
    if currency:
        meta["currency"] = currency
    if method == "development":
        meta["devPurchase"] = True

    await grant_permanent_credits(
        db,
        user_id,
        credits,
        source="purchase",
        reference_type="credit_purchase",
        reference_id=purchase_id or payment_reference,
        label=f"Credit purchase +{credits}",
        metadata=meta,
        transaction_type="permanent_grant",
        idempotency_key=idempotency_key,
    )
    return await get_balance(db, user_id)


async def grant_admin_credits(
    db,
    user_id: str,
    credits: int,
    *,
    reason: Optional[str] = None,
) -> CreditBalancePublic:
    """Operator grant — permanent credits."""
    await grant_permanent_credits(
        db,
        user_id,
        credits,
        source="admin",
        label=f"Admin grant +{credits}",
        metadata={"reason": reason} if reason else None,
        transaction_type="admin_grant",
    )
    return await get_balance(db, user_id)


async def grant_bonus_credits(
    db,
    user_id: str,
    credits: int,
    *,
    campaign: Optional[str] = None,
) -> CreditBalancePublic:
    """Promotional bonus — permanent credits."""
    await grant_permanent_credits(
        db,
        user_id,
        credits,
        source="bonus",
        label=f"Bonus +{credits}",
        metadata={"campaign": campaign} if campaign else None,
        transaction_type="bonus",
    )
    return await get_balance(db, user_id)


# Re-export subscription operations for admin / internal tooling.
__all__ = [
    "activate_subscription",
    "start_subscription",
    "handle_subscription_renewed",
    "handle_payment_failed",
    "handle_subscription_cancelled",
    "handle_plan_changed",
    "record_credit_purchase",
    "grant_admin_credits",
    "grant_bonus_credits",
    "activate_paid_subscription",
    "upgrade_subscription",
    "downgrade_subscription",
    "reactivate_subscription",
    "expire_subscription",
    "suspend_subscription",
    "resume_subscription",
]
