"""
Stripe API layer — customers, checkout, portal, subscription changes.

No MemoryHub business logic here. Injectable backend for tests.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional, Protocol

from stripe_config import StripeSettings, plan_to_price_id, require_stripe_settings
from stripe_exceptions import StripeCheckoutError, StripeCustomerError
from subscription_constants import TRIAL_DAYS

logger = logging.getLogger(__name__)


@dataclass
class StripeCheckoutResult:
    session_id: str
    url: str


@dataclass
class StripePortalResult:
    url: str


class StripeBackend(Protocol):
    def create_customer(
        self,
        *,
        email: str,
        name: str,
        metadata: Dict[str, str],
    ) -> Any: ...

    def retrieve_customer(self, customer_id: str) -> Any: ...

    def create_checkout_session(
        self,
        *,
        customer_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        metadata: Dict[str, str],
        trial_period_days: Optional[int] = None,
        mode: str = "subscription",
    ) -> Any: ...

    def create_payment_checkout_session(
        self,
        *,
        customer_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        metadata: Dict[str, str],
    ) -> Any: ...

    def create_portal_session(
        self,
        *,
        customer_id: str,
        return_url: str,
    ) -> Any: ...

    def retrieve_subscription(self, subscription_id: str) -> Any: ...

    def modify_subscription_price(
        self,
        subscription_id: str,
        *,
        item_id: str,
        price_id: str,
        proration_behavior: str,
    ) -> Any: ...

    def schedule_downgrade_at_period_end(
        self,
        subscription_id: str,
        *,
        item_id: str,
        current_price_id: str,
        new_price_id: str,
        period_end_ts: int,
    ) -> Any: ...

    def construct_webhook_event(
        self,
        payload: bytes,
        sig_header: str,
        webhook_secret: str,
    ) -> Any: ...


class LiveStripeBackend:
    def __init__(self, secret_key: str):
        import stripe

        stripe.api_key = secret_key
        self._stripe = stripe

    def create_customer(self, *, email: str, name: str, metadata: Dict[str, str]) -> Any:
        return self._stripe.Customer.create(email=email, name=name, metadata=metadata)

    def retrieve_customer(self, customer_id: str) -> Any:
        return self._stripe.Customer.retrieve(customer_id)

    def create_checkout_session(
        self,
        *,
        customer_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        metadata: Dict[str, str],
        trial_period_days: Optional[int] = None,
        mode: str = "subscription",
    ) -> Any:
        if mode == "payment":
            return self.create_payment_checkout_session(
                customer_id=customer_id,
                price_id=price_id,
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata,
            )
        subscription_data: Dict[str, Any] = {"metadata": metadata}
        if trial_period_days:
            subscription_data["trial_period_days"] = trial_period_days
        return self._stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
            subscription_data=subscription_data,
            allow_promotion_codes=False,
        )

    def create_payment_checkout_session(
        self,
        *,
        customer_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        metadata: Dict[str, str],
    ) -> Any:
        return self._stripe.checkout.Session.create(
            mode="payment",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
            allow_promotion_codes=False,
        )

    def create_portal_session(self, *, customer_id: str, return_url: str) -> Any:
        return self._stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )

    def retrieve_subscription(self, subscription_id: str) -> Any:
        return self._stripe.Subscription.retrieve(subscription_id)

    def modify_subscription_price(
        self,
        subscription_id: str,
        *,
        item_id: str,
        price_id: str,
        proration_behavior: str,
    ) -> Any:
        return self._stripe.Subscription.modify(
            subscription_id,
            items=[{"id": item_id, "price": price_id}],
            proration_behavior=proration_behavior,
        )

    def schedule_downgrade_at_period_end(
        self,
        subscription_id: str,
        *,
        item_id: str,
        current_price_id: str,
        new_price_id: str,
        period_end_ts: int,
    ) -> Any:
        return self._stripe.SubscriptionSchedule.create(
            from_subscription=subscription_id,
            phases=[
                {
                    "items": [{"price": current_price_id, "quantity": 1}],
                    "end_date": period_end_ts,
                },
                {
                    "items": [{"price": new_price_id, "quantity": 1}],
                },
            ],
        )

    def construct_webhook_event(
        self,
        payload: bytes,
        sig_header: str,
        webhook_secret: str,
    ) -> Any:
        return self._stripe.Webhook.construct_event(payload, sig_header, webhook_secret)


_backend: Optional[StripeBackend] = None


def get_stripe_backend() -> StripeBackend:
    global _backend
    if _backend is None:
        settings = require_stripe_settings()
        _backend = LiveStripeBackend(settings.secret_key)
    return _backend


def set_stripe_backend(backend: Optional[StripeBackend]) -> None:
    global _backend
    _backend = backend


def _is_missing_customer_error(exc: BaseException) -> bool:
    """True when Stripe reports the Customer id no longer exists."""
    code = getattr(exc, "code", None)
    if code == "resource_missing":
        return True
    http_status = getattr(exc, "http_status", None)
    if http_status == 404:
        param = getattr(exc, "param", None)
        if param in {None, "id", "customer"}:
            msg = str(exc).lower()
            if "customer" in msg or "no such" in msg:
                return True
    json_body = getattr(exc, "json_body", None) or {}
    if isinstance(json_body, dict):
        error = json_body.get("error") or {}
        if isinstance(error, dict) and error.get("code") == "resource_missing":
            return True
    msg = str(exc).lower()
    return "no such customer" in msg or "resource_missing" in msg


def _now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


async def _clear_stale_stripe_customer_id(db, user: dict, stale_id: str) -> None:
    await db.users.update_one(
        {"id": user["id"]},
        {"$unset": {"stripeCustomerId": ""}, "$set": {"updatedAt": _now_iso()}},
    )
    if user.get("stripeCustomerId") == stale_id:
        user.pop("stripeCustomerId", None)
    logger.warning(
        "Cleared stale stripeCustomerId=%s for user=%s (missing in Stripe)",
        stale_id,
        user.get("id"),
    )


async def _create_and_store_customer(
    db,
    user: dict,
    *,
    backend: StripeBackend,
) -> str:
    name = (
        f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
        or user.get("companyName", "Basera user")
    )
    try:
        customer = backend.create_customer(
            email=user["email"],
            name=name,
            metadata={"userId": user["id"]},
        )
    except Exception as exc:
        raise StripeCustomerError("Unable to create Stripe customer.") from exc

    customer_id = customer.id if hasattr(customer, "id") else customer["id"]
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"stripeCustomerId": customer_id, "updatedAt": _now_iso()}},
    )
    user["stripeCustomerId"] = customer_id
    return customer_id


async def get_or_create_customer_id(
    db,
    user: dict,
    *,
    backend: Optional[StripeBackend] = None,
) -> str:
    """Return a valid Stripe customer id, recreating it if the stored one was deleted."""
    backend = backend or get_stripe_backend()
    existing = user.get("stripeCustomerId")
    if existing:
        try:
            backend.retrieve_customer(existing)
            return existing
        except Exception as exc:
            if not _is_missing_customer_error(exc):
                raise StripeCustomerError("Unable to verify Stripe customer.") from exc
            await _clear_stale_stripe_customer_id(db, user, existing)

    return await _create_and_store_customer(db, user, backend=backend)


async def _checkout_with_valid_customer(
    db,
    user: dict,
    *,
    backend: StripeBackend,
    create_session,
) -> Any:
    """Create a Checkout session; recreate Customer once if Stripe says it is missing."""
    customer_id = await get_or_create_customer_id(db, user, backend=backend)
    try:
        return create_session(customer_id)
    except Exception as exc:
        if not _is_missing_customer_error(exc):
            raise
        await _clear_stale_stripe_customer_id(db, user, customer_id)
        customer_id = await get_or_create_customer_id(db, user, backend=backend)
        return create_session(customer_id)


async def create_subscription_checkout(
    db,
    user: dict,
    plan_id: str,
    *,
    include_trial: bool,
    backend: Optional[StripeBackend] = None,
) -> StripeCheckoutResult:
    settings = require_stripe_settings()
    backend = backend or get_stripe_backend()
    price_id = plan_to_price_id(plan_id)

    metadata = {"userId": user["id"], "planId": plan_id}
    trial_days = TRIAL_DAYS if include_trial else None

    try:
        session = await _checkout_with_valid_customer(
            db,
            user,
            backend=backend,
            create_session=lambda customer_id: backend.create_checkout_session(
                customer_id=customer_id,
                price_id=price_id,
                success_url=settings.success_url,
                cancel_url=settings.cancel_url,
                metadata=metadata,
                trial_period_days=trial_days,
            ),
        )
    except StripeCustomerError:
        raise
    except Exception as exc:
        raise StripeCheckoutError("Unable to create Stripe Checkout session.") from exc

    session_id = session.id if hasattr(session, "id") else session["id"]
    url = session.url if hasattr(session, "url") else session["url"]
    if not url:
        raise StripeCheckoutError("Stripe Checkout session has no URL.")
    return StripeCheckoutResult(session_id=session_id, url=url)


async def create_credit_pack_checkout(
    db,
    user: dict,
    pack_key: str,
    *,
    purchase_id: str,
    backend: Optional[StripeBackend] = None,
) -> StripeCheckoutResult:
    from credit_pack_service import get_pack_doc, pack_stripe_price_id
    from credit_exceptions import CreditPackNotFoundError

    settings = require_stripe_settings()
    backend = backend or get_stripe_backend()
    pack_doc = await get_pack_doc(db, pack_key)
    price_id = pack_stripe_price_id(pack_doc)
    if not price_id:
        raise StripeCheckoutError("Stripe price is not configured for this credit pack.")

    metadata = {
        "userId": user["id"],
        "packKey": pack_key,
        "purchaseId": purchase_id,
        "purchaseType": "credit_pack",
    }

    success_url = settings.success_url.replace("checkout=success", "credits=success")
    if "credits=" not in success_url:
        sep = "&" if "?" in success_url else "?"
        success_url = f"{success_url}{sep}credits=success"
    cancel_url = settings.cancel_url.replace("checkout=cancel", "credits=cancel")
    if "credits=" not in cancel_url:
        sep = "&" if "?" in cancel_url else "?"
        cancel_url = f"{cancel_url}{sep}credits=cancel"

    try:
        session = await _checkout_with_valid_customer(
            db,
            user,
            backend=backend,
            create_session=lambda customer_id: backend.create_payment_checkout_session(
                customer_id=customer_id,
                price_id=price_id,
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata,
            ),
        )
    except StripeCustomerError:
        raise
    except Exception as exc:
        raise StripeCheckoutError("Unable to create Stripe Checkout session for credits.") from exc

    session_id = session.id if hasattr(session, "id") else session["id"]
    url = session.url if hasattr(session, "url") else session["url"]
    if not url:
        raise StripeCheckoutError("Stripe Checkout session has no URL.")
    return StripeCheckoutResult(session_id=session_id, url=url)


async def create_customer_portal(
    db,
    user: dict,
    *,
    return_url: Optional[str] = None,
    backend: Optional[StripeBackend] = None,
) -> StripePortalResult:
    settings = require_stripe_settings()
    backend = backend or get_stripe_backend()
    # Always validate / recreate — stored customer may have been deleted in Stripe.
    customer_id = await get_or_create_customer_id(db, user, backend=backend)

    url = return_url or settings.success_url.rsplit("?", 1)[0]
    try:
        session = backend.create_portal_session(customer_id=customer_id, return_url=url)
    except Exception as exc:
        if _is_missing_customer_error(exc):
            await _clear_stale_stripe_customer_id(db, user, customer_id)
            customer_id = await get_or_create_customer_id(db, user, backend=backend)
            try:
                session = backend.create_portal_session(customer_id=customer_id, return_url=url)
            except Exception as retry_exc:
                raise StripeCheckoutError("Unable to open Stripe Customer Portal.") from retry_exc
        else:
            raise StripeCheckoutError("Unable to open Stripe Customer Portal.") from exc

    portal_url = session.url if hasattr(session, "url") else session["url"]
    return StripePortalResult(url=portal_url)


async def change_stripe_subscription_plan(
    db,
    user_id: str,
    subscription_doc: dict,
    new_plan_id: str,
    *,
    is_upgrade: bool,
    backend: Optional[StripeBackend] = None,
) -> str:
    """Change Stripe subscription price. Returns effective timing."""
    backend = backend or get_stripe_backend()
    stripe_sub_id = subscription_doc.get("stripeSubscriptionId")
    if not stripe_sub_id:
        raise StripeCheckoutError("No Stripe subscription linked.")

    stripe_sub = backend.retrieve_subscription(stripe_sub_id)
    items = stripe_sub.get("items", {}).get("data", []) if isinstance(stripe_sub, dict) else stripe_sub["items"]["data"]
    if not items:
        raise StripeCheckoutError("Stripe subscription has no items.")

    item_id = items[0]["id"]
    current_price_id = items[0]["price"]["id"]
    new_price_id = plan_to_price_id(new_plan_id)

    if is_upgrade:
        backend.modify_subscription_price(
            stripe_sub_id,
            item_id=item_id,
            price_id=new_price_id,
            proration_behavior="create_prorations",
        )
        return "immediate"

    # Basil+: current_period_end lives on SubscriptionItem, not Subscription.
    if isinstance(stripe_sub, dict):
        period_end_ts = stripe_sub.get("current_period_end")
    else:
        period_end_ts = getattr(stripe_sub, "current_period_end", None)
    if period_end_ts is None:
        first = items[0]
        period_end_ts = (
            first.get("current_period_end")
            if isinstance(first, dict)
            else getattr(first, "current_period_end", None)
        )
    if period_end_ts is None:
        raise StripeCheckoutError("Stripe subscription has no current_period_end.")
    backend.schedule_downgrade_at_period_end(
        stripe_sub_id,
        item_id=item_id,
        current_price_id=current_price_id,
        new_price_id=new_price_id,
        period_end_ts=int(period_end_ts),
    )
    return "next_period"
