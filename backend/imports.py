from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from auth import get_current_user, get_db
from import_constants import IMPORT_MAX_TOTAL_SIZE_BYTES
from import_models import ImportConfirmPayload, ImportConfirmResponse, ImportSessionListResponse, ImportSessionPublic
from import_service import (
    analyze_import_file,
    analyze_import_files,
    cancel_import_session,
    confirm_import_session,
    estimate_import_file,
    estimate_import_files,
    get_import_session,
    list_import_sessions,
)
from rate_limit import rate_limit
from observability import log_event

imports_router = APIRouter(prefix="/imports", tags=["imports"])
import_analyze_rate_limit = rate_limit(max_requests=20, window_seconds=3600, key_suffix=":analyze")


class ImportEstimateFileInput(BaseModel):
    extension: str = Field(..., min_length=1, max_length=12)
    sizeBytes: int = Field(..., gt=0, le=IMPORT_MAX_TOTAL_SIZE_BYTES or 26_214_400)
    mimeType: Optional[str] = None


class ImportEstimateRequest(BaseModel):
    extension: str = Field(..., min_length=1, max_length=12)
    sizeBytes: int = Field(..., gt=0, le=IMPORT_MAX_TOTAL_SIZE_BYTES or 26_214_400)
    mimeType: Optional[str] = None
    files: Optional[List[ImportEstimateFileInput]] = None


@imports_router.post("/estimate")
async def estimate_import(
    body: ImportEstimateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Preview credit cost from file metadata before analysis."""
    if body.files:
        return await estimate_import_files(
            db,
            files=[item.model_dump() for item in body.files],
        )
    return await estimate_import_file(
        db,
        extension=body.extension,
        size_bytes=body.sizeBytes,
        mime_type=body.mimeType,
    )


@imports_router.post("/analyze", response_model=ImportSessionPublic, status_code=201)
async def analyze_import(
    file: Optional[UploadFile] = File(default=None),
    files: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(import_analyze_rate_limit),
):
    uploads: List[UploadFile] = [item for item in files if item.filename]
    if not uploads and file and file.filename:
        uploads = [file]
    if not uploads:
        raise HTTPException(status_code=400, detail={"message": "At least one file is required."})
    if len(uploads) == 1:
        session = await analyze_import_file(db, current_user["id"], uploads[0])
    else:
        session = await analyze_import_files(db, current_user["id"], uploads)
    log_event(
        "import.analyze",
        user_id=current_user["id"],
        result="ok",
        fileCount=len(uploads),
    )
    return session


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
