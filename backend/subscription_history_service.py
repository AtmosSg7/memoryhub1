"""Append-only subscription event history."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from subscription_constants import COLLECTION_HISTORY, SubscriptionEvent, SubscriptionStatus
from subscription_models import SubscriptionHistoryPublic


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def history_public(doc: dict) -> SubscriptionHistoryPublic:
    return SubscriptionHistoryPublic(
        id=doc["id"],
        subscriptionId=doc["subscriptionId"],
        event=doc["event"],
        previousStatus=doc.get("previousStatus"),
        newStatus=doc["newStatus"],
        previousPlanId=doc.get("previousPlanId"),
        newPlanId=doc.get("newPlanId"),
        label=doc.get("label"),
        metadata=doc.get("metadata"),
        createdAt=doc["createdAt"],
    )


async def find_by_idempotency_key(db, user_id: str, idempotency_key: str) -> Optional[dict]:
    return await db[COLLECTION_HISTORY].find_one(
        {"userId": user_id, "idempotencyKey": idempotency_key},
        {"_id": 0},
    )


async def list_history(
    db,
    user_id: str,
    *,
    limit: int = 50,
    event: Optional[SubscriptionEvent] = None,
) -> tuple[List[SubscriptionHistoryPublic], int]:
    query: Dict[str, Any] = {"userId": user_id}
    if event:
        query["event"] = event
    total = await db[COLLECTION_HISTORY].count_documents(query)
    cursor = (
        db[COLLECTION_HISTORY]
        .find(query, {"_id": 0, "userId": 0, "idempotencyKey": 0})
        .sort("createdAt", -1)
        .limit(limit)
    )
    items = [history_public(doc) async for doc in cursor]
    return items, total


async def append_event(
    db,
    *,
    user_id: str,
    subscription_id: str,
    event: SubscriptionEvent,
    new_status: SubscriptionStatus,
    previous_status: Optional[SubscriptionStatus] = None,
    previous_plan_id: Optional[str] = None,
    new_plan_id: Optional[str] = None,
    label: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    idempotency_key: Optional[str] = None,
) -> SubscriptionHistoryPublic:
    now = _now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "subscriptionId": subscription_id,
        "event": event,
        "previousStatus": previous_status,
        "newStatus": new_status,
        "previousPlanId": previous_plan_id,
        "newPlanId": new_plan_id,
        "label": label,
        "metadata": metadata or {},
        "createdAt": now,
    }
    if idempotency_key:
        doc["idempotencyKey"] = idempotency_key
    await db[COLLECTION_HISTORY].insert_one(doc)
    return history_public(doc)
