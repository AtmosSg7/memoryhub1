from typing import Literal

from fastapi import APIRouter, Depends, Query

from auth import get_current_user, get_db
from document_send_models import (
    DocumentSendPreviewResponse,
    DocumentSendRecordRequest,
    DocumentSendRecordResponse,
)
from document_send_service import build_document_send_preview, record_document_send_prepared

document_sends_router = APIRouter(prefix="/document-sends", tags=["document-sends"])


async def _company_name(db, user_id: str) -> str:
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "companyName": 1})
    return (user or {}).get("companyName") or "MemoryHub"


@document_sends_router.get("/preview", response_model=DocumentSendPreviewResponse)
async def preview_document_send(
    entityType: Literal["quote", "invoice"] = Query(...),
    entityId: str = Query(..., min_length=1),
    lang: Literal["fr", "en"] = Query("fr"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    company = await _company_name(db, current_user["id"])
    data = await build_document_send_preview(
        db,
        current_user["id"],
        entity_type=entityType,
        entity_id=entityId,
        lang=lang,
        company_name=company,
    )
    return DocumentSendPreviewResponse(**data)


@document_sends_router.post("", response_model=DocumentSendRecordResponse)
async def create_document_send_record(
    body: DocumentSendRecordRequest,
    lang: Literal["fr", "en"] = Query("fr"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    company = await _company_name(db, current_user["id"])
    data = await record_document_send_prepared(
        db,
        current_user["id"],
        entity_type=body.entityType,
        entity_id=body.entityId,
        message=body.message,
        subject=body.subject,
        lang=lang,
        company_name=company,
    )
    return DocumentSendRecordResponse(**data)
