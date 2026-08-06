"""HTTP routes for Phone Hub V2 — /api/integrations/phone/*."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from auth import get_current_user, get_db
from observability import get_logger
from phone import association_service, csv_import, journal_service, manual_service, sync_service
from phone.models import (
    CallJournalItem,
    CallJournalListResponse,
    CsvImportPreviewResponse,
    CsvImportReport,
    ManualCallCreateRequest,
    ManualCallCreateResponse,
    PhoneAssociateRequest,
    PhoneAssociateResponse,
    PhoneConnectResponse,
    PhoneCreateClientRequest,
    PhoneCreateClientResponse,
    PhoneDashboardStats,
    PhonePreviewResponse,
    PhoneSpamResponse,
    PhoneStatusResponse,
    PhoneSyncResponse,
)

logger = get_logger(__name__)

phone_router = APIRouter(prefix="/integrations/phone", tags=["phone"])


@phone_router.get("/status", response_model=PhoneStatusResponse)
async def phone_status(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await sync_service.get_phone_status(db, current_user["id"])


@phone_router.get("/stats", response_model=PhoneDashboardStats)
async def phone_stats(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await journal_service.phone_dashboard_stats(db, current_user["id"])


@phone_router.get("/calls", response_model=CallJournalListResponse)
async def phone_list_calls(
    filter: str = Query("all", alias="filter"),
    q: str | None = Query(None),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await journal_service.list_call_journal(
        db,
        current_user["id"],
        filter_key=filter,
        q=q,
        limit=limit,
        offset=offset,
    )


@phone_router.get("/calls/{communication_id}", response_model=CallJournalItem)
async def phone_get_call(
    communication_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        return await journal_service.get_call_journal_item(
            db, current_user["id"], communication_id
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail={"message": str(exc)}) from exc


@phone_router.post("/calls", response_model=ManualCallCreateResponse)
async def phone_create_call(
    body: ManualCallCreateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        return await manual_service.create_manual_call(db, current_user["id"], body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


@phone_router.post(
    "/calls/{communication_id}/associate",
    response_model=PhoneAssociateResponse,
)
async def phone_associate_call(
    communication_id: str,
    body: PhoneAssociateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        return await association_service.associate_call_to_client(
            db, current_user["id"], communication_id, body.clientId
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail={"message": str(exc)}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


@phone_router.post(
    "/calls/{communication_id}/create-client",
    response_model=PhoneCreateClientResponse,
)
async def phone_create_client_from_call(
    communication_id: str,
    body: PhoneCreateClientRequest | None = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        return await association_service.create_client_from_call(
            db, current_user["id"], communication_id, body
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail={"message": str(exc)}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


@phone_router.post(
    "/calls/{communication_id}/spam",
    response_model=PhoneSpamResponse,
)
async def phone_mark_spam(
    communication_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        return await association_service.mark_call_spam(
            db, current_user["id"], communication_id
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail={"message": str(exc)}) from exc


@phone_router.post("/import/preview", response_model=CsvImportPreviewResponse)
async def phone_import_preview(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    raw = await file.read()
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        content = raw.decode("latin-1")
    try:
        return await csv_import.preview_csv_import(db, current_user["id"], content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


@phone_router.post("/import", response_model=CsvImportReport)
async def phone_import_csv(
    file: UploadFile = File(...),
    dryRun: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    raw = await file.read()
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        content = raw.decode("latin-1")
    try:
        return await csv_import.import_csv_calls(
            db, current_user["id"], content, dry_run=dryRun
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


# --- Legacy V1 carrier sync (mock only; real vendors remain stubs) ---


@phone_router.post("/connect", response_model=PhoneConnectResponse)
async def phone_connect(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        return await sync_service.connect_phone(db, current_user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


@phone_router.get("/preview", response_model=PhonePreviewResponse)
async def phone_preview(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        return await sync_service.preview_phone(db, current_user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


@phone_router.post("/sync", response_model=PhoneSyncResponse)
async def phone_sync(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        return await sync_service.sync_phone(db, current_user["id"])
    except ValueError as exc:
        msg = str(exc)
        code = 409 if "progress" in msg.lower() else 400
        raise HTTPException(status_code=code, detail={"message": msg}) from exc


@phone_router.post("/disconnect")
async def phone_disconnect(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await sync_service.disconnect_phone(db, current_user["id"])
