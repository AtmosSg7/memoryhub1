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

# Providers reserved for future connectors (do not implement now).
RESERVED_PROVIDERS = ("whatsapp", "phone", "sms", "outlook", "calendar", "google_calendar")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CommunicationRecord(BaseModel):
    """Canonical communication document (persisted in ``db.communications``)."""

    model_config = ConfigDict(extra="ignore")

    id: str
    userId: str
    clientId: Optional[str] = None
    type: CommunicationType
    direction: Optional[CommunicationDirection] = None
    provider: Optional[str] = None
    providerId: Optional[str] = None
    subject: Optional[str] = None
    preview: Optional[str] = None
    createdAt: str
    attachmentsCount: int = 0
    externalUrl: Optional[str] = None
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
                if existing_meta.get("clientName") and not meta.get("clientName"):
                    meta["clientName"] = existing_meta["clientName"]
                if existing_meta.get("linkedBy"):
                    meta["linkedBy"] = existing_meta["linkedBy"]
                doc["metadata"] = meta
            if existing.get("ignoredAt") and "ignoredAt" not in doc:
                doc["ignoredAt"] = existing["ignoredAt"]
                if existing.get("status"):
                    doc["status"] = existing["status"]
            await db.communications.update_one(
                {"userId": user_id, "id": existing["id"]},
                {"$set": {k: v for k, v in doc.items() if k not in ("id", "userId")}},
            )
            return doc

    await db.communications.insert_one(doc)
    return doc


async def upsert_from_gmail_email_doc(db, email_doc: dict) -> dict:
    """Feed Communication Center from a Gmail ``email_messages`` document."""
    direction = email_doc.get("direction") or "inbound"
    if direction not in ("inbound", "outbound", "internal"):
        direction = "inbound"
    meta = {
        "clientName": email_doc.get("clientName"),
        "fromEmail": email_doc.get("fromEmail"),
        "fromName": email_doc.get("fromName"),
        "toEmail": email_doc.get("toEmail"),
        "toEmails": email_doc.get("toEmails") or [],
        "threadId": email_doc.get("threadId"),
        "matchedBy": email_doc.get("matchedBy"),
        "emailMessageId": email_doc.get("id"),
        "accountEmail": email_doc.get("accountEmail"),
        "channel": "email",
        "source": "gmail",
    }
    doc = build_communication_doc(
        user_id=email_doc["userId"],
        type="email",
        client_id=email_doc.get("clientId"),
        direction=direction,  # type: ignore[arg-type]
        provider=email_doc.get("provider") or "gmail",
        provider_id=email_doc.get("providerMessageId"),
        subject=email_doc.get("subject"),
        preview=email_doc.get("preview"),
        created_at=email_doc.get("sentAt") or email_doc.get("createdAt"),
        attachments_count=int(email_doc.get("attachmentCount") or 0),
        external_url=email_doc.get("gmailUrl"),
        metadata=meta,
    )
    return await upsert_communication(db, doc)


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
