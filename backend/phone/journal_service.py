"""Phone Hub V2 — call journal over canonical ``communications`` (type=phone)."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from phone.constants import PROVIDER_PHONE
from phone.models import CallJournalItem, CallJournalListResponse, PhoneDashboardStats
from phone.normalizer import PhoneNormalizer


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        raw = str(value).strip()
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _since_for_filter(filter_key: str) -> Optional[datetime]:
    now = _utc_now()
    if filter_key == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if filter_key == "7d":
        return now - timedelta(days=7)
    if filter_key == "30d":
        return now - timedelta(days=30)
    return None


def _base_query(user_id: str) -> Dict[str, Any]:
    return {"userId": user_id, "type": "phone"}


def _apply_filter(query: Dict[str, Any], filter_key: str) -> Dict[str, Any]:
    key = (filter_key or "all").strip().lower()
    since = _since_for_filter(key)
    if since:
        query = {**query, "createdAt": {"$gte": since.isoformat()}}

    if key == "missed":
        query = {
            **query,
            "$or": [
                {"metadata.status": "missed"},
                {"metadata.missed": True},
                {"metadata.missedCall": True},
            ],
        }
    elif key == "callback":
        # Pending call_back rows are resolved in list_call_journal via actions.
        pass
    elif key == "clients":
        query = {**query, "clientId": {"$type": "string", "$ne": ""}}
    elif key == "unknowns":
        query = {
            **query,
            "$or": [
                {"clientId": None},
                {"clientId": {"$exists": False}},
                {"clientId": ""},
            ],
            "metadata.status": {"$nin": ["spam", "blocked"]},
        }
    return query


def _apply_search(query: Dict[str, Any], q: Optional[str]) -> Dict[str, Any]:
    text = (q or "").strip()
    if not text:
        return query
    digits = PhoneNormalizer.normalize_phone(text) or re.sub(r"\D", "", text)
    clauses: List[Dict[str, Any]] = [
        {"metadata.phoneNumber": {"$regex": re.escape(text), "$options": "i"}},
        {"metadata.counterpartyName": {"$regex": re.escape(text), "$options": "i"}},
        {"metadata.clientName": {"$regex": re.escape(text), "$options": "i"}},
        {"metadata.notes": {"$regex": re.escape(text), "$options": "i"}},
        {"subject": {"$regex": re.escape(text), "$options": "i"}},
        {"preview": {"$regex": re.escape(text), "$options": "i"}},
    ]
    if digits:
        clauses.append({"metadata.normalizedPhone": {"$regex": re.escape(digits)}})
        clauses.append({"metadata.phoneNumber": {"$regex": re.escape(digits)}})
    return {"$and": [query, {"$or": clauses}]}


def communication_to_journal_item(
    doc: dict,
    *,
    action_id: Optional[str] = None,
    action_status: Optional[str] = None,
) -> CallJournalItem:
    meta = doc.get("metadata") or {}
    status = meta.get("status") or "unknown"
    direction = meta.get("callDirection") or (
        "outgoing" if doc.get("direction") == "outbound" else "incoming"
    )
    started = meta.get("startedAt") or doc.get("createdAt")
    phone = meta.get("phoneNumber") or meta.get("fromPhone") or meta.get("toPhone") or ""
    return CallJournalItem(
        id=doc["id"],
        providerCallId=doc.get("providerId"),
        phoneNumber=phone,
        normalizedPhone=meta.get("normalizedPhone") or "",
        counterpartyName=meta.get("counterpartyName") or meta.get("fromName"),
        clientId=doc.get("clientId") or None,
        clientName=meta.get("clientName"),
        isProspect=not bool(doc.get("clientId"))
        and status not in {"spam", "blocked"}
        and not doc.get("ignoredAt"),
        direction=direction,
        status=status,
        startedAt=started,
        endedAt=meta.get("endedAt"),
        duration=meta.get("duration"),
        notes=meta.get("notes"),
        voicemail=bool(meta.get("voicemail")),
        conversationId=doc.get("conversationId"),
        actionId=action_id,
        actionStatus=action_status,
        associationStatus=doc.get("status") or ("linked" if doc.get("clientId") else "unlinked"),
        vendor=meta.get("vendor") or "manual",
        createdAt=doc.get("createdAt") or started,
        updatedAt=doc.get("updatedAt") or doc.get("createdAt"),
    )


async def _actions_for_comms(
    db, user_id: str, comm_ids: List[str]
) -> Dict[str, Tuple[str, str]]:
    if not comm_ids:
        return {}
    cursor = db.actions.find(
        {
            "userId": user_id,
            "communicationId": {"$in": comm_ids},
            "type": "call_back",
        },
        {"_id": 0, "id": 1, "communicationId": 1, "status": 1},
    )
    out: Dict[str, Tuple[str, str]] = {}
    async for doc in cursor:
        cid = doc.get("communicationId")
        if cid and cid not in out:
            out[cid] = (doc["id"], doc.get("status") or "pending")
    return out


async def list_call_journal(
    db,
    user_id: str,
    *,
    filter_key: str = "all",
    q: Optional[str] = None,
    limit: int = 30,
    offset: int = 0,
) -> CallJournalListResponse:
    limit = max(1, min(int(limit), 100))
    offset = max(0, int(offset))
    query = _apply_filter(_base_query(user_id), filter_key)
    query = _apply_search(query, q)

    # callback filter: prefer rows with a pending call_back action
    if (filter_key or "").lower() == "callback":
        pending = await db.actions.find(
            {"userId": user_id, "type": "call_back", "status": "pending"},
            {"_id": 0, "communicationId": 1},
        ).to_list(2000)
        pending_ids = [p["communicationId"] for p in pending if p.get("communicationId")]
        if not pending_ids:
            return CallJournalListResponse(items=[], total=0, limit=limit, offset=offset, filter=filter_key)
        query = {**_base_query(user_id), "id": {"$in": pending_ids}}
        query = _apply_search(query, q)
        since = _since_for_filter("all")
        _ = since

    total = int(await db.communications.count_documents(query))
    cursor = (
        db.communications.find(query, {"_id": 0})
        .sort("createdAt", -1)
        .skip(offset)
        .limit(limit)
    )
    docs = [doc async for doc in cursor]
    action_map = await _actions_for_comms(db, user_id, [d["id"] for d in docs])
    items = [
        communication_to_journal_item(
            d,
            action_id=(action_map.get(d["id"]) or (None, None))[0],
            action_status=(action_map.get(d["id"]) or (None, None))[1],
        )
        for d in docs
    ]
    return CallJournalListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        filter=filter_key or "all",
    )


async def get_call_journal_item(db, user_id: str, communication_id: str) -> CallJournalItem:
    doc = await db.communications.find_one(
        {"userId": user_id, "id": communication_id, "type": "phone"},
        {"_id": 0},
    )
    if not doc:
        raise LookupError("call_not_found")
    action_map = await _actions_for_comms(db, user_id, [communication_id])
    aid, astatus = action_map.get(communication_id, (None, None))
    return communication_to_journal_item(doc, action_id=aid, action_status=astatus)


async def phone_dashboard_stats(db, user_id: str) -> PhoneDashboardStats:
    base = _base_query(user_id)
    today_start = _utc_now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today = int(
        await db.communications.count_documents({**base, "createdAt": {"$gte": today_start}})
    )
    missed = int(
        await db.communications.count_documents(
            {
                **base,
                "$or": [
                    {"metadata.status": "missed"},
                    {"metadata.missed": True},
                ],
            }
        )
    )
    callback = int(
        await db.actions.count_documents(
            {"userId": user_id, "type": "call_back", "status": "pending"}
        )
    )
    recognized = int(
        await db.communications.count_documents(
            {**base, "clientId": {"$type": "string", "$ne": ""}}
        )
    )
    unknowns = int(
        await db.communications.count_documents(
            {
                **base,
                "$or": [
                    {"clientId": None},
                    {"clientId": {"$exists": False}},
                    {"clientId": ""},
                ],
                "metadata.status": {"$nin": ["spam", "blocked"]},
            }
        )
    )
    since7 = (_utc_now() - timedelta(days=7)).isoformat()
    since30 = (_utc_now() - timedelta(days=30)).isoformat()
    call7 = int(
        await db.communications.count_documents({**base, "createdAt": {"$gte": since7}})
    )
    call30 = int(
        await db.communications.count_documents({**base, "createdAt": {"$gte": since30}})
    )
    return PhoneDashboardStats(
        today=today,
        missed=missed,
        toCallBack=callback,
        recognized=recognized,
        unknowns=unknowns,
        call7=call7,
        call30=call30,
    )
