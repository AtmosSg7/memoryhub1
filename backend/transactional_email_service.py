"""High-level transactional email API for business services."""

from __future__ import annotations

from typing import Optional

from email_constants import (
    TEMPLATE_EMAIL_VERIFICATION,
    TEMPLATE_INVOICE_FOLLOW_UP,
    TEMPLATE_INVOICE_SENT,
    TEMPLATE_PASSWORD_CHANGED,
    TEMPLATE_PASSWORD_RESET,
    TEMPLATE_PAYMENT_RECORDED,
    TEMPLATE_PORTAL_ACCESS,
    TEMPLATE_QUOTE_ACCEPTED,
    TEMPLATE_QUOTE_FOLLOW_UP,
    TEMPLATE_QUOTE_REJECTED,
    TEMPLATE_QUOTE_SENT,
    TEMPLATE_SUBSCRIPTION_ACTIVATED,
    TEMPLATE_SUBSCRIPTION_CANCELLATION_SCHEDULED,
    TEMPLATE_SUBSCRIPTION_CANCELLED,
    TEMPLATE_SUBSCRIPTION_EXPIRED,
    TEMPLATE_SUBSCRIPTION_PAYMENT_FAILED,
    TEMPLATE_SUBSCRIPTION_PLAN_CHANGED,
    TEMPLATE_SUBSCRIPTION_REACTIVATED,
    TEMPLATE_SUBSCRIPTION_RENEWED,
    TEMPLATE_SUBSCRIPTION_TRIAL_STARTED,
    TEMPLATE_WELCOME,
)
from email_models import EmailDispatchRequest, EmailDispatchResult
from email_queue_service import dispatch_email
from email_templates import EmailLang
from email_utils import frontend_public_url


async def resolve_user_locale(db, user_id: str) -> EmailLang:
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "locale": 1, "language": 1})
    if not user:
        return "fr"
    loc = user.get("locale") or user.get("language")
    return "en" if loc == "en" else "fr"


async def resolve_artisan_locale(db, user_id: str) -> EmailLang:
    return await resolve_user_locale(db, user_id)


async def send_verification_email(
    db,
    *,
    user_id: str,
    to: str,
    greeting: str,
    verify_token: str,
    locale: Optional[EmailLang] = None,
) -> EmailDispatchResult:
    lang = locale or "fr"
    verify_url = frontend_public_url(f"/verify-email?token={verify_token}")
    return await dispatch_email(
        db,
        EmailDispatchRequest(
            template_key=TEMPLATE_EMAIL_VERIFICATION,
            to=to,
            locale=lang,
            user_id=user_id,
            reference_type="user",
            reference_id=user_id,
            idempotency_key=f"verify:{user_id}:{verify_token[:8]}",
            context={"greeting": greeting, "verify_url": verify_url},
        ),
    )


async def send_password_reset_email(
    db,
    *,
    user_id: str,
    to: str,
    greeting: str,
    reset_token: str,
    locale: Optional[EmailLang] = None,
) -> EmailDispatchResult:
    lang = locale or "fr"
    reset_url = frontend_public_url(f"/reset-password?token={reset_token}")
    return await dispatch_email(
        db,
        EmailDispatchRequest(
            template_key=TEMPLATE_PASSWORD_RESET,
            to=to,
            locale=lang,
            user_id=user_id,
            reference_type="user",
            reference_id=user_id,
            idempotency_key=f"reset:{user_id}:{reset_token[:8]}",
            context={"greeting": greeting, "reset_url": reset_url},
        ),
    )


async def send_password_changed_email(
    db,
    *,
    user_id: str,
    to: str,
    greeting: str,
    locale: Optional[EmailLang] = None,
) -> EmailDispatchResult:
    lang = locale or await resolve_user_locale(db, user_id)
    return await dispatch_email(
        db,
        EmailDispatchRequest(
            template_key=TEMPLATE_PASSWORD_CHANGED,
            to=to,
            locale=lang,
            user_id=user_id,
            reference_type="user",
            reference_id=user_id,
            idempotency_key=f"pwd-changed:{user_id}",
            context={"greeting": greeting},
        ),
    )


async def send_welcome_email(
    db,
    *,
    user_id: str,
    to: str,
    greeting: str,
    locale: Optional[EmailLang] = None,
) -> EmailDispatchResult:
    lang = locale or await resolve_user_locale(db, user_id)
    return await dispatch_email(
        db,
        EmailDispatchRequest(
            template_key=TEMPLATE_WELCOME,
            to=to,
            locale=lang,
            user_id=user_id,
            reference_type="user",
            reference_id=user_id,
            idempotency_key=f"welcome:{user_id}",
            context={"greeting": greeting},
        ),
    )


async def send_subscription_email(
    db,
    *,
    template_key: str,
    user_id: str,
    to: str,
    greeting: str,
    plan_name: str,
    locale: Optional[EmailLang] = None,
    idempotency_key: str,
    period_end: Optional[str] = None,
    billing_url: Optional[str] = None,
) -> EmailDispatchResult:
    lang = locale or await resolve_user_locale(db, user_id)
    context = {"greeting": greeting, "plan_name": plan_name}
    if period_end:
        context["period_end"] = period_end
    if billing_url:
        context["billing_url"] = billing_url
    elif template_key == TEMPLATE_SUBSCRIPTION_PAYMENT_FAILED:
        context["billing_url"] = frontend_public_url("/dashboard/billing")

    return await dispatch_email(
        db,
        EmailDispatchRequest(
            template_key=template_key,
            to=to,
            locale=lang,
            user_id=user_id,
            reference_type="subscription",
            reference_id=user_id,
            idempotency_key=idempotency_key,
            context=context,
        ),
    )


async def send_quote_email(
    db,
    *,
    user_id: str,
    to: str,
    greeting: str,
    number: str,
    title: str,
    amount_ttc: int,
    sender_name: str,
    portal_url: Optional[str],
    locale: EmailLang,
    entity_id: str,
    idempotency_key: str,
    status: str = "sent",
) -> EmailDispatchResult:
    return await dispatch_email(
        db,
        EmailDispatchRequest(
            template_key=TEMPLATE_QUOTE_SENT,
            to=to,
            locale=locale,
            user_id=user_id,
            reference_type="quote",
            reference_id=entity_id,
            idempotency_key=idempotency_key,
            context={
                "greeting": greeting,
                "number": number,
                "title": title,
                "amount_ttc": amount_ttc,
                "sender_name": sender_name,
                "portal_url": portal_url,
                "status": status,
            },
        ),
    )


async def send_invoice_email(
    db,
    *,
    user_id: str,
    to: str,
    greeting: str,
    number: str,
    amount_ttc: int,
    amount_due: int,
    sender_name: str,
    portal_url: Optional[str],
    locale: EmailLang,
    entity_id: str,
    idempotency_key: str,
) -> EmailDispatchResult:
    return await dispatch_email(
        db,
        EmailDispatchRequest(
            template_key=TEMPLATE_INVOICE_SENT,
            to=to,
            locale=locale,
            user_id=user_id,
            reference_type="invoice",
            reference_id=entity_id,
            idempotency_key=idempotency_key,
            context={
                "greeting": greeting,
                "number": number,
                "amount_ttc": amount_ttc,
                "amount_due": amount_due,
                "sender_name": sender_name,
                "portal_url": portal_url,
            },
        ),
    )


async def send_portal_access_email(
    db,
    *,
    user_id: str,
    to: str,
    greeting: str,
    sender_name: str,
    portal_url: str,
    locale: EmailLang,
    client_id: str,
    idempotency_key: str,
) -> EmailDispatchResult:
    return await dispatch_email(
        db,
        EmailDispatchRequest(
            template_key=TEMPLATE_PORTAL_ACCESS,
            to=to,
            locale=locale,
            user_id=user_id,
            reference_type="client",
            reference_id=client_id,
            idempotency_key=idempotency_key,
            context={
                "greeting": greeting,
                "sender_name": sender_name,
                "portal_url": portal_url,
            },
        ),
    )


async def send_quote_accepted_email(
    db,
    *,
    user_id: str,
    to: str,
    greeting: str,
    client_name: str,
    number: str,
    amount_ttc: int,
    quote_id: str,
    idempotency_key: str,
    locale: Optional[EmailLang] = None,
) -> EmailDispatchResult:
    lang = locale or await resolve_user_locale(db, user_id)
    return await dispatch_email(
        db,
        EmailDispatchRequest(
            template_key=TEMPLATE_QUOTE_ACCEPTED,
            to=to,
            locale=lang,
            user_id=user_id,
            reference_type="quote",
            reference_id=quote_id,
            idempotency_key=idempotency_key,
            context={
                "greeting": greeting,
                "client_name": client_name,
                "number": number,
                "amount_ttc": amount_ttc,
            },
        ),
    )


async def send_quote_rejected_email(
    db,
    *,
    user_id: str,
    to: str,
    greeting: str,
    client_name: str,
    number: str,
    amount_ttc: int,
    quote_id: str,
    idempotency_key: str,
    locale: Optional[EmailLang] = None,
) -> EmailDispatchResult:
    lang = locale or await resolve_user_locale(db, user_id)
    return await dispatch_email(
        db,
        EmailDispatchRequest(
            template_key=TEMPLATE_QUOTE_REJECTED,
            to=to,
            locale=lang,
            user_id=user_id,
            reference_type="quote",
            reference_id=quote_id,
            idempotency_key=idempotency_key,
            context={
                "greeting": greeting,
                "client_name": client_name,
                "number": number,
                "amount_ttc": amount_ttc,
            },
        ),
    )


async def notify_artisan_quote_decision(
    db,
    *,
    user_id: str,
    quote: dict,
    accepted: bool,
) -> None:
    """Notify the artisan when a quote is accepted or rejected (idempotent)."""
    from observability import get_logger

    logger = get_logger(__name__)
    quote_id = quote.get("id") or ""
    if not quote_id:
        return

    owner = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "email": 1, "firstName": 1, "companyName": 1},
    )
    if not owner or not owner.get("email"):
        return

    greeting = (owner.get("firstName") or owner.get("companyName") or "").strip() or "there"
    locale = await resolve_user_locale(db, user_id)
    client_name = quote.get("clientName") or ""
    number = quote.get("number", "")
    amount_ttc = int(quote.get("amountTTC") or 0)
    common = {
        "db": db,
        "user_id": user_id,
        "to": owner["email"],
        "greeting": greeting,
        "client_name": client_name,
        "number": number,
        "amount_ttc": amount_ttc,
        "quote_id": quote_id,
        "locale": locale,
    }
    try:
        if accepted:
            await send_quote_accepted_email(
                **common,
                idempotency_key=f"quote-accepted:{quote_id}",
            )
        else:
            await send_quote_rejected_email(
                **common,
                idempotency_key=f"quote-rejected:{quote_id}",
            )
    except Exception:
        action = "accepted" if accepted else "rejected"
        logger.exception(
            "Failed to send quote %s email for quote %s (user %s)",
            action,
            quote_id,
            user_id,
        )


async def send_quote_follow_up_email(
    db,
    *,
    user_id: str,
    to: str,
    greeting: str,
    number: str,
    title: str,
    amount_ttc: int,
    sender_name: str,
    portal_url: Optional[str],
    locale: EmailLang,
    quote_id: str,
    idempotency_key: str,
) -> EmailDispatchResult:
    return await dispatch_email(
        db,
        EmailDispatchRequest(
            template_key=TEMPLATE_QUOTE_FOLLOW_UP,
            to=to,
            locale=locale,
            user_id=user_id,
            reference_type="quote",
            reference_id=quote_id,
            idempotency_key=idempotency_key,
            context={
                "greeting": greeting,
                "number": number,
                "title": title,
                "amount_ttc": amount_ttc,
                "sender_name": sender_name,
                "portal_url": portal_url,
            },
        ),
    )


async def send_invoice_follow_up_email(
    db,
    *,
    user_id: str,
    to: str,
    greeting: str,
    number: str,
    amount_ttc: int,
    amount_due: int,
    sender_name: str,
    locale: EmailLang,
    invoice_id: str,
    idempotency_key: str,
) -> EmailDispatchResult:
    return await dispatch_email(
        db,
        EmailDispatchRequest(
            template_key=TEMPLATE_INVOICE_FOLLOW_UP,
            to=to,
            locale=locale,
            user_id=user_id,
            reference_type="invoice",
            reference_id=invoice_id,
            idempotency_key=idempotency_key,
            context={
                "greeting": greeting,
                "number": number,
                "amount_ttc": amount_ttc,
                "amount_due": amount_due,
                "sender_name": sender_name,
            },
        ),
    )


async def send_payment_recorded_email(
    db,
    *,
    user_id: str,
    to: str,
    greeting: str,
    number: str,
    amount: int,
    amount_due: int,
    invoice_id: str,
    portal_url: Optional[str],
    locale: EmailLang,
    idempotency_key: str,
) -> EmailDispatchResult:
    return await dispatch_email(
        db,
        EmailDispatchRequest(
            template_key=TEMPLATE_PAYMENT_RECORDED,
            to=to,
            locale=locale,
            user_id=user_id,
            reference_type="invoice",
            reference_id=invoice_id,
            idempotency_key=idempotency_key,
            context={
                "greeting": greeting,
                "number": number,
                "amount": amount,
                "amount_due": amount_due,
                "portal_url": portal_url,
            },
        ),
    )


# Re-export template keys for Stripe hooks
SUBSCRIPTION_TEMPLATE_KEYS = {
    "trial": TEMPLATE_SUBSCRIPTION_TRIAL_STARTED,
    "activated": TEMPLATE_SUBSCRIPTION_ACTIVATED,
    "renewed": TEMPLATE_SUBSCRIPTION_RENEWED,
    "plan_changed": TEMPLATE_SUBSCRIPTION_PLAN_CHANGED,
    "cancellation_scheduled": TEMPLATE_SUBSCRIPTION_CANCELLATION_SCHEDULED,
    "cancelled": TEMPLATE_SUBSCRIPTION_CANCELLED,
    "reactivated": TEMPLATE_SUBSCRIPTION_REACTIVATED,
    "payment_failed": TEMPLATE_SUBSCRIPTION_PAYMENT_FAILED,
    "expired": TEMPLATE_SUBSCRIPTION_EXPIRED,
}
