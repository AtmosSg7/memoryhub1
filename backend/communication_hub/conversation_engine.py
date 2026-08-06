"""Conversation Engine — group communications into threads (provider-agnostic)."""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from communication_hub.constants import (
    CHANNEL_EMAIL,
    CHANNEL_PHONE,
    CHANNEL_WHATSAPP,
    LIFECYCLE_ARCHIVED,
    LIFECYCLE_IGNORED,
    LIFECYCLE_NEW,
    LIFECYCLE_READ,
    LIFECYCLE_REPLIED,
    LIFECYCLE_TO_READ,
    LIFECYCLE_WAITING,
    PRIORITY_NORMAL,
)
from communication_hub.lifecycle import default_lifecycle_for_ingest

logger = logging.getLogger(__name__)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_ts(value: Optional[str]) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _ts_max(a: Optional[str], b: Optional[str]) -> Optional[str]:
    da, db = _parse_ts(a), _parse_ts(b)
    if da and db:
        return a if da >= db else b
    if da:
        return a
    if db:
        return b
    return a or b


def _ts_min(a: Optional[str], b: Optional[str]) -> Optional[str]:
    da, db = _parse_ts(a), _parse_ts(b)
    if da and db:
        return a if da <= db else b
    if da:
        return a
    if db:
        return b
    return a or b


def conversation_id_for(user_id: str, conversation_key: str) -> str:
    raw = f"{user_id}:{conversation_key}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:32]


def derive_conversation_key(communication: dict) -> str:
    """Stable conversation key for any channel.

    Email: prefer provider threadId (Gmail-style).
    Phone / WhatsApp: identity or provider conversation id.
    Fallback: single-message conversation.
    """
    channel = (communication.get("type") or CHANNEL_EMAIL).strip().lower()
    provider = (communication.get("provider") or "unknown").strip().lower()
    meta = communication.get("metadata") or {}

    if channel == CHANNEL_EMAIL:
        thread = (meta.get("threadId") or "").strip()
        if thread:
            return f"email:{provider}:thread:{thread}"
        provider_id = (communication.get("providerId") or "").strip()
        if provider_id:
            return f"email:{provider}:msg:{provider_id}"

    if channel == CHANNEL_PHONE:
        phone = (
            meta.get("fromPhone")
            or meta.get("toPhone")
            or meta.get("phone")
            or ""
        ).strip()
        digits = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
        if digits:
            return f"phone:{provider}:identity:{digits}"
        call_id = (communication.get("providerId") or "").strip()
        if call_id:
            return f"phone:{provider}:call:{call_id}"

    if channel == CHANNEL_WHATSAPP:
        wa_thread = (meta.get("threadId") or meta.get("conversationId") or "").strip()
        if wa_thread:
            return f"whatsapp:{provider}:thread:{wa_thread}"
        wa_id = (meta.get("waId") or meta.get("fromPhone") or meta.get("phone") or "").strip()
        if wa_id:
            return f"whatsapp:{provider}:identity:{wa_id}"

    provider_id = (communication.get("providerId") or communication.get("id") or uuid.uuid4().hex).strip()
    return f"{channel}:{provider}:msg:{provider_id}"


def _participants_from_communication(communication: dict) -> List[dict]:
    meta = communication.get("metadata") or {}
    channel = (communication.get("type") or "").lower()
    out: List[dict] = []
    if channel == CHANNEL_EMAIL:
        if meta.get("fromEmail"):
            out.append(
                {
                    "identityKey": f"email:{(meta.get('fromEmail') or '').lower()}",
                    "displayName": meta.get("fromName"),
                    "email": meta.get("fromEmail"),
                    "role": "from",
                }
            )
        for to in list(meta.get("toEmails") or [])[:8]:
            if to:
                out.append(
                    {
                        "identityKey": f"email:{str(to).lower()}",
                        "email": to,
                        "role": "to",
                    }
                )
        for cc in list(meta.get("ccEmails") or [])[:5]:
            if cc:
                out.append(
                    {
                        "identityKey": f"email:{str(cc).lower()}",
                        "email": cc,
                        "role": "cc",
                    }
                )
    elif channel in {CHANNEL_PHONE, CHANNEL_WHATSAPP, "sms"}:
        phone = meta.get("fromPhone") or meta.get("phone") or meta.get("waId")
        if phone:
            prefix = "whatsapp" if channel == CHANNEL_WHATSAPP else "phone"
            out.append(
                {
                    "identityKey": f"{prefix}:{phone}",
                    "phone": phone,
                    "displayName": meta.get("fromName"),
                    "role": "from",
                }
            )
    return out


def merge_participants(existing: Optional[List[dict]], incoming: List[dict]) -> List[dict]:
    """Merge participants by identityKey (stable, deduped)."""
    by_key: Dict[str, dict] = {}
    for p in list(existing or []) + list(incoming or []):
        if not isinstance(p, dict):
            continue
        key = (p.get("identityKey") or p.get("email") or p.get("phone") or "").strip().lower()
        if not key:
            continue
        prev = by_key.get(key) or {}
        merged = {**prev, **{k: v for k, v in p.items() if v not in (None, "", [])}}
        # Prefer a concrete role; keep "from" over "to" if both appear.
        if prev.get("role") == "from" and merged.get("role") != "from":
            merged["role"] = "from"
        by_key[key] = merged
    # Stable order: from first, then to/cc, then others
    role_rank = {"from": 0, "to": 1, "cc": 2, "self": 3}
    items = list(by_key.values())
    items.sort(key=lambda p: (role_rank.get(p.get("role") or "", 9), p.get("identityKey") or ""))
    return items[:40]


def classify_attachment_kind(filename: Optional[str], mime: Optional[str]) -> str:
    name = (filename or "").lower()
    mime_l = (mime or "").lower()
    if mime_l.startswith("image/") or name.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic")):
        return "image" if "photo" not in name else "photo"
    if mime_l == "application/pdf" or name.endswith(".pdf"):
        if "devis" in name or "quote" in name:
            return "quote"
        if "facture" in name or "invoice" in name:
            return "invoice"
        return "pdf"
    if name.endswith((".doc", ".docx", ".xls", ".xlsx", ".odt", ".rtf", ".txt")):
        return "document"
    return "other"


def compute_conversation_lifecycle(message_lifecycles: List[str]) -> str:
    """Derive conversation lifecycle from member messages (priority order)."""
    statuses = {str(s) for s in message_lifecycles if s}
    if not statuses:
        return LIFECYCLE_NEW
    if LIFECYCLE_TO_READ in statuses or LIFECYCLE_NEW in statuses:
        return LIFECYCLE_TO_READ
    if LIFECYCLE_WAITING in statuses:
        return LIFECYCLE_WAITING
    if LIFECYCLE_REPLIED in statuses:
        return LIFECYCLE_REPLIED
    if LIFECYCLE_READ in statuses:
        return LIFECYCLE_READ
    if statuses <= {LIFECYCLE_ARCHIVED}:
        return LIFECYCLE_ARCHIVED
    if statuses <= {LIFECYCLE_IGNORED}:
        return LIFECYCLE_IGNORED
    return next(iter(statuses))


async def ensure_conversation_for_communication(db, communication: dict) -> Tuple[dict, dict]:
    """Upsert conversation + attach conversationId / lifecycle on the communication.

    Returns (conversation_doc, updated_communication_fields).
    """
    user_id = communication["userId"]
    key = derive_conversation_key(communication)
    conv_id = conversation_id_for(user_id, key)
    now = _utc_now_iso()
    created_at = communication.get("createdAt") or now
    channel = (communication.get("type") or CHANNEL_EMAIL).lower()
    provider = communication.get("provider")
    meta = communication.get("metadata") or {}

    existing_comm = None
    if communication.get("id"):
        existing_comm = await db.communications.find_one(
            {"userId": user_id, "id": communication["id"]},
            {"_id": 0, "lifecycleStatus": 1, "conversationId": 1, "priority": 1},
        )

    lifecycle = default_lifecycle_for_ingest(
        direction=communication.get("direction"),
        association_status=communication.get("status") or meta.get("associationStatus"),
        existing_lifecycle=(existing_comm or {}).get("lifecycleStatus"),
    )
    priority = (existing_comm or {}).get("priority") or PRIORITY_NORMAL

    existing_conv = await db.conversations.find_one(
        {"userId": user_id, "id": conv_id},
        {"_id": 0},
    )

    participants = merge_participants(
        (existing_conv or {}).get("participants"),
        _participants_from_communication(communication),
    )

    client_id = communication.get("clientId") or (existing_conv or {}).get("clientId")
    client_name = meta.get("clientName") or (existing_conv or {}).get("clientName")

    first_at = _ts_min((existing_conv or {}).get("firstMessageAt"), created_at) or created_at
    last_at = _ts_max((existing_conv or {}).get("lastMessageAt"), created_at) or created_at

    # Only refresh subject/preview from the chronologically latest message.
    is_latest = True
    existing_last = (existing_conv or {}).get("lastMessageAt")
    if existing_last and _parse_ts(created_at) and _parse_ts(existing_last):
        is_latest = _parse_ts(created_at) >= _parse_ts(existing_last)

    if is_latest or not existing_conv:
        subject = communication.get("subject") or (existing_conv or {}).get("subject")
        preview = communication.get("preview") or (existing_conv or {}).get("preview")
        external_url = communication.get("externalUrl") or (existing_conv or {}).get("externalUrl")
    else:
        subject = (existing_conv or {}).get("subject") or communication.get("subject")
        preview = (existing_conv or {}).get("preview") or communication.get("preview")
        external_url = (existing_conv or {}).get("externalUrl") or communication.get("externalUrl")

    attachment_count = int(communication.get("attachmentsCount") or 0)
    if existing_conv:
        attachment_count = max(int(existing_conv.get("attachmentCount") or 0), attachment_count)

    conv_doc = {
        "id": conv_id,
        "userId": user_id,
        "conversationKey": key,
        "channel": channel,
        "provider": provider,
        "clientId": client_id,
        "clientName": client_name,
        "subject": subject,
        "preview": preview,
        "lifecycleStatus": lifecycle,
        "priority": priority,
        "messageCount": int((existing_conv or {}).get("messageCount") or 0),
        "attachmentCount": attachment_count,
        "unreadCount": int((existing_conv or {}).get("unreadCount") or 0),
        "participants": participants,
        "lastMessageAt": last_at,
        "firstMessageAt": first_at,
        "externalUrl": external_url,
        "updatedAt": now,
        "createdAt": (existing_conv or {}).get("createdAt") or now,
    }

    await db.conversations.update_one(
        {"userId": user_id, "id": conv_id},
        {"$set": conv_doc},
        upsert=True,
    )

    fields = {
        "conversationId": conv_id,
        "conversationKey": key,
        "lifecycleStatus": lifecycle,
        "priority": priority,
        "updatedAt": now,
    }
    return conv_doc, fields


async def sync_attachments_for_communication(db, communication: dict) -> int:
    """Upsert attachment metadata rows linked to conversation + communication."""
    user_id = communication["userId"]
    comm_id = communication.get("id")
    conv_id = communication.get("conversationId")
    meta = communication.get("metadata") or {}
    raw_list = list(meta.get("attachments") or [])
    if not raw_list or not comm_id:
        return 0

    now = _utc_now_iso()
    upserted = 0
    for idx, att in enumerate(raw_list):
        if not isinstance(att, dict):
            continue
        filename = att.get("filename")
        mime = att.get("mimeType")
        size = att.get("size")
        source_id = att.get("sourceId") or att.get("attachmentId") or f"{idx}:{filename or 'file'}"
        att_id = hashlib.sha256(
            f"{user_id}:{comm_id}:{source_id}".encode("utf-8")
        ).hexdigest()[:32]
        doc = {
            "id": att_id,
            "userId": user_id,
            "conversationId": conv_id,
            "communicationId": comm_id,
            "filename": filename,
            "mimeType": mime,
            "size": int(size) if size is not None else None,
            "kind": classify_attachment_kind(filename, mime),
            "channel": communication.get("type"),
            "provider": communication.get("provider"),
            "externalUrl": att.get("externalUrl") or communication.get("externalUrl"),
            "createdAt": communication.get("createdAt") or now,
            "updatedAt": now,
        }
        await db.communication_attachments.update_one(
            {"userId": user_id, "id": att_id},
            {"$set": doc},
            upsert=True,
        )
        upserted += 1
    return upserted


async def refresh_conversation_aggregates(db, user_id: str, conversation_id: str) -> dict:
    """Recompute messageCount / unreadCount / lifecycle / last preview from members."""
    cursor = db.communications.find(
        {"userId": user_id, "conversationId": conversation_id},
        {
            "_id": 0,
            "lifecycleStatus": 1,
            "createdAt": 1,
            "subject": 1,
            "preview": 1,
            "externalUrl": 1,
            "clientId": 1,
            "metadata": 1,
            "direction": 1,
        },
    ).sort("createdAt", 1)
    messages = [doc async for doc in cursor]
    now = _utc_now_iso()
    if not messages:
        await db.conversations.update_one(
            {"userId": user_id, "id": conversation_id},
            {"$set": {"messageCount": 0, "unreadCount": 0, "updatedAt": now}},
        )
        return {"messageCount": 0, "unreadCount": 0}

    lifecycles = [m.get("lifecycleStatus") or LIFECYCLE_NEW for m in messages]
    unread = sum(
        1
        for m in messages
        if (m.get("lifecycleStatus") or "") in {LIFECYCLE_NEW, LIFECYCLE_TO_READ}
        and (m.get("direction") or "inbound") == "inbound"
    )
    latest = messages[-1]
    first = messages[0]
    att_count = await db.communication_attachments.count_documents(
        {"userId": user_id, "conversationId": conversation_id}
    )
    client_id = None
    client_name = None
    for m in reversed(messages):
        if m.get("clientId"):
            client_id = m["clientId"]
            client_name = (m.get("metadata") or {}).get("clientName")
            break

    fields = {
        "messageCount": len(messages),
        "unreadCount": unread,
        "lifecycleStatus": compute_conversation_lifecycle(lifecycles),
        "subject": latest.get("subject"),
        "preview": latest.get("preview"),
        "externalUrl": latest.get("externalUrl"),
        "lastMessageAt": latest.get("createdAt"),
        "firstMessageAt": first.get("createdAt"),
        "attachmentCount": att_count,
        "updatedAt": now,
    }
    if client_id:
        fields["clientId"] = client_id
        if client_name:
            fields["clientName"] = client_name

    await db.conversations.update_one(
        {"userId": user_id, "id": conversation_id},
        {"$set": fields},
    )
    return fields


async def after_communication_upsert(db, communication: dict) -> dict:
    """Hub hook — safe to call from Communication Center writers."""
    try:
        conv, fields = await ensure_conversation_for_communication(db, communication)
        communication = {**communication, **fields}
        await db.communications.update_one(
            {"userId": communication["userId"], "id": communication["id"]},
            {"$set": fields},
        )
        await sync_attachments_for_communication(db, communication)
        await refresh_conversation_aggregates(
            db, communication["userId"], conv["id"]
        )
        return communication
    except Exception:
        logger.exception(
            "hub_after_upsert_failed comm=%s user=%s",
            communication.get("id"),
            communication.get("userId"),
        )
        return communication


async def retarget_conversations_for_communications(
    db,
    user_id: str,
    communication_ids: List[str],
    *,
    client_id: str,
    client_name: Optional[str] = None,
) -> int:
    """Propagate client link onto Hub conversations (prospect → client)."""
    if not communication_ids:
        return 0
    now = _utc_now_iso()
    cursor = db.communications.find(
        {"userId": user_id, "id": {"$in": list(communication_ids)}},
        {"_id": 0, "id": 1, "conversationId": 1, "metadata": 1},
    )
    conv_ids: List[str] = []
    async for doc in cursor:
        cid = doc.get("conversationId")
        if cid and cid not in conv_ids:
            conv_ids.append(cid)
        # Ensure orphan rows get a conversation before retarget.
        if not cid:
            refreshed = await after_communication_upsert(db, {**doc, "userId": user_id, "clientId": client_id})
            if refreshed.get("conversationId"):
                conv_ids.append(refreshed["conversationId"])

    if not conv_ids:
        return 0

    set_fields: Dict[str, Any] = {
        "clientId": client_id,
        "updatedAt": now,
    }
    if client_name:
        set_fields["clientName"] = client_name

    result = await db.conversations.update_many(
        {"userId": user_id, "id": {"$in": conv_ids}},
        {"$set": set_fields},
    )
    return int(result.modified_count or 0)
