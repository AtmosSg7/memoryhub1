"""Append-only ledger for outbound transactional emails."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from email_constants import (
    COLLECTION_EMAIL_EVENTS,
    EMAIL_STATUS_FAILED,
    EMAIL_STATUS_PENDING,
    EMAIL_STATUS_RETRYING,
    EMAIL_STATUS_SENT,
    EMAIL_STATUS_SKIPPED,
    MAX_EMAIL_ATTEMPTS,
    RETRY_BACKOFF_SECONDS,
)
from email_utils import hash_recipient, normalize_email, sanitize_subject

COLLECTION = COLLECTION_EMAIL_EVENTS


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _next_retry_at(attempts: int) -> Optional[str]:
    if attempts >= MAX_EMAIL_ATTEMPTS:
        return None
    idx = min(attempts, len(RETRY_BACKOFF_SECONDS) - 1)
    delay = RETRY_BACKOFF_SECONDS[idx]
    if delay <= 0:
        return _utc_now()
    from datetime import timedelta

    return (datetime.now(timezone.utc) + timedelta(seconds=delay)).isoformat()


async def find_by_idempotency(db, idempotency_key: str) -> Optional[dict]:
    if not idempotency_key:
        return None
    return await db[COLLECTION].find_one({"idempotencyKey": idempotency_key}, {"_id": 0})


async def create_pending_event(
    db,
    *,
    template_key: str,
    to: str,
    subject: str,
    locale: str,
    user_id: Optional[str] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    provider: str,
    render_context: Optional[dict] = None,
) -> dict:
    recipient = normalize_email(to)
    now = _utc_now()
    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "recipient": recipient,
        "recipientHash": hash_recipient(recipient),
        "templateKey": template_key,
        "subject": sanitize_subject(subject),
        "locale": locale,
        "status": EMAIL_STATUS_PENDING,
        "provider": provider,
        "providerMessageId": None,
        "referenceType": reference_type,
        "referenceId": reference_id,
        "idempotencyKey": idempotency_key,
        "renderContext": render_context or {},
        "attempts": 0,
        "lastErrorCode": None,
        "nextRetryAt": now,
        "sentAt": None,
        "createdAt": now,
        "updatedAt": now,
    }
    if idempotency_key:
        existing = await find_by_idempotency(db, idempotency_key)
        if existing:
            return existing
        try:
            await db[COLLECTION].insert_one(doc)
            doc.pop("_id", None)
            return doc
        except Exception:
            existing = await find_by_idempotency(db, idempotency_key)
            if existing:
                return existing
            raise
    await db[COLLECTION].insert_one(doc)
    doc.pop("_id", None)
    return doc


async def mark_sent(
    db,
    event_id: str,
    *,
    provider_message_id: Optional[str] = None,
    attempts: int,
) -> None:
    now = _utc_now()
    await db[COLLECTION].update_one(
        {"id": event_id},
        {
            "$set": {
                "status": EMAIL_STATUS_SENT,
                "providerMessageId": provider_message_id,
                "attempts": attempts,
                "sentAt": now,
                "updatedAt": now,
                "lastErrorCode": None,
                "nextRetryAt": None,
            }
        },
    )


async def mark_skipped(
    db,
    event_id: str,
    *,
    error_code: str,
    attempts: int,
) -> None:
    await db[COLLECTION].update_one(
        {"id": event_id},
        {
            "$set": {
                "status": EMAIL_STATUS_SKIPPED,
                "lastErrorCode": error_code,
                "attempts": attempts,
                "updatedAt": _utc_now(),
                "nextRetryAt": None,
            }
        },
    )


async def mark_retrying(
    db,
    event_id: str,
    *,
    error_code: str,
    attempts: int,
) -> None:
    next_at = _next_retry_at(attempts)
    status = EMAIL_STATUS_FAILED if next_at is None else EMAIL_STATUS_RETRYING
    await db[COLLECTION].update_one(
        {"id": event_id},
        {
            "$set": {
                "status": status,
                "lastErrorCode": error_code,
                "attempts": attempts,
                "nextRetryAt": next_at,
                "updatedAt": _utc_now(),
            }
        },
    )


async def mark_failed(
    db,
    event_id: str,
    *,
    error_code: str,
    attempts: int,
) -> None:
    await db[COLLECTION].update_one(
        {"id": event_id},
        {
            "$set": {
                "status": EMAIL_STATUS_FAILED,
                "lastErrorCode": error_code,
                "attempts": attempts,
                "nextRetryAt": None,
                "updatedAt": _utc_now(),
            }
        },
    )


async def fetch_retry_batch(db, *, limit: int = 50) -> list[dict]:
    now = _utc_now()
    cursor = db[COLLECTION].find(
        {
            "status": EMAIL_STATUS_RETRYING,
            "nextRetryAt": {"$lte": now},
            "attempts": {"$lt": MAX_EMAIL_ATTEMPTS},
        },
        {"_id": 0},
    ).sort("nextRetryAt", 1).limit(limit)
    return [doc async for doc in cursor]


def event_to_result(event: dict) -> Dict[str, Any]:
    return {
        "event_id": event["id"],
        "status": event["status"],
        "delivered": event["status"] == EMAIL_STATUS_SENT,
        "provider": event.get("provider"),
        "attempts": event.get("attempts", 0),
    }
