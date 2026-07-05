import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException, UploadFile

from analysis import AnalysisContext, get_analyzer
from client_matching import match_clients
from events import record_event
from import_handlers import get_import_handler, is_confirm_kind_supported
from import_models import (
    IMPORT_FILE_EXTENSIONS,
    IMPORT_SESSION_TTL_HOURS,
    AnalysisResultData,
    ClientMatch,
    CreatedEntities,
    ImportConfirmPayload,
    ImportConfirmResponse,
    ImportFileInfo,
    ImportSessionListResponse,
    ImportSessionPublic,
    ImportSessionStatus,
    utc_now_iso,
)
from storage import get_storage

IMPORT_MIME_TYPES = {
    "pdf": "application/pdf",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}

SESSION_PROJECTION = {"_id": 0, "userId": 0}


def _user_filter(user_id: str) -> dict:
    return {"userId": user_id}


def _safe_filename(name: str) -> str:
    base = Path(name).name
    cleaned = re.sub(r"[^\w.\- ]", "_", base).strip()
    if not cleaned or cleaned in {".", ".."}:
        cleaned = "file"
    return cleaned[:200]


def _extension_from_filename(filename: str) -> str:
    return Path(filename).suffix.lstrip(".").lower()


def _validate_import_extension(ext: str) -> str:
    if ext not in IMPORT_FILE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail={
                "message": (
                    "File type not allowed for import. Allowed: "
                    + ", ".join(sorted(IMPORT_FILE_EXTENSIONS))
                )
            },
        )
    return ext


def _validate_import_mime(ext: str, content_type: Optional[str]) -> str:
    expected = IMPORT_MIME_TYPES[ext]
    if content_type:
        normalized = content_type.split(";")[0].strip().lower()
        if normalized in ("application/octet-stream", "binary/octet-stream"):
            return expected
    return expected


def _import_storage_key(user_id: str, session_id: str, filename: str) -> str:
    return f"users/{user_id}/imports/{session_id}/{filename}"


def _document_storage_key(user_id: str, document_id: str, filename: str) -> str:
    return f"users/{user_id}/documents/{document_id}/{filename}"


def _expires_at_iso() -> str:
    return (
        datetime.now(timezone.utc) + timedelta(hours=IMPORT_SESSION_TTL_HOURS)
    ).isoformat()


def _session_public(doc: dict) -> ImportSessionPublic:
    return ImportSessionPublic(
        id=doc["id"],
        status=doc["status"],
        file=ImportFileInfo(**doc["file"]),
        analysis=AnalysisResultData(**doc["analysis"]),
        detectedKind=doc["detectedKind"],
        clientMatches=[ClientMatch(**match) for match in doc.get("clientMatches", [])],
        duplicateWarning=doc.get("duplicateWarning"),
        createdEntities=(
            CreatedEntities(**doc["createdEntities"])
            if doc.get("createdEntities")
            else None
        ),
        confirmedAt=doc.get("confirmedAt"),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
        expiresAt=doc["expiresAt"],
    )


async def _load_owned_session(db, user_id: str, session_id: str) -> dict:
    doc = await db.import_sessions.find_one(
        {**_user_filter(user_id), "id": session_id},
        SESSION_PROJECTION,
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Import session not found."})
    return doc


def _client_display_name(client: dict) -> str:
    company = (client.get("company") or "").strip()
    if company:
        return company
    return client["name"]


async def _find_duplicate_warning(
    db,
    user_id: str,
    kind: str,
    client_id: str,
    external_number: Optional[str],
) -> Optional[str]:
    if not external_number or not external_number.strip():
        return None
    if not is_confirm_kind_supported(kind):
        return None

    handler = get_import_handler(kind)
    query = handler.duplicate_query(user_id, client_id, external_number.strip())
    collection = db.quotes if kind == "quote" else db.invoices
    existing = await collection.find_one(query, {"_id": 1, "number": 1})
    if existing:
        label = "devis" if kind == "quote" else "facture"
        return (
            f"Un {label} avec le numéro externe « {external_number.strip()} » "
            f"existe déjà pour ce client ({existing.get('number')})."
        )
    return None


async def analyze_import_file(
    db,
    user_id: str,
    file: UploadFile,
) -> ImportSessionPublic:
    if not file.filename:
        raise HTTPException(status_code=400, detail={"message": "Filename is required."})

    ext = _validate_import_extension(_extension_from_filename(file.filename))
    mime_type = _validate_import_mime(ext, file.content_type)

    content = await file.read()
    size = len(content)
    max_bytes = int(os.environ.get("MAX_UPLOAD_BYTES", "26214400"))
    if size == 0:
        raise HTTPException(status_code=400, detail={"message": "File is empty."})
    if size > max_bytes:
        raise HTTPException(
            status_code=400,
            detail={"message": f"File exceeds maximum size of {max_bytes} bytes."},
        )

    session_id = str(uuid.uuid4())
    safe_name = _safe_filename(file.filename)
    storage = get_storage()
    storage_key = _import_storage_key(user_id, session_id, safe_name)
    now = utc_now_iso()

    try:
        await storage.save(storage_key, content)
    except Exception:
        raise HTTPException(status_code=500, detail={"message": "Failed to store import file."})

    analyzer = get_analyzer()
    try:
        analysis = await analyzer.analyze(
            content,
            AnalysisContext(
                filename=safe_name,
                mime_type=mime_type,
                extension=ext,
                user_id=user_id,
            ),
        )
    except Exception:
        try:
            await storage.delete(storage_key)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail={"message": "Document analysis failed."})

    clients_cursor = db.clients.find(
        _user_filter(user_id),
        {"_id": 0, "id": 1, "name": 1, "company": 1, "email": 1, "phone": 1, "address": 1, "city": 1},
    )
    clients = [client async for client in clients_cursor]
    client_matches = match_clients(clients, analysis.normalized)

    duplicate_warning = None
    if client_matches and analysis.normalized.externalNumber:
        duplicate_warning = await _find_duplicate_warning(
            db,
            user_id,
            analysis.detectedKind,
            client_matches[0].clientId,
            analysis.normalized.externalNumber,
        )

    session_doc = {
        "id": session_id,
        "userId": user_id,
        "status": "pending",
        "file": {
            "name": safe_name,
            "mimeType": mime_type,
            "extension": ext,
            "sizeBytes": size,
            "storageProvider": storage.provider_name(),
            "storageKey": storage_key,
        },
        "analysis": analysis.model_dump(),
        "detectedKind": analysis.detectedKind,
        "clientMatches": [match.model_dump() for match in client_matches],
        "duplicateWarning": duplicate_warning,
        "createdEntities": None,
        "confirmedAt": None,
        "confirmedByUserId": None,
        "createdAt": now,
        "updatedAt": now,
        "expiresAt": _expires_at_iso(),
    }

    await db.import_sessions.insert_one(session_doc)
    return _session_public(session_doc)


async def get_import_session(db, user_id: str, session_id: str) -> ImportSessionPublic:
    doc = await _load_owned_session(db, user_id, session_id)
    return _session_public(doc)


async def list_import_sessions(
    db,
    user_id: str,
    *,
    limit: int = 20,
) -> ImportSessionListResponse:
    query = _user_filter(user_id)
    total = await db.import_sessions.count_documents(query)
    cursor = (
        db.import_sessions.find(query, SESSION_PROJECTION)
        .sort("createdAt", -1)
        .limit(limit)
    )
    items = [_session_public(doc) async for doc in cursor]
    return ImportSessionListResponse(items=items, total=total)


async def cancel_import_session(db, user_id: str, session_id: str) -> None:
    doc = await _load_owned_session(db, user_id, session_id)
    if doc["status"] == "confirmed":
        raise HTTPException(
            status_code=409,
            detail={"message": "Confirmed import sessions cannot be cancelled."},
        )

    now = utc_now_iso()
    await db.import_sessions.update_one(
        {"userId": user_id, "id": session_id},
        {"$set": {"status": "cancelled", "updatedAt": now}},
    )


async def _resolve_client_for_confirm(
    db,
    user_id: str,
    payload: ImportConfirmPayload,
) -> tuple[str, str, bool]:
    if payload.clientAction == "use_existing":
        if not payload.clientId:
            raise HTTPException(status_code=422, detail={"message": "clientId is required."})
        client = await db.clients.find_one(
            {**_user_filter(user_id), "id": payload.clientId},
            {"_id": 0},
        )
        if not client:
            raise HTTPException(status_code=404, detail={"message": "Client not found."})
        return client["id"], _client_display_name(client), False

    if payload.clientAction != "create_new" or not payload.clientData:
        raise HTTPException(
            status_code=422,
            detail={"message": "clientData is required when creating a new client."},
        )

    now = utc_now_iso()
    client_doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "name": payload.clientData.name.strip(),
        "contactName": payload.clientData.contactName,
        "email": str(payload.clientData.email) if payload.clientData.email else None,
        "phone": payload.clientData.phone,
        "company": payload.clientData.company,
        "activity": None,
        "address": payload.clientData.address,
        "city": payload.clientData.city,
        "status": "new",
        "notes": None,
        "createdAt": now,
        "updatedAt": now,
    }
    await db.clients.insert_one(client_doc)
    await record_event(
        db,
        user_id,
        "client_created",
        "client",
        client_doc["id"],
        client_id=client_doc["id"],
        metadata={
            "clientName": _client_display_name(client_doc),
            "source": "import",
        },
    )
    return client_doc["id"], _client_display_name(client_doc), True


async def _attach_source_document(
    db,
    user_id: str,
    *,
    session_doc: dict,
    client_id: str,
    client_name: str,
) -> str:
    file_info = session_doc["file"]
    storage = get_storage()
    source_key = file_info["storageKey"]

    try:
        source_path = await storage.get_path(source_key)
        content = source_path.read_bytes()
    except Exception:
        raise HTTPException(status_code=500, detail={"message": "Failed to read import file."})

    document_id = str(uuid.uuid4())
    dest_key = _document_storage_key(user_id, document_id, file_info["name"])
    now = utc_now_iso()

    try:
        await storage.save(dest_key, content)
    except Exception:
        raise HTTPException(status_code=500, detail={"message": "Failed to attach import document."})

    doc = {
        "id": document_id,
        "userId": user_id,
        "clientId": client_id,
        "clientName": client_name,
        "name": file_info["name"],
        "mimeType": file_info["mimeType"],
        "extension": file_info["extension"],
        "sizeBytes": file_info["sizeBytes"],
        "storageProvider": storage.provider_name(),
        "storageKey": dest_key,
        "importSessionId": session_doc["id"],
        "createdAt": now,
        "updatedAt": now,
    }
    await db.documents.insert_one(doc)
    await record_event(
        db,
        user_id,
        "document_uploaded",
        "document",
        document_id,
        client_id=client_id,
        metadata={
            "fileName": doc["name"],
            "clientName": client_name,
            "size": doc["sizeBytes"],
            "importSessionId": session_doc["id"],
            "source": "import",
        },
    )
    return document_id


async def confirm_import_session(
    db,
    user_id: str,
    session_id: str,
    payload: ImportConfirmPayload,
) -> ImportConfirmResponse:
    session_doc = await _load_owned_session(db, user_id, session_id)

    if session_doc["status"] == "confirmed":
        return ImportConfirmResponse(
            session=_session_public(session_doc),
            created=CreatedEntities(**session_doc["createdEntities"]),
        )

    if session_doc["status"] != "pending":
        raise HTTPException(
            status_code=409,
            detail={"message": "Import session is not available for confirmation."},
        )

    if not is_confirm_kind_supported(payload.targetKind):
        raise HTTPException(
            status_code=422,
            detail={
                "message": (
                    f"Import confirmation is not yet supported for kind "
                    f"« {payload.targetKind} »."
                )
            },
        )

    if payload.fields.amountHT is None:
        raise HTTPException(status_code=422, detail={"message": "amountHT is required."})

    client_id, client_name, client_created = await _resolve_client_for_confirm(
        db, user_id, payload
    )

    duplicate = await _find_duplicate_warning(
        db,
        user_id,
        payload.targetKind,
        client_id,
        payload.fields.externalNumber,
    )
    if duplicate:
        raise HTTPException(status_code=409, detail={"message": duplicate})

    document_id = await _attach_source_document(
        db,
        user_id,
        session_doc=session_doc,
        client_id=client_id,
        client_name=client_name,
    )

    handler = get_import_handler(payload.targetKind)
    created = await handler.create_entity(
        db,
        user_id,
        client_id=client_id,
        client_name=client_name,
        fields=payload.fields,
        import_session_id=session_id,
        source_document_id=document_id,
    )
    created.clientCreated = client_created

    now = utc_now_iso()
    update = {
        "status": "confirmed",
        "targetKind": payload.targetKind,
        "confirmedAt": now,
        "confirmedByUserId": user_id,
        "createdEntities": created.model_dump(),
        "updatedAt": now,
    }
    await db.import_sessions.update_one(
        {"userId": user_id, "id": session_id},
        {"$set": update},
    )

    session_doc.update(update)
    return ImportConfirmResponse(session=_session_public(session_doc), created=created)
