"""Action Engine query / lifecycle service."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from action_engine.constants import (
    ACTION_STATUS_COMPLETED,
    ACTION_STATUS_DISMISSED,
    ACTION_STATUS_PENDING,
    ACTION_STATUSES,
)
from action_engine.engine import action_public
from action_engine.models import ActionListResponse, ActionPublic


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_now_iso() -> str:
    return _utc_now().isoformat()


def _iso_z(dt: datetime) -> str:
    """Stable UTC ISO for lexicographic Mongo comparisons (no fractional seconds)."""
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value or not str(value).strip():
        return None
    try:
        dt = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _ts(value: Optional[str]) -> float:
    dt = _parse_iso(value)
    return dt.timestamp() if dt else 0.0


_PRIORITY_RANK = {"urgent": 0, "high": 1, "normal": 2, "low": 3}


def _active_pending_clause(now_iso: Optional[str] = None) -> Dict[str, Any]:
    """Pending actions that are not currently snoozed (filter at read time)."""
    now = now_iso or _iso_z(_utc_now())
    return {
        "$or": [
            {"snoozedUntil": {"$exists": False}},
            {"snoozedUntil": None},
            {"snoozedUntil": ""},
            {"snoozedUntil": {"$lte": now}},
        ]
    }


def _snoozed_only_clause(now_iso: Optional[str] = None) -> Dict[str, Any]:
    now = now_iso or _iso_z(_utc_now())
    return {"snoozedUntil": {"$gt": now}}


async def list_actions(
    db,
    user_id: str,
    *,
    status: str = ACTION_STATUS_PENDING,
    action_type: Optional[str] = None,
    client_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    include_snoozed: bool = False,
    snoozed_only: bool = False,
) -> ActionListResponse:
    limit = max(1, min(int(limit), 100))
    offset = max(0, int(offset))
    now_iso = _iso_z(_utc_now())
    query: dict = {"userId": user_id}
    if status and status != "all":
        if status not in ACTION_STATUSES:
            status = ACTION_STATUS_PENDING
        query["status"] = status
    if action_type:
        query["type"] = action_type
    if client_id:
        query["clientId"] = client_id

    # Default: active work queue excludes future snoozes.
    if snoozed_only:
        query.update(_snoozed_only_clause(now_iso))
        if "status" not in query:
            query["status"] = ACTION_STATUS_PENDING
    elif not include_snoozed and (not status or status == ACTION_STATUS_PENDING):
        query.update(_active_pending_clause(now_iso))

    total = await db.actions.count_documents(query)
    fetch_limit = min(500, offset + limit)
    cursor = db.actions.find(query, {"_id": 0}).sort("createdAt", -1).limit(fetch_limit)
    docs = [doc async for doc in cursor]
    docs.sort(
        key=lambda d: (
            _PRIORITY_RANK.get(d.get("priority") or "normal", 9),
            -_ts(d.get("createdAt")),
        )
    )
    page = docs[offset : offset + limit]
    items = [action_public(doc) for doc in page]
    return ActionListResponse(items=items, total=total, limit=limit, offset=offset)


async def count_actions(
    db,
    user_id: str,
    *,
    status: str = ACTION_STATUS_PENDING,
    include_snoozed: bool = False,
    snoozed_only: bool = False,
) -> int:
    now_iso = _iso_z(_utc_now())
    query: dict = {"userId": user_id}
    if status and status != "all":
        query["status"] = status if status in ACTION_STATUSES else ACTION_STATUS_PENDING
    if snoozed_only:
        query.update(_snoozed_only_clause(now_iso))
        if "status" not in query:
            query["status"] = ACTION_STATUS_PENDING
    elif (
        not include_snoozed
        and (not status or status == ACTION_STATUS_PENDING)
    ):
        query.update(_active_pending_clause(now_iso))
    return await db.actions.count_documents(query)


async def get_action(db, user_id: str, action_id: str) -> Optional[ActionPublic]:
    doc = await db.actions.find_one({"userId": user_id, "id": action_id}, {"_id": 0})
    return action_public(doc) if doc else None


def _clear_snooze_fields() -> Dict[str, str]:
    return {
        "snoozedUntil": "",
        "snoozedAt": "",
        "snoozedBy": "",
    }


async def complete_action(db, user_id: str, action_id: str) -> ActionPublic:
    now = _utc_now_iso()
    result = await db.actions.update_one(
        {"userId": user_id, "id": action_id},
        {
            "$set": {
                "status": ACTION_STATUS_COMPLETED,
                "completedAt": now,
                "updatedAt": now,
            },
            "$unset": _clear_snooze_fields(),
        },
    )
    if result.matched_count == 0:
        raise LookupError("action_not_found")
    doc = await db.actions.find_one({"userId": user_id, "id": action_id}, {"_id": 0})
    if not doc:
        raise LookupError("action_not_found")
    return action_public(doc)


async def dismiss_action(db, user_id: str, action_id: str) -> ActionPublic:
    now = _utc_now_iso()
    result = await db.actions.update_one(
        {"userId": user_id, "id": action_id},
        {
            "$set": {
                "status": ACTION_STATUS_DISMISSED,
                "completedAt": now,
                "updatedAt": now,
            },
            "$unset": _clear_snooze_fields(),
        },
    )
    if result.matched_count == 0:
        raise LookupError("action_not_found")
    doc = await db.actions.find_one({"userId": user_id, "id": action_id}, {"_id": 0})
    if not doc:
        raise LookupError("action_not_found")
    return action_public(doc)


async def snooze_action(db, user_id: str, action_id: str, until: str) -> ActionPublic:
    """Postpone a pending action until ``until`` (ISO-8601, must be in the future)."""
    until_dt = _parse_iso(until)
    if until_dt is None:
        raise ValueError("invalid_until")
    now = _utc_now()
    # Reject past / "now" — allow 30s skew for clock drift.
    if until_dt <= now + timedelta(seconds=30):
        raise ValueError("until_must_be_future")

    doc = await db.actions.find_one(
        {"userId": user_id, "id": action_id, "status": ACTION_STATUS_PENDING},
        {"_id": 0},
    )
    if not doc:
        raise LookupError("action_not_found")

    until_iso = _iso_z(until_dt)
    now_iso = _iso_z(now)
    payload: Dict[str, Any] = {
        "snoozedUntil": until_iso,
        "snoozedAt": now_iso,
        "snoozedBy": user_id,
        "updatedAt": _utc_now_iso(),
        "status": ACTION_STATUS_PENDING,
    }
    # Preserve original dueAt once across successive snoozes.
    if doc.get("dueAt") and not doc.get("previousDueAt"):
        payload["previousDueAt"] = doc["dueAt"]

    await db.actions.update_one(
        {"userId": user_id, "id": action_id, "status": ACTION_STATUS_PENDING},
        {"$set": payload},
    )
    updated = await db.actions.find_one({"userId": user_id, "id": action_id}, {"_id": 0})
    if not updated:
        raise LookupError("action_not_found")
    return action_public(updated)
