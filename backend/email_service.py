"""Outbound email delivery — orchestration layer (provider-agnostic)."""

from __future__ import annotations

from email_models import EmailDispatchResult
from email_provider import is_smtp_configured
from email_utils import frontend_public_url

# Backward-compatible URL helper
build_frontend_url = frontend_public_url


async def send_email(
    db,
    *,
    to: str,
    subject: str,
    body: str,
    user_id: str | None = None,
) -> EmailDispatchResult:
    """Legacy plain-text send — prefer transactional_email_service templates."""
    from email_constants import TEMPLATE_WELCOME
    from email_layout import render_email_layout
    from email_models import EmailDispatchRequest, RenderedEmail
    from email_queue_service import dispatch_email

    html = render_email_layout(
        locale="fr",
        title=subject,
        preheader=subject,
        body_html=f"<p>{body}</p>",
    )
    rendered = RenderedEmail(subject=subject, preheader=subject, text_body=body, html_body=html)
    # Direct dispatch bypasses template registry — use internal attempt only for legacy callers.
    from email_event_service import create_pending_event
    from email_provider import provider_display_name
    from email_queue_service import _attempt_delivery
    from email_utils import normalize_email

    recipient = normalize_email(to)
    event = await create_pending_event(
        db,
        template_key="legacy_plain",
        to=recipient,
        subject=subject,
        locale="fr",
        user_id=user_id,
        provider=provider_display_name(),
        render_context={"body": body},
    )
    return await _attempt_delivery(db, event, rendered)


def is_email_configured() -> bool:
    return is_smtp_configured()


async def send_password_reset_email(
    db,
    *,
    user_id: str,
    to: str,
    greeting: str,
    reset_token: str,
    lang: str = "fr",
) -> EmailDispatchResult:
    from transactional_email_service import send_password_reset_email as _send

    return await _send(
        db,
        user_id=user_id,
        to=to,
        greeting=greeting,
        reset_token=reset_token,
        locale="en" if lang == "en" else "fr",
    )


async def send_verification_email(
    db,
    *,
    user_id: str,
    to: str,
    greeting: str,
    verify_token: str,
    lang: str = "fr",
) -> EmailDispatchResult:
    from transactional_email_service import send_verification_email as _send

    return await _send(
        db,
        user_id=user_id,
        to=to,
        greeting=greeting,
        verify_token=verify_token,
        locale="en" if lang == "en" else "fr",
    )
