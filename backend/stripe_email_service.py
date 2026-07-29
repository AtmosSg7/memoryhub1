"""Stripe webhook → transactional email bridge (idempotent, non-blocking)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from email_constants import (
    TEMPLATE_SUBSCRIPTION_ACTIVATED,
    TEMPLATE_SUBSCRIPTION_CANCELLATION_SCHEDULED,
    TEMPLATE_SUBSCRIPTION_CANCELLED,
    TEMPLATE_SUBSCRIPTION_PAYMENT_FAILED,
    TEMPLATE_SUBSCRIPTION_RENEWED,
    TEMPLATE_SUBSCRIPTION_TRIAL_STARTED,
)
from transactional_email_service import resolve_user_locale, send_subscription_email

logger = logging.getLogger(__name__)

_PLAN_LABELS = {
    "starter": {"fr": "Starter", "en": "Starter"},
    "pro": {"fr": "Pro", "en": "Pro"},
    "business": {"fr": "Business", "en": "Business"},
}


def _plan_display(plan_id: str, locale: str) -> str:
    labels = _PLAN_LABELS.get(plan_id or "", {})
    return labels.get(locale) or labels.get("fr") or (plan_id or "MemoryHub").title()


def _format_period_end(ts: Optional[int], locale: str) -> str:
    if not ts:
        return "—"
    dt = datetime.fromtimestamp(int(ts), tz=timezone.utc)
    if locale == "en":
        return dt.strftime("%B %d, %Y")
    return dt.strftime("%d/%m/%Y")


async def _user_email_context(db, user_id: str) -> Optional[dict]:
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1, "firstName": 1})
    if not user or not user.get("email"):
        return None
    greeting = (user.get("firstName") or "").strip() or "there"
    return {"to": user["email"], "greeting": greeting}


async def notify_stripe_email(
    db,
    *,
    user_id: str,
    template_key: str,
    stripe_event_id: str,
    plan_id: str,
    period_end_ts: Optional[int] = None,
) -> None:
    """Send subscription email; failures are logged, never raised to webhook."""
    try:
        ctx = await _user_email_context(db, user_id)
        if not ctx:
            return
        locale = await resolve_user_locale(db, user_id)
        idempotency_key = f"stripe-email:{stripe_event_id}:{template_key}"
        await send_subscription_email(
            db,
            template_key=template_key,
            user_id=user_id,
            to=ctx["to"],
            greeting=ctx["greeting"],
            plan_name=_plan_display(plan_id, locale),
            locale=locale,
            idempotency_key=idempotency_key,
            period_end=_format_period_end(period_end_ts, locale) if period_end_ts else None,
        )
    except Exception:
        logger.exception(
            "Failed to send subscription email %s for user %s (event %s)",
            template_key,
            user_id,
            stripe_event_id,
        )


async def on_checkout_completed(db, user_id: str, plan_id: str, stripe_event_id: str, stripe_sub: Any) -> None:
    trial_end = getattr(stripe_sub, "trial_end", None) if not isinstance(stripe_sub, dict) else stripe_sub.get("trial_end")
    if trial_end:
        await notify_stripe_email(
            db,
            user_id=user_id,
            template_key=TEMPLATE_SUBSCRIPTION_TRIAL_STARTED,
            stripe_event_id=stripe_event_id,
            plan_id=plan_id,
        )
    else:
        await notify_stripe_email(
            db,
            user_id=user_id,
            template_key=TEMPLATE_SUBSCRIPTION_ACTIVATED,
            stripe_event_id=stripe_event_id,
            plan_id=plan_id,
        )


async def on_subscription_deleted(db, user_id: str, plan_id: str, stripe_event_id: str) -> None:
    from email_constants import TEMPLATE_SUBSCRIPTION_CANCELLED

    await notify_stripe_email(
        db,
        user_id=user_id,
        template_key=TEMPLATE_SUBSCRIPTION_CANCELLED,
        stripe_event_id=stripe_event_id,
        plan_id=plan_id,
    )


async def on_subscription_updated_cancel_scheduled(
    db,
    user_id: str,
    plan_id: str,
    stripe_event_id: str,
    period_end_ts: Optional[int],
) -> None:
    await notify_stripe_email(
        db,
        user_id=user_id,
        template_key=TEMPLATE_SUBSCRIPTION_CANCELLATION_SCHEDULED,
        stripe_event_id=stripe_event_id,
        plan_id=plan_id,
        period_end_ts=period_end_ts,
    )


async def on_invoice_paid(db, user_id: str, plan_id: str, stripe_event_id: str) -> None:
    await notify_stripe_email(
        db,
        user_id=user_id,
        template_key=TEMPLATE_SUBSCRIPTION_RENEWED,
        stripe_event_id=stripe_event_id,
        plan_id=plan_id,
    )


async def on_invoice_payment_failed(db, user_id: str, plan_id: str, stripe_event_id: str) -> None:
    await notify_stripe_email(
        db,
        user_id=user_id,
        template_key=TEMPLATE_SUBSCRIPTION_PAYMENT_FAILED,
        stripe_event_id=stripe_event_id,
        plan_id=plan_id,
    )
