import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from auth import get_current_user, get_db

events_router = APIRouter(prefix="/events", tags=["events"])

EventType = Literal[
    "client_created",
    "client_updated",
    "note_created",
    "note_updated",
    "note_deleted",
    "document_uploaded",
    "document_deleted",
    "quote_created",
    "quote_updated",
    "quote_accepted",
    "quote_deleted",
    "quote_converted",
    "invoice_created",
    "invoice_updated",
    "invoice_deleted",
    "invoice_paid",
    "invoice_payment_recorded",
    "invoice_reopened",
    "follow_up_recorded",
    "document_send_prepared",
]

EntityType = Literal["client", "note", "document", "quote", "invoice"]

DEFAULT_RECENT_LIMIT = 10
DEFAULT_CLIENT_LIMIT = 50
MAX_LIMIT = 100

EVENT_PROJECTION = {"_id": 0, "userId": 0}


class EventPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    type: EventType
    entityType: EntityType
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
        type=doc["type"],
        entityType=doc["entityType"],
        entityId=doc["entityId"],
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
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    user_id = current_user["id"]
    query = _user_filter(user_id)
    total = await db.events.count_documents(query)
    cursor = (
        db.events.find(query, EVENT_PROJECTION)
        .sort("createdAt", -1)
        .limit(limit)
    )
    items = [event_public(doc) async for doc in cursor]
    return EventListResponse(items=items, total=total)


@events_router.get("", response_model=EventListResponse)
async def list_events(
    clientId: Optional[str] = Query(None),
    limit: int = Query(DEFAULT_CLIENT_LIMIT, ge=1, le=MAX_LIMIT),
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
        query["clientId"] = clientId

    total = await db.events.count_documents(query)
    cursor = (
        db.events.find(query, EVENT_PROJECTION)
        .sort("createdAt", -1)
        .limit(limit)
    )
    items = [event_public(doc) async for doc in cursor]
    return EventListResponse(items=items, total=total)
