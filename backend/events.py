"""Timeline / activity events — append-only user-scoped ledger.

Write via ``record_event`` only. Reads power the global activity feed and
the client timeline (``GET /events?clientId=``).

Future channels (call / email / WhatsApp / calendar / contacts) are reserved
in ``EventType`` / ``EntityType`` but not productized yet.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from auth import get_current_user, get_db

events_router = APIRouter(prefix="/events", tags=["events"])

EventType = Literal[
    # Client
    "client_created",
    "client_updated",
    # Notes
    "note_created",
    "note_updated",
    "note_deleted",
    # Uploaded files
    "document_uploaded",
    "document_deleted",
    # Quotes
    "quote_created",
    "quote_updated",
    "quote_accepted",
    "quote_rejected",
    "quote_deleted",
    "quote_converted",
    "quote_sent",
    "quote_viewed",
    "quote_expired",
    "quote_archived",
    # Invoices
    "invoice_created",
    "invoice_updated",
    "invoice_deleted",
    "invoice_paid",
    "invoice_payment_recorded",
    "invoice_reopened",
    "invoice_issued",
    "invoice_sent",
    "invoice_viewed",
    "invoice_archived",
    "invoice_overdue",
    "invoice_validated",
    "invoice_validation_failed",
    "invoice_ready_for_export",
    "invoice_exported",
    # Follow-up / send
    "follow_up_recorded",
    "document_send_prepared",
    # Future channels — reserved, not productized
    "call_logged",
    "email_sent",
    "email_received",
    "whatsapp_message",
    "calendar_event_synced",
    "contacts_synced",
]

EntityType = Literal[
    "client",
    "note",
    "document",
    "quote",
    "invoice",
    # Future channels — reserved
    "call",
    "email",
    "whatsapp",
    "calendar",
    "contacts",
]

DEFAULT_RECENT_LIMIT = 10
DEFAULT_CLIENT_LIMIT = 50
MAX_LIMIT = 200

EVENT_PROJECTION = {"_id": 0, "userId": 0}


class EventPublic(BaseModel):
    """Read model — ``type`` / ``entityType`` are open strings for forward-compat."""

    model_config = ConfigDict(extra="ignore")

    id: str
    type: str
    entityType: str
    entityId: str
    clientId: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    createdAt: str


class EventListResponse(BaseModel):
    items: List[EventPublic]
    total: int


def _user_filter(user_id: str) -> dict:
    return {"userId": user_id}


def event_public(doc: dict) -> EventPublic:
    return EventPublic(
        id=doc["id"],
        type=str(doc.get("type") or "client_updated"),
        entityType=str(doc.get("entityType") or "client"),
        entityId=str(doc.get("entityId") or ""),
        clientId=doc.get("clientId"),
        metadata=doc.get("metadata") or {},
        createdAt=doc["createdAt"],
    )


async def record_event(
    db,
    user_id: str,
    event_type: EventType,
    entity_type: EntityType,
    entity_id: str,
    *,
    client_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> dict:
    """Single entry point for writing timeline events."""
    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "type": event_type,
        "entityType": entity_type,
        "entityId": entity_id,
        "clientId": client_id,
        "metadata": metadata or {},
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await db.events.insert_one(doc)
    return doc


@events_router.get("/recent", response_model=EventListResponse)
async def recent_events(
    limit: int = Query(DEFAULT_RECENT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    user_id = current_user["id"]
    query = _user_filter(user_id)
    total = await db.events.count_documents(query)
    cursor = (
        db.events.find(query, EVENT_PROJECTION)
        .sort("createdAt", -1)
        .skip(offset)
        .limit(limit)
    )
    items = [event_public(doc) async for doc in cursor]
    return EventListResponse(items=items, total=total)


@events_router.get("", response_model=EventListResponse)
async def list_events(
    clientId: Optional[str] = Query(None),
    limit: int = Query(DEFAULT_CLIENT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    user_id = current_user["id"]
    query = _user_filter(user_id)

    if clientId:
        client = await db.clients.find_one(
            {**_user_filter(user_id), "id": clientId},
            {"_id": 1},
        )
        if not client:
            raise HTTPException(status_code=404, detail={"message": "Client not found."})
        # Universal timeline: events ledger + Communication Center
        from timeline_service import list_universal_client_timeline

        return await list_universal_client_timeline(
            db, user_id, clientId, limit=limit, offset=offset
        )

    total = await db.events.count_documents(query)
    cursor = (
        db.events.find(query, EVENT_PROJECTION)
        .sort("createdAt", -1)
        .skip(offset)
        .limit(limit)
    )
    items = [event_public(doc) async for doc in cursor]
    return EventListResponse(items=items, total=total)
