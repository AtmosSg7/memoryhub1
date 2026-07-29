"""Stripe webhook event ledger — idempotency and audit."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from stripe_constants import COLLECTION_STRIPE_EVENTS, StripeEventStatus


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_event(db, event_id: str) -> Optional[dict]:
    return await db[COLLECTION_STRIPE_EVENTS].find_one({"eventId": event_id}, {"_id": 0})


async def claim_event(
    db,
    *,
    event_id: str,
    event_type: str,
    user_id: Optional[str] = None,
    subscription_id: Optional[str] = None,
) -> tuple[bool, Optional[dict]]:
    """
    Try to claim an event for processing.

    Returns (already_processed, existing_doc).
    """
    existing = await get_event(db, event_id)
    if existing:
        return True, existing

    doc = {
        "eventId": event_id,
        "eventType": event_type,
        "status": "processing",
        "userId": user_id,
        "subscriptionId": subscription_id,
        "error": None,
        "createdAt": _now_iso(),
        "processedAt": None,
    }
    try:
        await db[COLLECTION_STRIPE_EVENTS].insert_one(doc)
        return False, None
    except Exception:
        existing = await get_event(db, event_id)
        return True, existing


async def complete_event(
    db,
    event_id: str,
    *,
    status: StripeEventStatus,
    user_id: Optional[str] = None,
    subscription_id: Optional[str] = None,
    error: Optional[str] = None,
) -> None:
    await db[COLLECTION_STRIPE_EVENTS].update_one(
        {"eventId": event_id},
        {
            "$set": {
                "status": status,
                "processedAt": _now_iso(),
                "userId": user_id,
                "subscriptionId": subscription_id,
                "error": _sanitize_error(error),
            }
        },
    )


def _sanitize_error(error: Optional[str]) -> Optional[str]:
    if not error:
        return None
    cleaned = str(error).replace("sk_live_", "[redacted]").replace("sk_test_", "[redacted]")
    return cleaned[:500]
