from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user, get_db
from follow_up_models import (
    FollowUpLastResponse,
    FollowUpListResponse,
    FollowUpPreviewResponse,
    FollowUpRecordRequest,
    FollowUpRecordResponse,
)
from follow_up_service import (
    build_follow_up_preview,
    get_last_follow_ups_map,
    list_follow_ups,
    record_follow_up,
)

follow_ups_router = APIRouter(prefix="/follow-ups", tags=["follow-ups"])


async def _company_name(db, user_id: str) -> str:
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "companyName": 1})
    return (user or {}).get("companyName") or "MemoryHub"


@follow_ups_router.get("/preview", response_model=FollowUpPreviewResponse)
async def preview_follow_up(
    entityType: Literal["quote", "invoice"] = Query(...),
    entityId: str = Query(..., min_length=1),
    lang: Literal["fr", "en"] = Query("fr"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    company = await _company_name(db, current_user["id"])
    data = await build_follow_up_preview(
        db,
        current_user["id"],
        entity_type=entityType,
        entity_id=entityId,
        lang=lang,
        company_name=company,
    )
    return FollowUpPreviewResponse(**data)


@follow_ups_router.get("", response_model=FollowUpListResponse)
async def get_follow_ups(
    clientId: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if clientId:
        client = await db.clients.find_one({"userId": current_user["id"], "id": clientId}, {"_id": 1})
        if not client:
            raise HTTPException(status_code=404, detail={"message": "Client not found."})
    items, total = await list_follow_ups(db, current_user["id"], client_id=clientId, limit=limit)
    return FollowUpListResponse(items=items, total=total)


@follow_ups_router.get("/last", response_model=FollowUpLastResponse)
async def get_last_follow_ups(
    entityType: Literal["quote", "invoice"] = Query(...),
    entityIds: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    ids = [value.strip() for value in entityIds.split(",") if value.strip()]
    if not ids:
        return FollowUpLastResponse(items={})
    items = await get_last_follow_ups_map(
        db,
        current_user["id"],
        entity_type=entityType,
        entity_ids=ids[:100],
    )
    return FollowUpLastResponse(items=items)


@follow_ups_router.post("", response_model=FollowUpRecordResponse)
async def create_follow_up_record(
    body: FollowUpRecordRequest,
    lang: Literal["fr", "en"] = Query("fr"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    company = await _company_name(db, current_user["id"])
    data = await record_follow_up(
        db,
        current_user["id"],
        entity_type=body.entityType,
        entity_id=body.entityId,
        message=body.message,
        subject=body.subject,
        lang=lang,
        company_name=company,
    )
    return FollowUpRecordResponse(**data)
