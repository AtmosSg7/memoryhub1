"""
Stripe webhook processor — signature verification and idempotent dispatch.

All business mutations go through BillingService / SubscriptionService.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional, Tuple

import billing_service
from stripe_config import price_id_to_plan_id, require_stripe_settings
from stripe_constants import HANDLED_STRIPE_EVENT_TYPES
from stripe_event_service import claim_event, complete_event
from stripe_exceptions import StripeWebhookError
from stripe_service import get_stripe_backend
from subscription_service import (
    apply_stripe_status,
    cancel_subscription,
    get_subscription_doc,
    sync_periods_from_stripe,
    update_stripe_metadata,
)

logger = logging.getLogger(__name__)


async def get_user_by_stripe_customer(db, customer_id: str) -> Optional[dict]:
    if not customer_id:
        return None
    return await db.users.find_one({"stripeCustomerId": customer_id}, {"_id": 0})


def _obj_get(obj: Any, key: str, default=None):
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _coerce_optional_int(value: Any) -> Optional[int]:
    """Convert Stripe timestamps to int; never raise on None/missing."""
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _first_subscription_item(stripe_sub: Any) -> Any:
    items = _obj_get(_obj_get(stripe_sub, "items"), "data") or []
    return items[0] if items else None


def _extract_subscription_fields(stripe_sub: Any) -> Dict[str, Any]:
    """Normalize Subscription fields across Stripe API versions.

    Stripe Basil (2025-03-31+) removed top-level current_period_start/end from
    Subscription; those timestamps live on SubscriptionItem instead.
    """
    item = _first_subscription_item(stripe_sub)
    price = _obj_get(item, "price") if item is not None else None
    price_id = _obj_get(price, "id") if price is not None else None

    period_start = _obj_get(stripe_sub, "current_period_start")
    period_end = _obj_get(stripe_sub, "current_period_end")
    if period_start is None and item is not None:
        period_start = _obj_get(item, "current_period_start")
    if period_end is None and item is not None:
        period_end = _obj_get(item, "current_period_end")

    return {
        "stripe_subscription_id": _obj_get(stripe_sub, "id"),
        "stripe_customer_id": _obj_get(stripe_sub, "customer"),
        "stripe_price_id": price_id,
        "stripe_status": _obj_get(stripe_sub, "status"),
        "period_start_ts": _coerce_optional_int(period_start),
        "period_end_ts": _coerce_optional_int(period_end),
        "trial_end_ts": _coerce_optional_int(_obj_get(stripe_sub, "trial_end")),
        "cancel_at_period_end": bool(_obj_get(stripe_sub, "cancel_at_period_end", False)),
    }


async def _resolve_user_and_plan(
    db,
    *,
    customer_id: str,
    metadata: Optional[dict],
    price_id: Optional[str],
) -> Tuple[Optional[dict], Optional[str]]:
    user = await get_user_by_stripe_customer(db, customer_id)
    plan_id = (metadata or {}).get("planId")
    if not plan_id and price_id:
        plan_id = price_id_to_plan_id(price_id)
    if user and metadata and metadata.get("userId") and metadata["userId"] != user["id"]:
        raise StripeWebhookError("Stripe metadata user mismatch.")
    if not user and metadata and metadata.get("userId"):
        user = await db.users.find_one({"id": metadata["userId"]}, {"_id": 0})
    return user, plan_id


async def _sync_subscription_from_stripe(
    db,
    user_id: str,
    plan_id: str,
    stripe_sub: Any,
    *,
    event_id: str,
    checkout_session_id: Optional[str] = None,
    idempotency_suffix: Optional[str] = None,
) -> None:
    fields = _extract_subscription_fields(stripe_sub)
    idempotency_key = f"stripe:{idempotency_suffix or event_id}"

    await apply_stripe_status(
        db,
        user_id,
        plan_id=plan_id,
        stripe_status=fields["stripe_status"],
        idempotency_key=idempotency_key,
    )

    await update_stripe_metadata(
        db,
        user_id,
        stripe_customer_id=fields["stripe_customer_id"],
        stripe_subscription_id=fields["stripe_subscription_id"],
        stripe_price_id=fields["stripe_price_id"],
        stripe_checkout_session_id=checkout_session_id,
        stripe_current_period_end=None,
        stripe_status=fields["stripe_status"],
        cancel_at_period_end=fields["cancel_at_period_end"],
        last_stripe_event_id=event_id,
    )

    period_start = fields["period_start_ts"]
    period_end = fields["period_end_ts"]
    if period_start is not None and period_end is not None:
        await sync_periods_from_stripe(
            db,
            user_id,
            period_start_ts=period_start,
            period_end_ts=period_end,
            trial_end_ts=fields["trial_end_ts"],
        )
    else:
        # Status/metadata already applied; periods may arrive on a later event.
        logger.warning(
            "Stripe subscription %s missing period timestamps (start=%s end=%s); "
            "skipping period sync for event %s",
            fields.get("stripe_subscription_id"),
            period_start,
            period_end,
            event_id,
        )


async def handle_checkout_completed(db, event: Any) -> Optional[str]:
    session = _obj_get(event, "data") and _obj_get(_obj_get(event, "data"), "object")
    if not session:
        return None

    metadata = _obj_get(session, "metadata") or {}
    mode = _obj_get(session, "mode")
    purchase_type = metadata.get("purchaseType")

    if mode == "payment" or purchase_type == "credit_pack":
        return await handle_credit_pack_checkout_completed(db, event)

    customer_id = _obj_get(session, "customer")
    subscription_id = _obj_get(session, "subscription")
    if not subscription_id:
        return None

    backend = get_stripe_backend()
    stripe_sub = backend.retrieve_subscription(subscription_id)
    fields = _extract_subscription_fields(stripe_sub)
    user, plan_id = await _resolve_user_and_plan(
        db,
        customer_id=customer_id,
        metadata=metadata,
        price_id=fields["stripe_price_id"],
    )
    if not user or not plan_id:
        raise StripeWebhookError("Unable to resolve user or plan for checkout session.")

    event_id = _obj_get(event, "id")
    await _sync_subscription_from_stripe(
        db,
        user["id"],
        plan_id,
        stripe_sub,
        event_id=event_id,
        checkout_session_id=_obj_get(session, "id"),
        idempotency_suffix=f"checkout:{_obj_get(session, 'id')}",
    )
    try:
        from stripe_email_service import on_checkout_completed

        await on_checkout_completed(db, user["id"], plan_id, event_id, stripe_sub)
    except Exception:
        logger.exception("Subscription email failed after checkout (non-blocking).")
    return user["id"]


async def handle_credit_pack_checkout_completed(db, event: Any) -> Optional[str]:
    session = _obj_get(event, "data") and _obj_get(_obj_get(event, "data"), "object")
    if not session:
        return None

    metadata = _obj_get(session, "metadata") or {}
    pack_key = metadata.get("packKey")
    purchase_id = metadata.get("purchaseId")
    user_id = metadata.get("userId")
    payment_status = _obj_get(session, "payment_status")

    if payment_status and payment_status != "paid":
        logger.warning("Credit checkout session not paid: %s", payment_status)
        return None

    if not pack_key or not purchase_id or not user_id:
        raise StripeWebhookError("Missing credit pack metadata on checkout session.")

    customer_id = _obj_get(session, "customer")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        user = await get_user_by_stripe_customer(db, customer_id)
    if not user or user["id"] != user_id:
        raise StripeWebhookError("Stripe metadata user mismatch for credit purchase.")

    event_id = _obj_get(event, "id")
    payment_intent = _obj_get(session, "payment_intent")

    from credit_purchase_service import fulfill_stripe_credit_purchase

    await fulfill_stripe_credit_purchase(
        db,
        user_id=user_id,
        pack_key=pack_key,
        purchase_id=purchase_id,
        stripe_checkout_session_id=_obj_get(session, "id"),
        stripe_event_id=event_id,
        stripe_payment_intent_id=payment_intent if isinstance(payment_intent, str) else None,
    )
    return user_id


async def handle_subscription_event(db, event: Any) -> Optional[str]:
    stripe_sub = _obj_get(event, "data") and _obj_get(_obj_get(event, "data"), "object")
    if not stripe_sub:
        return None

    fields = _extract_subscription_fields(stripe_sub)
    metadata = _obj_get(stripe_sub, "metadata") or {}
    user, plan_id = await _resolve_user_and_plan(
        db,
        customer_id=fields["stripe_customer_id"],
        metadata=metadata,
        price_id=fields["stripe_price_id"],
    )
    if not user or not plan_id:
        raise StripeWebhookError("Unable to resolve user or plan for subscription event.")

    event_id = _obj_get(event, "id")
    event_type = _obj_get(event, "type")

    if event_type == "customer.subscription.deleted":
        await billing_service.handle_subscription_cancelled(
            db,
            user["id"],
            at_period_end=False,
            payment_reference=event_id,
        )
        await update_stripe_metadata(
            db,
            user["id"],
            stripe_status="canceled",
            last_stripe_event_id=event_id,
        )
        try:
            from stripe_email_service import on_subscription_deleted

            await on_subscription_deleted(db, user["id"], plan_id, event_id)
        except Exception:
            logger.exception("Subscription email failed after deletion (non-blocking).")
        return user["id"]

    await _sync_subscription_from_stripe(
        db,
        user["id"],
        plan_id,
        stripe_sub,
        event_id=event_id,
        idempotency_suffix=f"sub:{fields['stripe_subscription_id']}:{event_type}",
    )

    if event_type == "customer.subscription.updated" and plan_id:
        pass  # apply_stripe_status / _sync already handled plan + status

    if fields["cancel_at_period_end"]:
        doc = await get_subscription_doc(db, user["id"])
        if doc and not doc.get("cancelAtPeriodEnd"):
            await cancel_subscription(db, user["id"], at_period_end=True, idempotency_key=event_id)
            try:
                from stripe_email_service import on_subscription_updated_cancel_scheduled

                await on_subscription_updated_cancel_scheduled(
                    db,
                    user["id"],
                    plan_id,
                    event_id,
                    fields.get("period_end_ts"),
                )
            except Exception:
                logger.exception("Cancellation email failed (non-blocking).")

    return user["id"]


async def handle_invoice_paid(db, event: Any) -> Optional[str]:
    invoice = _obj_get(event, "data") and _obj_get(_obj_get(event, "data"), "object")
    if not invoice:
        return None

    billing_reason = _obj_get(invoice, "billing_reason")
    if billing_reason != "subscription_cycle":
        return None

    customer_id = _obj_get(invoice, "customer")
    user = await get_user_by_stripe_customer(db, customer_id)
    if not user:
        return None

    event_id = _obj_get(event, "id")
    await billing_service.handle_subscription_renewed(
        db,
        user["id"],
        invoice_reference=event_id,
    )
    await update_stripe_metadata(db, user["id"], last_stripe_event_id=event_id)
    try:
        from subscription_service import get_subscription_doc
        from stripe_email_service import on_invoice_paid

        sub = await get_subscription_doc(db, user["id"])
        plan_id = (sub or {}).get("planId") or "starter"
        await on_invoice_paid(db, user["id"], plan_id, event_id)
    except Exception:
        logger.exception("Renewal email failed (non-blocking).")
    return user["id"]


async def handle_invoice_payment_failed(db, event: Any) -> Optional[str]:
    invoice = _obj_get(event, "data") and _obj_get(_obj_get(event, "data"), "object")
    if not invoice:
        return None

    customer_id = _obj_get(invoice, "customer")
    user = await get_user_by_stripe_customer(db, customer_id)
    if not user:
        return None

    event_id = _obj_get(event, "id")
    await billing_service.handle_payment_failed(db, user["id"], invoice_reference=event_id)
    await update_stripe_metadata(db, user["id"], last_stripe_event_id=event_id)
    try:
        from subscription_service import get_subscription_doc
        from stripe_email_service import on_invoice_payment_failed

        sub = await get_subscription_doc(db, user["id"])
        plan_id = (sub or {}).get("planId") or "starter"
        await on_invoice_payment_failed(db, user["id"], plan_id, event_id)
    except Exception:
        logger.exception("Payment failed email failed (non-blocking).")
    return user["id"]


async def process_stripe_webhook(db, payload: bytes, sig_header: Optional[str]) -> dict:
    if not sig_header:
        raise StripeWebhookError("Missing Stripe signature.")

    settings = require_stripe_settings()
    if not settings.webhook_secret:
        raise StripeWebhookError("Stripe webhook secret is not configured.")
    backend = get_stripe_backend()

    try:
        event = backend.construct_webhook_event(payload, sig_header, settings.webhook_secret)
    except Exception as exc:
        logger.warning("Stripe webhook signature verification failed.")
        raise StripeWebhookError("Invalid Stripe webhook signature.") from exc

    event_id = _obj_get(event, "id")
    event_type = _obj_get(event, "type")

    already, existing = await claim_event(db, event_id=event_id, event_type=event_type)
    if already and existing and existing.get("status") == "processed":
        return {"status": "already_processed", "eventId": event_id}

    if event_type not in HANDLED_STRIPE_EVENT_TYPES:
        await complete_event(db, event_id, status="ignored")
        return {"status": "ignored", "eventId": event_id}

    user_id: Optional[str] = None
    try:
        if event_type == "checkout.session.completed":
            user_id = await handle_checkout_completed(db, event)
        elif event_type.startswith("customer.subscription."):
            user_id = await handle_subscription_event(db, event)
        elif event_type == "invoice.paid":
            user_id = await handle_invoice_paid(db, event)
        elif event_type == "invoice.payment_failed":
            user_id = await handle_invoice_payment_failed(db, event)

        await complete_event(
            db,
            event_id,
            status="processed",
            user_id=user_id,
        )
        return {"status": "processed", "eventId": event_id, "userId": user_id}
    except Exception as exc:
        logger.exception("Stripe webhook processing failed for %s", event_type)
        await complete_event(
            db,
            event_id,
            status="failed",
            user_id=user_id,
            error=str(exc),
        )
        raise
