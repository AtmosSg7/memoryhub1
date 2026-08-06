"""Communication Center — canonical interaction layer for MemoryHub.

Generic store for client interactions (email, phone, WhatsApp, SMS, calendar,
internal notes, AI summaries). Providers write here; Timeline and Client 360
read here. WhatsApp / phone / calendar providers are reserved (architecture only).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

CommunicationType = Literal[
    "email",
    "phone",
    "whatsapp",
    "sms",
    "calendar",
    "internal_note",
    "ai_summary",
]

CommunicationDirection = Literal["inbound", "outbound", "internal"]

COMMUNICATION_TYPES: tuple[str, ...] = (
    "email",
    "phone",
    "whatsapp",
    "sms",
    "calendar",
    "internal_note",
    "ai_summary",
)

# Reserved / multi-channel provider ids (phone Hub V1 writes type=phone via phone.*).
RESERVED_PROVIDERS = ("whatsapp", "phone", "sms", "outlook", "calendar", "google_calendar")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CommunicationRecord(BaseModel):
    """Canonical communication document (persisted in ``db.communications``)."""

    model_config = ConfigDict(extra="ignore")

    id: str
    userId: str
    clientId: Optional[str] = None
    connectedAccountId: Optional[str] = None
    type: CommunicationType
    direction: Optional[CommunicationDirection] = None
    provider: Optional[str] = None
    providerId: Optional[str] = None
    subject: Optional[str] = None
    preview: Optional[str] = None
    createdAt: str
    updatedAt: Optional[str] = None
    attachmentsCount: int = 0
    externalUrl: Optional[str] = None
    # Association: linked | unlinked | ignored (Gmail inbox + sync)
    status: Optional[str] = None
    ignoredAt: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CommunicationPublic(BaseModel):
    """API read model for the Communication Center."""

    model_config = ConfigDict(extra="ignore")

    id: str
    clientId: Optional[str] = None
    type: str
    direction: Optional[str] = None
    provider: Optional[str] = None
    providerId: Optional[str] = None
    subject: Optional[str] = None
    preview: Optional[str] = None
    createdAt: str
    attachmentsCount: int = 0
    externalUrl: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    clientName: Optional[str] = None


class CommunicationListResponse(BaseModel):
    items: List[CommunicationPublic]
    total: int


def communication_public(doc: dict) -> CommunicationPublic:
    return CommunicationPublic(
        id=doc["id"],
        clientId=doc.get("clientId"),
        type=str(doc.get("type") or "email"),
        direction=doc.get("direction"),
        provider=doc.get("provider"),
        providerId=doc.get("providerId"),
        subject=doc.get("subject"),
        preview=doc.get("preview"),
        createdAt=doc.get("createdAt") or utc_now_iso(),
        attachmentsCount=int(doc.get("attachmentsCount") or 0),
        externalUrl=doc.get("externalUrl"),
        metadata=doc.get("metadata") or {},
        clientName=(doc.get("metadata") or {}).get("clientName") or doc.get("clientName"),
    )


def build_communication_doc(
    *,
    user_id: str,
    type: CommunicationType,
    client_id: Optional[str] = None,
    direction: Optional[CommunicationDirection] = None,
    provider: Optional[str] = None,
    provider_id: Optional[str] = None,
    subject: Optional[str] = None,
    preview: Optional[str] = None,
    created_at: Optional[str] = None,
    attachments_count: int = 0,
    external_url: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    existing_id: Optional[str] = None,
) -> dict:
    now = utc_now_iso()
    return {
        "id": existing_id or str(uuid.uuid4()),
        "userId": user_id,
        "clientId": client_id,
        "type": type,
        "direction": direction,
        "provider": provider,
        "providerId": provider_id,
        "subject": subject,
        "preview": (preview or "")[:500] or None,
        "createdAt": created_at or now,
        "attachmentsCount": int(attachments_count or 0),
        "externalUrl": external_url,
        "metadata": metadata or {},
        "updatedAt": now,
    }


async def upsert_communication(db, doc: dict) -> dict:
    """Insert or update by (userId, provider, providerId) when providerId is set.

    Preserves manual ``clientId`` / ``ignoredAt`` when a re-sync would clear them.
    """
    user_id = doc["userId"]
    provider = doc.get("provider")
    provider_id = doc.get("providerId")

    if provider and provider_id:
        existing = await db.communications.find_one(
            {"userId": user_id, "provider": provider, "providerId": provider_id},
            {"_id": 0},
        )
        if existing:
            doc = {**doc, "id": existing["id"]}
            # Keep manual link / ignore across Gmail re-sync
            if existing.get("clientId") and not doc.get("clientId"):
                doc["clientId"] = existing["clientId"]
            meta = dict(doc.get("metadata") or {})
            existing_meta = existing.get("metadata") or {}
            if existing.get("clientId") and existing_meta.get("clientName") and not meta.get("clientName"):
                meta["clientName"] = existing_meta["clientName"]
            # Preserve association provenance even when clientId is also on email_messages
            for key in ("linkedBy", "linkedAt", "suggestionDismissedAt"):
                if existing_meta.get(key):
                    meta[key] = existing_meta[key]
            doc["metadata"] = meta
            if existing.get("ignoredAt") and "ignoredAt" not in doc:
                doc["ignoredAt"] = existing["ignoredAt"]
                if existing.get("status"):
                    doc["status"] = existing["status"]
            await db.communications.update_one(
                {"userId": user_id, "id": existing["id"]},
                {"$set": {k: v for k, v in doc.items() if k not in ("id", "userId")}},
            )
            # Hub first so Action Engine can idempotent on conversationId.
            doc = await _hook_communication_hub(db, doc)
            await _hook_action_engine(db, doc)
            await _hook_communication_intelligence(db, doc)
            return doc

    await db.communications.insert_one(doc)
    doc = await _hook_communication_hub(db, doc)
    await _hook_action_engine(db, doc)
    await _hook_communication_intelligence(db, doc)
    return doc


async def _hook_action_engine(db, communication: dict) -> None:
    """Channel-agnostic Action Engine hook — never breaks writers."""
    try:
        from action_engine.engine import safe_evaluate_communication

        await safe_evaluate_communication(db, communication)
    except Exception:
        pass


async def _hook_communication_intelligence(db, communication: dict) -> None:
    """Optional AI analysis after ingest — never breaks writers / Gmail sync.

    Auto-run is gated by COMMUNICATION_INTELLIGENCE_ENABLED and
    COMMUNICATION_INTELLIGENCE_AUTO_ON_INGEST (both default false).
    """
    try:
        from communication_intelligence.hooks import schedule_analyze_after_ingest

        schedule_analyze_after_ingest(db, communication)
    except Exception:
        pass


async def _hook_communication_hub(db, communication: dict) -> dict:
    """Hub V2 — conversation grouping + lifecycle + attachments (never breaks writers)."""
    try:
        from communication_hub.conversation_engine import after_communication_upsert

        return await after_communication_upsert(db, communication)
    except Exception:
        return communication


def _association_status_for_gmail(email_doc: dict, *, existing: Optional[dict] = None) -> str:
    """Derive association status without wiping an ignored / manual link on re-sync."""
    if (existing or {}).get("ignoredAt") or email_doc.get("ignoredAt"):
        return "ignored"
    if email_doc.get("clientId") or (existing or {}).get("clientId"):
        return "linked"
    return "unlinked"


async def upsert_from_gmail_email_doc(
    db,
    email_doc: dict,
    *,
    connected_account_id: Optional[str] = None,
) -> dict:
    """Feed Communication Center from a Gmail ``email_messages`` document.

    Idempotent on ``(userId, provider, providerId)``. Re-syncs refresh metadata
    without creating duplicate rows. Preserves manual client links and ignoredAt.
    """
    direction = email_doc.get("direction") or "inbound"
    if direction not in ("inbound", "outbound", "internal"):
        direction = "inbound"

    provider = email_doc.get("provider") or "gmail"
    provider_id = email_doc.get("providerMessageId")
    existing = None
    if provider_id:
        existing = await db.communications.find_one(
            {
                "userId": email_doc["userId"],
                "provider": provider,
                "providerId": provider_id,
            },
            {"_id": 0},
        )

    account_id = (
        connected_account_id
        or email_doc.get("connectedAccountId")
        or (existing or {}).get("connectedAccountId")
        or ((existing or {}).get("metadata") or {}).get("connectedAccountId")
    )
    association_status = _association_status_for_gmail(email_doc, existing=existing)
    sent_at = email_doc.get("sentAt") or email_doc.get("createdAt")

    # While ignored, never re-attach from email_messages (ignore must stick until restore).
    if existing and existing.get("ignoredAt"):
        client_id = existing.get("clientId")
        client_name = (existing.get("metadata") or {}).get("clientName")
    else:
        client_id = email_doc.get("clientId")
        client_name = email_doc.get("clientName")

    meta = {
        "clientName": client_name,
        "fromEmail": email_doc.get("fromEmail"),
        "fromName": email_doc.get("fromName"),
        "toEmail": email_doc.get("toEmail"),
        "toEmails": list(email_doc.get("toEmails") or []),
        "ccEmails": list(email_doc.get("ccEmails") or []),
        "threadId": email_doc.get("threadId"),
        "matchedBy": email_doc.get("matchedBy"),
        "emailMessageId": email_doc.get("id"),
        "sourceId": provider_id,
        "accountEmail": email_doc.get("accountEmail"),
        "connectedAccountId": account_id,
        "sentAt": sent_at,
        "associationStatus": association_status,
        "channel": "email",
        "source": "gmail",
        "attachments": list(email_doc.get("attachments") or []),
    }
    # Drop empty optional metadata keys for cleaner documents
    meta = {k: v for k, v in meta.items() if v not in (None, "", [])}

    doc = build_communication_doc(
        user_id=email_doc["userId"],
        type="email",
        client_id=client_id,
        direction=direction,  # type: ignore[arg-type]
        provider=provider,
        provider_id=provider_id,
        subject=email_doc.get("subject"),
        preview=email_doc.get("preview"),
        created_at=sent_at,
        attachments_count=int(email_doc.get("attachmentCount") or 0),
        external_url=email_doc.get("gmailUrl"),
        metadata=meta,
        existing_id=(existing or {}).get("id"),
    )
    if account_id:
        doc["connectedAccountId"] = account_id
    doc["status"] = association_status
    return await upsert_communication(db, doc)


async def upsert_from_phone_call(
    db,
    *,
    user_id: str,
    call,
    client_name: Optional[str] = None,
) -> dict:
    """Feed Communication Center from a PhoneCall (Phone Hub → same path as Gmail).

    Idempotent on ``(userId, provider, providerId)``. Sets metadata for Hub
    conversation keys, Timeline ``call_logged``, and Action Engine missed-call rules.
    """
    from phone.constants import DIRECTION_TO_COMM, PROVIDER_PHONE

    provider = getattr(call, "provider", None) or PROVIDER_PHONE
    provider_id = getattr(call, "providerCallId", None) or getattr(call, "provider_call_id", None)
    if not provider_id:
        raise ValueError("PhoneCall.providerCallId is required")

    existing = await db.communications.find_one(
        {"userId": user_id, "provider": provider, "providerId": provider_id},
        {"_id": 0},
    )

    call_direction = getattr(call, "direction", None) or "incoming"
    direction = DIRECTION_TO_COMM.get(call_direction, "inbound")
    status = getattr(call, "status", None) or "unknown"
    missed = status in {"missed", "rejected", "voicemail"} or bool(getattr(call, "voicemail", False))
    phone_number = getattr(call, "phoneNumber", None) or ""
    normalized = getattr(call, "normalizedPhone", None) or ""
    started_at = getattr(call, "startedAt", None) or utc_now_iso()
    client_id = getattr(call, "clientId", None)
    if existing and existing.get("ignoredAt"):
        client_id = existing.get("clientId")
        client_name = (existing.get("metadata") or {}).get("clientName") or client_name
    elif existing and existing.get("clientId") and not client_id:
        client_id = existing.get("clientId")

    association_status = "ignored" if (existing or {}).get("ignoredAt") else (
        "linked" if client_id else "unlinked"
    )

    attachments = getattr(call, "attachments", None) or []
    att_list = []
    for a in attachments:
        if hasattr(a, "model_dump"):
            att_list.append(a.model_dump())
        elif isinstance(a, dict):
            att_list.append(a)

    preview_bits = [status]
    if getattr(call, "duration", None):
        preview_bits.append(f"{int(call.duration)}s")
    if phone_number:
        preview_bits.append(phone_number)

    meta = {
        "clientName": client_name,
        "phoneNumber": phone_number,
        "normalizedPhone": normalized,
        "fromPhone": phone_number if call_direction == "incoming" else None,
        "toPhone": phone_number if call_direction == "outgoing" else None,
        "phone": phone_number,
        "callDirection": call_direction,
        "status": status,
        "missed": missed,
        "missedCall": missed,
        "voicemail": bool(getattr(call, "voicemail", False)),
        "duration": getattr(call, "duration", None),
        "startedAt": started_at,
        "endedAt": getattr(call, "endedAt", None),
        "recordingUrl": getattr(call, "recordingUrl", None),
        "notes": getattr(call, "notes", None),
        "matchedBy": getattr(call, "matchedBy", None),
        "connectedAccountId": getattr(call, "connectedAccountId", None),
        "vendor": getattr(call, "vendor", None),
        "channel": "phone",
        "source": "phone",
        "attachments": att_list,
    }
    meta = {k: v for k, v in meta.items() if v not in (None, "", [])}

    subject = {
        "missed": "Appel manqué",
        "voicemail": "Messagerie vocale",
        "rejected": "Appel rejeté",
        "blocked": "Appel bloqué",
        "spam": "Appel indésirable",
        "outgoing": "Appel sortant",
        "incoming": "Appel entrant",
        "answered": "Appel",
    }.get(status, "Appel")

    doc = build_communication_doc(
        user_id=user_id,
        type="phone",
        client_id=client_id,
        direction=direction,  # type: ignore[arg-type]
        provider=provider,
        provider_id=provider_id,
        subject=subject,
        preview=" · ".join(preview_bits),
        created_at=started_at,
        attachments_count=len(att_list),
        external_url=getattr(call, "recordingUrl", None),
        metadata=meta,
        existing_id=(existing or {}).get("id"),
    )
    account_id = getattr(call, "connectedAccountId", None)
    if account_id:
        doc["connectedAccountId"] = account_id
    doc["status"] = association_status
    if (existing or {}).get("ignoredAt"):
        doc["ignoredAt"] = existing["ignoredAt"]

    persisted = await upsert_communication(db, doc)
    # Reflect Hub conversation id back when present
    if hasattr(call, "conversationId"):
        call.conversationId = persisted.get("conversationId")
    return persisted


async def list_center_communications(
    db,
    user_id: str,
    *,
    client_id: Optional[str] = None,
    type_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> CommunicationListResponse:
    query: Dict[str, Any] = {"userId": user_id}
    if client_id:
        query["clientId"] = client_id
    if type_filter:
        query["type"] = type_filter

    total = await db.communications.count_documents(query)
    cursor = (
        db.communications.find(query, {"_id": 0})
        .sort("createdAt", -1)
        .skip(max(0, offset))
        .limit(max(1, min(limit, 200)))
    )
    items = [communication_public(doc) async for doc in cursor]
    return CommunicationListResponse(items=items, total=total)


async def count_client_communications(db, user_id: str, client_id: str) -> Dict[str, int]:
    """Aggregate exchange counts for Client 360 (single aggregation, no N+1)."""
    base = {"userId": user_id, "clientId": client_id}
    cursor = db.communications.aggregate(
        [
            {"$match": base},
            {
                "$group": {
                    "_id": None,
                    "exchangesTotal": {"$sum": 1},
                    "emailsReceived": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$and": [
                                        {"$eq": ["$type", "email"]},
                                        {"$eq": ["$direction", "inbound"]},
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                    "emailsSent": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$and": [
                                        {"$eq": ["$type", "email"]},
                                        {"$eq": ["$direction", "outbound"]},
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                }
            },
        ]
    )
    rows = await cursor.to_list(1)
    if not rows:
        return {"exchangesTotal": 0, "emailsReceived": 0, "emailsSent": 0}
    row = rows[0]
    return {
        "exchangesTotal": int(row.get("exchangesTotal") or 0),
        "emailsReceived": int(row.get("emailsReceived") or 0),
        "emailsSent": int(row.get("emailsSent") or 0),
    }
