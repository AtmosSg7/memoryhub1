from fastapi import APIRouter, Depends, File, Query, UploadFile

from auth import get_current_user, get_db
from import_models import ImportConfirmPayload, ImportConfirmResponse, ImportSessionListResponse, ImportSessionPublic
from import_service import (
    analyze_import_file,
    cancel_import_session,
    confirm_import_session,
    get_import_session,
    list_import_sessions,
)

imports_router = APIRouter(prefix="/imports", tags=["imports"])


@imports_router.post("/analyze", response_model=ImportSessionPublic, status_code=201)
async def analyze_import(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await analyze_import_file(db, current_user["id"], file)


@imports_router.get("", response_model=ImportSessionListResponse)
async def list_imports(
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await list_import_sessions(db, current_user["id"], limit=limit)


@imports_router.get("/{session_id}", response_model=ImportSessionPublic)
async def get_import(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await get_import_session(db, current_user["id"], session_id)


@imports_router.post("/{session_id}/confirm", response_model=ImportConfirmResponse)
async def confirm_import(
    session_id: str,
    body: ImportConfirmPayload,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await confirm_import_session(db, current_user["id"], session_id, body)


@imports_router.delete("/{session_id}", status_code=204)
async def cancel_import(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    await cancel_import_session(db, current_user["id"], session_id)
