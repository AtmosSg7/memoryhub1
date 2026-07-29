import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException, UploadFile

from file_validation import validate_file_magic
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
from analysis import AnalysisContext, AnalysisPage, get_analyzer
from ai_import_estimator import ImportEstimateInput, estimate_import
from import_limits import ImportUploadInput, validate_prepared_limits, validate_upload_inputs
from import_preprocessor import ImportPage, RawUpload, prepare_import_document
from analysis_presentation_service import (
    import_analysis_cost_credits,
    import_estimate_public,
    insufficient_analyses_detail,
)
from ai_usage_service import consume_for_import, require_credits_for_import
from ai_usage_event_service import record_import_ai_usage
from credit_exceptions import InsufficientCreditsError
from observability import get_logger
from storage import get_storage

logger = get_logger(__name__)

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


def _check_session_not_expired(doc: dict) -> None:
    expires_at = doc.get("expiresAt")
    if not expires_at:
        return
    exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    if exp_dt.tzinfo is None:
        exp_dt = exp_dt.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp_dt:
        raise HTTPException(status_code=410, detail={"message": "Import session has expired."})


async def _load_owned_session(db, user_id: str, session_id: str) -> dict:
    doc = await db.import_sessions.find_one(
        {**_user_filter(user_id), "id": session_id},
        SESSION_PROJECTION,
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Import session not found."})
    _check_session_not_expired(doc)
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


async def estimate_import_file(
    db,
    *,
    extension: str,
    size_bytes: int,
    mime_type: Optional[str] = None,
    content: Optional[bytes] = None,
    file_count: int = 1,
    page_count: Optional[int] = None,
) -> dict:
    """Preview credit cost before running OpenAI analysis."""
    if size_bytes <= 0:
        raise HTTPException(status_code=400, detail={"message": "File size must be positive."})
    ext = _validate_import_extension(_normalize_extension(extension))
    pages = page_count
    if pages is None and content is not None and ext == "pdf":
        from ai_import_estimator import estimate_page_count

        pages = estimate_page_count(extension=ext, size_bytes=size_bytes, content=content)
    result = await estimate_import(
        db,
        ImportEstimateInput(extension=ext, size_bytes=size_bytes, mime_type=mime_type),
        content=content,
    )
    public = import_estimate_public(
        tier_key=result.tier_key,
        page_count_estimate=pages or result.page_count_estimate,
        requires_ocr=result.requires_ocr,
        factors=result.factors,
    ).model_dump()
    public["fileCount"] = max(1, file_count)
    return public


async def estimate_import_files(
    db,
    *,
    files: List[dict],
) -> dict:
    if not files:
        raise HTTPException(status_code=400, detail={"message": "At least one file is required."})

    total_size = sum(int(item.get("sizeBytes") or 0) for item in files)
    primary = files[0]
    extension = _normalize_extension(primary.get("extension") or "")
    if not extension:
        raise HTTPException(status_code=400, detail={"message": "File extension is required."})

    return await estimate_import_file(
        db,
        extension=extension,
        size_bytes=total_size,
        mime_type=primary.get("mimeType"),
        file_count=len(files),
    )


def _normalize_extension(extension: str) -> str:
    return (extension or "").strip().lower().lstrip(".")


async def _read_uploads(files: List[UploadFile]) -> List[RawUpload]:
    uploads: List[RawUpload] = []
    for file in files:
        if not file.filename:
            continue
        content = await file.read()
        uploads.append(
            RawUpload(
                filename=file.filename,
                content=content,
                content_type=file.content_type,
            )
        )
    return uploads


def _analysis_pages(pages: List[ImportPage]) -> List[AnalysisPage]:
    return [
        AnalysisPage(
            index=page.index,
            content=page.content,
            mime_type=page.mime_type,
            extension=page.extension,
        )
        for page in pages
    ]


async def analyze_import_files(
    db,
    user_id: str,
    files: List[UploadFile],
) -> ImportSessionPublic:
    if not files:
        raise HTTPException(status_code=400, detail={"message": "At least one file is required."})

    raw_uploads = await _read_uploads(files)
    if not raw_uploads:
        raise HTTPException(status_code=400, detail={"message": "Filename is required."})

    validate_upload_inputs(
        [
            ImportUploadInput(
                filename=upload.filename,
                extension=_extension_from_filename(upload.filename),
                size_bytes=len(upload.content),
            )
            for upload in raw_uploads
        ]
    )

    for upload in raw_uploads:
        ext = _validate_import_extension(_extension_from_filename(upload.filename))
        validate_file_magic(ext, upload.content)

    prepared = prepare_import_document(raw_uploads)
    validate_prepared_limits(
        page_count=prepared.page_count,
        image_count=prepared.image_count or len(raw_uploads),
        total_size_bytes=prepared.total_size_bytes,
    )

    ext = prepared.extension
    mime_type = prepared.mime_type
    content = prepared.content
    size = len(content)

    import_estimate = await estimate_import(
        db,
        ImportEstimateInput(extension=ext, size_bytes=size, mime_type=mime_type),
        content=content,
    )
    tier_key = import_estimate.tier_key
    estimated_cost = import_analysis_cost_credits()

    session_id = str(uuid.uuid4())

    try:
        await require_credits_for_import(
            db,
            user_id,
            cost=estimated_cost,
            tier_key=tier_key,
        )
    except InsufficientCreditsError as exc:
        detail = insufficient_analyses_detail(exc)
        detail["tierKey"] = tier_key
        raise HTTPException(status_code=402, detail=detail) from exc

    safe_name = _safe_filename(prepared.filename)
    storage = get_storage()
    storage_key = _import_storage_key(user_id, session_id, safe_name)
    now = utc_now_iso()

    try:
        await storage.save(storage_key, content)
    except Exception:
        raise HTTPException(status_code=500, detail={"message": "Failed to store import file."})

    analyzer = get_analyzer()
    analyze_started = time.monotonic()
    analysis_context = AnalysisContext(
        filename=safe_name,
        mime_type=mime_type,
        extension=ext,
        user_id=user_id,
        pages=_analysis_pages(prepared.pages),
        source_type=prepared.source_type,
        page_count=prepared.page_count,
        image_count=prepared.image_count or len(raw_uploads),
        preprocessing_warnings=prepared.preprocessing_warnings,
    )
    try:
        analysis = await analyzer.analyze(content, analysis_context)
    except Exception as exc:
        try:
            await storage.delete(storage_key)
        except Exception:
            pass
        await record_import_ai_usage(
            db,
            user_id=user_id,
            session_id=session_id,
            model=None,
            token_usage=None,
            duration_ms=int((time.monotonic() - analyze_started) * 1000),
            success=False,
            tier_key=tier_key,
            document_type=ext,
            error_message="Document analysis failed.",
            metadata={
                "extension": ext,
                "sizeBytes": size,
                "pageCountEstimate": prepared.page_count,
                "requiresOcr": import_estimate.requires_ocr,
                "sourceType": prepared.source_type,
                "imageCount": prepared.image_count,
            },
        )
        logger.warning(
            "import.analyze.failed user=%s session=%s duration_ms=%s",
            user_id,
            session_id,
            int((time.monotonic() - analyze_started) * 1000),
        )
        raise HTTPException(
            status_code=500,
            detail={"message": "L'analyse n'a pas abouti. Réessayez avec un document plus lisible."},
        ) from exc
    analyze_duration_ms = int((time.monotonic() - analyze_started) * 1000)

    if analysis.errors:
        try:
            await storage.delete(storage_key)
        except Exception:
            pass
        error_summary = "; ".join(str(e) for e in analysis.errors[:3])
        await record_import_ai_usage(
            db,
            user_id=user_id,
            session_id=session_id,
            model=(analysis.rawExtracted or {}).get("model"),
            token_usage=(analysis.rawExtracted or {}).get("tokenUsage"),
            duration_ms=analyze_duration_ms,
            success=False,
            tier_key=tier_key,
            document_type=ext,
            credits_consumed=0,
            error_message=error_summary or "Analysis returned errors.",
            metadata={
                "extension": ext,
                "sizeBytes": size,
                "pageCountEstimate": prepared.page_count,
                "requiresOcr": import_estimate.requires_ocr,
                "detectedKind": analysis.detectedKind,
                "sourceType": prepared.source_type,
            },
        )
        logger.info(
            "import.analyze.errors user=%s session=%s errors=%s",
            user_id,
            session_id,
            len(analysis.errors),
        )
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Nous n'avons pas pu extraire assez d'informations. Vérifiez la qualité du document.",
                "errors": analysis.errors,
            },
        )

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
            "sourceType": prepared.source_type,
            "pageCount": prepared.page_count,
            "imageCount": prepared.image_count,
            "originalFileCount": len(raw_uploads),
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

    raw_extracted = analysis.rawExtracted or {}
    usage_meta = {
        "extension": ext,
        "sizeBytes": size,
        "pageCountEstimate": prepared.page_count,
        "requiresOcr": import_estimate.requires_ocr,
        "detectedKind": analysis.detectedKind,
        "filename": safe_name,
        "sourceType": prepared.source_type,
        "imageCount": prepared.image_count,
        "originalFileCount": len(raw_uploads),
    }

    consume_result = None
    try:
        consume_result = await consume_for_import(
            db,
            user_id,
            session_id=session_id,
            cost=estimated_cost,
            tier_key=tier_key,
            metadata=usage_meta,
        )
    except InsufficientCreditsError as exc:
        await db.import_sessions.delete_one({"userId": user_id, "id": session_id})
        try:
            await storage.delete(storage_key)
        except Exception:
            pass
        await record_import_ai_usage(
            db,
            user_id=user_id,
            session_id=session_id,
            model=raw_extracted.get("model"),
            token_usage=raw_extracted.get("tokenUsage"),
            duration_ms=analyze_duration_ms,
            success=False,
            tier_key=tier_key,
            document_type=ext,
            credits_consumed=0,
            error_message="Insufficient credits after analysis.",
            metadata=usage_meta,
        )
        detail = insufficient_analyses_detail(exc)
        detail["tierKey"] = tier_key
        raise HTTPException(status_code=402, detail=detail) from exc

    await record_import_ai_usage(
        db,
        user_id=user_id,
        session_id=session_id,
        model=raw_extracted.get("model"),
        token_usage=raw_extracted.get("tokenUsage"),
        duration_ms=analyze_duration_ms,
        success=True,
        tier_key=tier_key,
        document_type=ext,
        credits_consumed=consume_result.costApplied,
        credit_transaction_id=consume_result.transactionId,
        metadata=usage_meta,
    )

    logger.info(
        "import.analyze.completed user=%s session=%s tier=%s credits=%s duration_ms=%s model=%s pages=%s",
        user_id,
        session_id,
        tier_key,
        consume_result.costApplied,
        analyze_duration_ms,
        raw_extracted.get("model"),
        prepared.page_count,
    )

    return _session_public(session_doc)


async def analyze_import_file(
    db,
    user_id: str,
    file: UploadFile,
) -> ImportSessionPublic:
    return await analyze_import_files(db, user_id, [file])


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
