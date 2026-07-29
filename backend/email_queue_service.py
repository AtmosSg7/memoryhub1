"""Orchestrates transactional email dispatch, delivery, and retries."""

from __future__ import annotations

import logging
from typing import Optional

from email_constants import (
    EMAIL_STATUS_FAILED,
    EMAIL_STATUS_RETRYING,
    EMAIL_STATUS_SENT,
    EMAIL_STATUS_SKIPPED,
    MAX_EMAIL_ATTEMPTS,
)
from email_event_service import (
    create_pending_event,
    event_to_result,
    fetch_retry_batch,
    find_by_idempotency,
    mark_failed,
    mark_retrying,
    mark_sent,
    mark_skipped,
)
from email_exceptions import EmailValidationError
from email_models import EmailDispatchRequest, EmailDispatchResult, RenderedEmail
from email_provider import get_email_provider, provider_display_name
from email_renderer import render_template
from email_utils import normalize_email

logger = logging.getLogger(__name__)

_SENSITIVE_KEYS = frozenset({"token", "verify_token", "reset_token", "password"})


def _sanitize_render_context(context: dict) -> dict:
    """Persist only non-sensitive fields for retries."""
    safe = {}
    for key, value in (context or {}).items():
        lower = key.lower()
        if any(part in lower for part in _SENSITIVE_KEYS):
            continue
        if isinstance(value, str) and "token=" in value:
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            safe[key] = value
    return safe


def _result_from_event(event: dict, message: str = "") -> EmailDispatchResult:
    return EmailDispatchResult(
        event_id=event["id"],
        status=event["status"],
        delivered=event["status"] == EMAIL_STATUS_SENT,
        message=message,
        provider=event.get("provider"),
        attempts=event.get("attempts", 0),
    )


async def _attempt_delivery(
    db,
    event: dict,
    rendered: RenderedEmail,
) -> EmailDispatchResult:
    provider = get_email_provider()
    attempts = int(event.get("attempts") or 0) + 1
    recipient = event["recipient"]

    result = provider.send(
        to=recipient,
        subject=rendered.subject,
        text_body=rendered.text_body,
        html_body=rendered.html_body,
    )

    if result.success:
        await mark_sent(
            db,
            event["id"],
            provider_message_id=result.provider_message_id,
            attempts=attempts,
        )
        event["status"] = EMAIL_STATUS_SENT
        event["attempts"] = attempts
        return _result_from_event(event, message="sent")

    error_code = result.error_code or "delivery_failed"

    # Console preview — honest skip, not a failure
    if error_code == "preview_only":
        await mark_skipped(db, event["id"], error_code=error_code, attempts=attempts)
        event["status"] = EMAIL_STATUS_SKIPPED
        event["attempts"] = attempts
        return _result_from_event(
            event,
            message="preview_written_not_sent",
        )

    if result.temporary_failure and attempts < MAX_EMAIL_ATTEMPTS:
        await mark_retrying(db, event["id"], error_code=error_code, attempts=attempts)
        event["status"] = EMAIL_STATUS_RETRYING
        event["attempts"] = attempts
        return _result_from_event(event, message="retry_scheduled")

    if attempts >= MAX_EMAIL_ATTEMPTS:
        await mark_failed(db, event["id"], error_code=error_code, attempts=attempts)
        event["status"] = EMAIL_STATUS_FAILED
    else:
        await mark_failed(db, event["id"], error_code=error_code, attempts=attempts)
        event["status"] = EMAIL_STATUS_FAILED

    event["attempts"] = attempts
    return _result_from_event(event, message="delivery_failed")


async def dispatch_email(db, request: EmailDispatchRequest) -> EmailDispatchResult:
    """Render, journal, and deliver a transactional email."""
    if request.idempotency_key:
        existing = await find_by_idempotency(db, request.idempotency_key)
        if existing and existing["status"] in (
            EMAIL_STATUS_SENT,
            EMAIL_STATUS_RETRYING,
            EMAIL_STATUS_SKIPPED,
            "pending",
        ):
            return _result_from_event(existing)

    try:
        recipient = normalize_email(request.to)
    except EmailValidationError:
        raise

    rendered = render_template(
        request.template_key,
        locale=request.locale,
        context=request.context,
    )

    provider_name = provider_display_name()
    event = await create_pending_event(
        db,
        template_key=request.template_key,
        to=recipient,
        subject=rendered.subject,
        locale=request.locale,
        user_id=request.user_id,
        reference_type=request.reference_type,
        reference_id=request.reference_id,
        idempotency_key=request.idempotency_key,
        provider=provider_name,
        render_context=_sanitize_render_context(request.context),
    )

    if request.idempotency_key and event.get("status") == EMAIL_STATUS_SENT:
        return _result_from_event(event)

    return await _attempt_delivery(db, event, rendered)


async def process_pending_email_retries(db, *, limit: int = 50) -> int:
    """Process emails scheduled for retry. Returns count processed."""
    batch = await fetch_retry_batch(db, limit=limit)
    processed = 0
    for event in batch:
        ctx = event.get("renderContext") or {}
        try:
            rendered = render_template(
                event["templateKey"],
                locale=event.get("locale") or "fr",
                context=ctx,
            )
        except Exception:
            logger.exception(
                "Cannot re-render template %s for retry — marking failed.",
                event.get("templateKey"),
            )
            await mark_failed(
                db,
                event["id"],
                error_code="render_failed",
                attempts=int(event.get("attempts") or 0) + 1,
            )
            processed += 1
            continue

        await _attempt_delivery(db, event, rendered)
        processed += 1
    return processed
