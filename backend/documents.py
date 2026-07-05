import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from auth import get_current_user, get_db
from events import record_event
from storage import get_storage

documents_router = APIRouter(prefix="/documents", tags=["documents"])

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", "26214400"))

ALLOWED_EXTENSIONS = {
    "pdf": "application/pdf",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "zip": "application/zip",
    "dwg": "application/acad",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

PREVIEW_EXTENSIONS = {"pdf", "jpg", "jpeg", "png", "webp"}

DOCUMENT_PROJECTION = {"_id": 0, "userId": 0}


class DocumentUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    clientId: Optional[str] = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be empty.")
        return stripped


class DocumentPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    clientId: Optional[str] = None
    clientName: Optional[str] = None
    name: str
    mimeType: str
    extension: str
    sizeBytes: int
    storageProvider: str
    createdAt: str
    updatedAt: str


class DocumentListResponse(BaseModel):
    items: List[DocumentPublic]
    total: int


def document_public(doc: dict) -> DocumentPublic:
    return DocumentPublic(
        id=doc["id"],
        clientId=doc.get("clientId"),
        clientName=doc.get("clientName"),
        name=doc["name"],
        mimeType=doc["mimeType"],
        extension=doc["extension"],
        sizeBytes=doc["sizeBytes"],
        storageProvider=doc["storageProvider"],
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    )


def _document_event_metadata(doc: dict) -> dict:
    metadata = {"fileName": doc["name"]}
    if doc.get("clientName"):
        metadata["clientName"] = doc["clientName"]
    if doc.get("sizeBytes") is not None:
        metadata["size"] = doc["sizeBytes"]
    return metadata


def _user_filter(user_id: str) -> dict:
    return {"userId": user_id}


def _safe_filename(name: str) -> str:
    base = Path(name).name
    cleaned = re.sub(r"[^\w.\- ]", "_", base).strip()
    if not cleaned or cleaned in {".", ".."}:
        cleaned = "file"
    return cleaned[:200]


def _extension_from_filename(filename: str) -> str:
    ext = Path(filename).suffix.lstrip(".").lower()
    return ext


def _validate_extension(ext: str) -> str:
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail={
                "message": (
                    "File type not allowed. Allowed: "
                    + ", ".join(sorted(ALLOWED_EXTENSIONS.keys()))
                )
            },
        )
    return ext


def _validate_mime(ext: str, content_type: Optional[str]) -> str:
    expected = ALLOWED_EXTENSIONS[ext]
    if content_type:
        normalized = content_type.split(";")[0].strip().lower()
        if normalized in ("application/octet-stream", "binary/octet-stream"):
            return expected
        if normalized != expected.lower():
            alt_map = {
                "image/jpg": "image/jpeg",
                "application/x-zip-compressed": "application/zip",
            }
            if alt_map.get(normalized) != expected.lower() and normalized != expected.lower():
                pass
    return expected


def _storage_key(user_id: str, document_id: str, filename: str) -> str:
    return f"users/{user_id}/documents/{document_id}/{filename}"


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


async def _get_owned_document(db, user_id: str, document_id: str) -> dict:
    doc = await db.documents.find_one(
        {**_user_filter(user_id), "id": document_id},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Document not found."})
    return doc


def _file_response(path: Path, mime_type: str, filename: str, inline: bool) -> FileResponse:
    disposition = "inline" if inline else "attachment"
    return FileResponse(
        path=str(path),
        media_type=mime_type,
        filename=filename,
        content_disposition_type=disposition,
    )


@documents_router.post("/upload", response_model=DocumentPublic, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    clientId: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail={"message": "Filename is required."})

    ext = _validate_extension(_extension_from_filename(file.filename))
    mime_type = _validate_mime(ext, file.content_type)

    content = await file.read()
    size = len(content)
    if size == 0:
        raise HTTPException(status_code=400, detail={"message": "File is empty."})
    if size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail={"message": f"File exceeds maximum size of {MAX_UPLOAD_BYTES} bytes."},
        )

    user_id = current_user["id"]
    client_id = clientId.strip() if clientId and clientId.strip() else None
    resolved_client_id, client_name = await _resolve_client(db, user_id, client_id)

    document_id = str(uuid.uuid4())
    safe_name = _safe_filename(file.filename)
    storage = get_storage()
    key = _storage_key(user_id, document_id, safe_name)
    now = datetime.now(timezone.utc).isoformat()

    try:
        await storage.save(key, content)
    except Exception:
        raise HTTPException(status_code=500, detail={"message": "Failed to store file."})

    doc = {
        "id": document_id,
        "userId": user_id,
        "clientId": resolved_client_id,
        "clientName": client_name,
        "name": safe_name,
        "mimeType": mime_type,
        "extension": ext,
        "sizeBytes": size,
        "storageProvider": storage.provider_name(),
        "storageKey": key,
        "createdAt": now,
        "updatedAt": now,
    }

    try:
        await db.documents.insert_one(doc)
    except Exception:
        try:
            await storage.delete(key)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail={"message": "Failed to save document metadata."})

    await record_event(
        db,
        user_id,
        "document_uploaded",
        "document",
        document_id,
        client_id=resolved_client_id,
        metadata=_document_event_metadata(doc),
    )

    return document_public(doc)


@documents_router.get("", response_model=DocumentListResponse)
async def list_documents(
    clientId: Optional[str] = Query(None),
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
            return DocumentListResponse(items=[], total=0)
        query["clientId"] = clientId

    total = await db.documents.count_documents(query)
    cursor = db.documents.find(query, DOCUMENT_PROJECTION).sort("updatedAt", -1)
    items = [document_public(doc) async for doc in cursor]
    return DocumentListResponse(items=items, total=total)


@documents_router.get("/{document_id}", response_model=DocumentPublic)
async def get_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    doc = await db.documents.find_one(
        {**_user_filter(current_user["id"]), "id": document_id},
        DOCUMENT_PROJECTION,
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Document not found."})
    return document_public(doc)


@documents_router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    doc = await _get_owned_document(db, current_user["id"], document_id)
    storage = get_storage()
    try:
        path = await storage.get_path(doc["storageKey"])
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail={"message": "File not found in storage."})

    return _file_response(path, doc["mimeType"], doc["name"], inline=False)


@documents_router.get("/{document_id}/preview")
async def preview_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    doc = await _get_owned_document(db, current_user["id"], document_id)
    if doc["extension"] not in PREVIEW_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail={"message": "Preview is not available for this file type."},
        )

    storage = get_storage()
    try:
        path = await storage.get_path(doc["storageKey"])
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail={"message": "File not found in storage."})

    return _file_response(path, doc["mimeType"], doc["name"], inline=True)


@documents_router.put("/{document_id}", response_model=DocumentPublic)
async def update_document(
    document_id: str,
    body: DocumentUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    existing = await _get_owned_document(db, current_user["id"], document_id)
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return document_public(existing)

    if "clientId" in updates:
        client_id, client_name = await _resolve_client(
            db, current_user["id"], updates["clientId"]
        )
        updates["clientId"] = client_id
        updates["clientName"] = client_name

    merged = {**existing, **updates}
    merged["updatedAt"] = datetime.now(timezone.utc).isoformat()

    await db.documents.update_one(
        {"userId": current_user["id"], "id": document_id},
        {"$set": {k: merged[k] for k in merged if k not in ("id", "userId", "createdAt", "storageKey", "storageProvider")}},
    )

    public_doc = {k: v for k, v in merged.items() if k not in ("userId", "_id", "storageKey")}
    return document_public(public_doc)


@documents_router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    doc = await _get_owned_document(db, current_user["id"], document_id)
    storage = get_storage()

    try:
        await storage.delete(doc["storageKey"])
    except Exception:
        pass

    result = await db.documents.delete_one(
        {**_user_filter(current_user["id"]), "id": document_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail={"message": "Document not found."})

    await record_event(
        db,
        current_user["id"],
        "document_deleted",
        "document",
        document_id,
        client_id=doc.get("clientId"),
        metadata=_document_event_metadata(doc),
    )
