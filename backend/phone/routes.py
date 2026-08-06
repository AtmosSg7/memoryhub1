"""HTTP routes for Phone Hub V1 — /api/integrations/phone/*."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user, get_db
from observability import get_logger
from phone import sync_service
from phone.models import (
    PhoneConnectResponse,
    PhonePreviewResponse,
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
