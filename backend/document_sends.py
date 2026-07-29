from typing import Literal

from fastapi import APIRouter, Depends, Query

from auth import get_current_user, get_db
from document_send_models import (
    DocumentSendEmailRequest,
    DocumentSendEmailResponse,
    DocumentSendPreviewResponse,
    DocumentSendRecordRequest,
    DocumentSendRecordResponse,
)
from document_send_service import (
    build_document_send_preview,
    record_document_send_prepared,
    send_document_email,
)
from rate_limit import rate_limit

document_send_rate_limit = rate_limit(max_requests=20, window_seconds=3600, key_suffix=":send")

document_sends_router = APIRouter(prefix="/document-sends", tags=["document-sends"])


async def _sender_profile(db, user_id: str) -> dict:
    from company_profile_service import get_seller_dict, get_user_with_profile

    user = await get_user_with_profile(db, user_id)
    seller = get_seller_dict(user, user["companyProfile"])
    return {
        "companyName": seller.get("companyName") or "",
        "firstName": user.get("firstName") or "",
        "lastName": user.get("lastName") or "",
    }


@document_sends_router.get("/preview", response_model=DocumentSendPreviewResponse)
async def preview_document_send(
    entityType: Literal["quote", "invoice"] = Query(...),
    entityId: str = Query(..., min_length=1),
    lang: Literal["fr", "en"] = Query("fr"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    profile = await _sender_profile(db, current_user["id"])
    data = await build_document_send_preview(
        db,
        current_user["id"],
        entity_type=entityType,
        entity_id=entityId,
        lang=lang,
        company_name=profile.get("companyName") or "",
        sender_first_name=profile.get("firstName") or "",
        sender_last_name=profile.get("lastName") or "",
    )
    return DocumentSendPreviewResponse(**data)


@document_sends_router.post("", response_model=DocumentSendRecordResponse)
async def create_document_send_record(
    body: DocumentSendRecordRequest,
    lang: Literal["fr", "en"] = Query("fr"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    profile = await _sender_profile(db, current_user["id"])
    data = await record_document_send_prepared(
        db,
        current_user["id"],
        entity_type=body.entityType,
        entity_id=body.entityId,
        message=body.message,
        subject=body.subject,
        lang=lang,
        company_name=profile.get("companyName") or "",
        sender_first_name=profile.get("firstName") or "",
        sender_last_name=profile.get("lastName") or "",
    )
    return DocumentSendRecordResponse(**data)


@document_sends_router.post("/send", response_model=DocumentSendEmailResponse)
async def send_document_email_route(
    body: DocumentSendEmailRequest,
    lang: Literal["fr", "en"] = Query("fr"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(document_send_rate_limit),
):
    profile = await _sender_profile(db, current_user["id"])
    data = await send_document_email(
        db,
        current_user["id"],
        entity_type=body.entityType,
        entity_id=body.entityId,
        recipient_email=body.recipientEmail,
        lang=lang,
        company_name=profile.get("companyName") or "",
        sender_first_name=profile.get("firstName") or "",
        sender_last_name=profile.get("lastName") or "",
        idempotency_key=body.idempotencyKey,
    )
    return DocumentSendEmailResponse(**data)
