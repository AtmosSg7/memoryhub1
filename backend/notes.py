import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator

from auth import get_current_user, get_db
from events import record_event

notes_router = APIRouter(prefix="/notes", tags=["notes"])

NoteType = Literal["general", "phone", "meeting", "visit", "reminder"]
VALID_NOTE_TYPES = {"general", "phone", "meeting", "visit", "reminder"}
TYPE_ALIASES = {"site": "visit"}
DEFAULT_TITLE = "Note sans titre"

NOTE_PROJECTION = {"_id": 0, "userId": 0}


class NoteCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    content: str = Field(..., min_length=1, max_length=10000)
    clientId: Optional[str] = None
    type: NoteType = "general"
    noteDate: Optional[str] = None

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Content cannot be empty.")
        return stripped

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return value.strip() or None


class NoteUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = Field(None, min_length=1, max_length=10000)
    clientId: Optional[str] = None
    type: Optional[NoteType] = None
    noteDate: Optional[str] = None

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("Content cannot be empty.")
        return stripped

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return value.strip() or None


class NotePublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    content: str
    clientId: Optional[str] = None
    clientName: Optional[str] = None
    type: NoteType = "general"
    noteDate: str
    createdAt: str
    updatedAt: str


class NoteListResponse(BaseModel):
    items: List[NotePublic]
    total: int


def _normalize_type(raw: Optional[str]) -> str:
    if not raw:
        return "general"
    if raw in TYPE_ALIASES:
        return TYPE_ALIASES[raw]
    if raw in VALID_NOTE_TYPES:
        return raw
    return "general"


def _resolve_note_date(doc: dict) -> str:
    return doc.get("noteDate") or doc.get("createdAt", "")


def _parse_note_date(value: Optional[str], fallback: str) -> str:
    if not value or not str(value).strip():
        return fallback
    try:
        normalized = str(value).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except ValueError:
        return fallback


def note_public(doc: dict) -> NotePublic:
    return NotePublic(
        id=doc["id"],
        title=doc.get("title") or DEFAULT_TITLE,
        content=doc["content"],
        clientId=doc.get("clientId"),
        clientName=doc.get("clientName"),
        type=_normalize_type(doc.get("type")),
        noteDate=_resolve_note_date(doc),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    )


def _note_excerpt(content: str, max_len: int = 120) -> str:
    trimmed = (content or "").strip()
    if len(trimmed) <= max_len:
        return trimmed
    return trimmed[:max_len].rstrip() + "…"


def _note_event_metadata(doc: dict) -> dict:
    metadata = {
        "noteTitle": doc.get("title") or DEFAULT_TITLE,
        "noteType": _normalize_type(doc.get("type")),
        "noteDate": _resolve_note_date(doc),
    }
    if doc.get("clientName"):
        metadata["clientName"] = doc["clientName"]
    if doc.get("content"):
        metadata["excerpt"] = _note_excerpt(doc["content"])
    return metadata


def _user_filter(user_id: str) -> dict:
    return {"userId": user_id}


def _resolve_title(title: Optional[str]) -> str:
    if title and title.strip():
        return title.strip()
    return DEFAULT_TITLE


def _type_filter(normalized_type: str) -> dict:
    if normalized_type == "visit":
        return {"$in": ["visit", "site"]}
    return normalized_type


async def _resolve_client(db, user_id: str, client_id: Optional[str]):
    if not client_id:
        return None, None

    client = await db.clients.find_one(
        {**_user_filter(user_id), "id": client_id},
        {"_id": 0, "company": 1, "name": 1},
    )
    if not client:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})

    client_name = (client.get("company") or "").strip() or client.get("name")
    return client_id, client_name


@notes_router.post("", response_model=NotePublic, status_code=201)
async def create_note(
    body: NoteCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    client_id, client_name = await _resolve_client(db, current_user["id"], body.clientId)
    now = datetime.now(timezone.utc).isoformat()
    note_date = _parse_note_date(body.noteDate, now)
    doc = {
        "id": str(uuid.uuid4()),
        "userId": current_user["id"],
        "title": _resolve_title(body.title),
        "content": body.content,
        "clientId": client_id,
        "clientName": client_name,
        "type": _normalize_type(body.type),
        "noteDate": note_date,
        "createdAt": now,
        "updatedAt": now,
    }
    await db.notes.insert_one(doc)
    await record_event(
        db,
        current_user["id"],
        "note_created",
        "note",
        doc["id"],
        client_id=client_id,
        metadata=_note_event_metadata(doc),
    )
    return note_public(doc)


@notes_router.get("", response_model=NoteListResponse)
async def list_notes(
    clientId: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    query = _user_filter(current_user["id"])

    if clientId:
        client = await db.clients.find_one(
            {**_user_filter(current_user["id"]), "id": clientId},
            {"_id": 1},
        )
        if not client:
            return NoteListResponse(items=[], total=0)
        query["clientId"] = clientId

    if type:
        normalized = _normalize_type(type)
        query["type"] = _type_filter(normalized)

    total = await db.notes.count_documents(query)
    cursor = db.notes.aggregate([
        {"$match": query},
        {"$addFields": {"_sortDate": {"$ifNull": ["$noteDate", "$createdAt"]}}},
        {"$sort": {"_sortDate": -1}},
        {"$project": {"_id": 0, "userId": 0, "_sortDate": 0}},
    ])
    items = [note_public(doc) async for doc in cursor]
    return NoteListResponse(items=items, total=total)


@notes_router.get("/{note_id}", response_model=NotePublic)
async def get_note(
    note_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    doc = await db.notes.find_one(
        {**_user_filter(current_user["id"]), "id": note_id},
        NOTE_PROJECTION,
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Note not found."})
    return note_public(doc)


@notes_router.put("/{note_id}", response_model=NotePublic)
async def update_note(
    note_id: str,
    body: NoteUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    existing = await db.notes.find_one(
        {**_user_filter(current_user["id"]), "id": note_id},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail={"message": "Note not found."})

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return note_public(existing)

    if "clientId" in updates:
        client_id, client_name = await _resolve_client(
            db, current_user["id"], updates["clientId"]
        )
        updates["clientId"] = client_id
        updates["clientName"] = client_name

    if "title" in updates:
        updates["title"] = _resolve_title(updates["title"])

    if "type" in updates:
        updates["type"] = _normalize_type(updates["type"])

    if "noteDate" in updates:
        fallback = _resolve_note_date(existing)
        updates["noteDate"] = _parse_note_date(updates["noteDate"], fallback)

    merged = {**existing, **updates}
    merged["updatedAt"] = datetime.now(timezone.utc).isoformat()
    if not merged.get("noteDate"):
        merged["noteDate"] = merged.get("createdAt")

    await db.notes.update_one(
        {"userId": current_user["id"], "id": note_id},
        {"$set": {k: merged[k] for k in merged if k not in ("id", "userId", "createdAt")}},
    )

    await record_event(
        db,
        current_user["id"],
        "note_updated",
        "note",
        note_id,
        client_id=merged.get("clientId"),
        metadata=_note_event_metadata(merged),
    )

    public_doc = {k: v for k, v in merged.items() if k not in ("userId", "_id")}
    return note_public(public_doc)


@notes_router.delete("/{note_id}", status_code=204)
async def delete_note(
    note_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    existing = await db.notes.find_one(
        {**_user_filter(current_user["id"]), "id": note_id},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail={"message": "Note not found."})

    result = await db.notes.delete_one(
        {**_user_filter(current_user["id"]), "id": note_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail={"message": "Note not found."})

    await record_event(
        db,
        current_user["id"],
        "note_deleted",
        "note",
        note_id,
        client_id=existing.get("clientId"),
        metadata=_note_event_metadata(existing),
    )
