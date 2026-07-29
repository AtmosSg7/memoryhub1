from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from auth import get_current_user, get_db
from communication_models import CommunicationCategory, CommunicationListResponse
from communication_service import list_communications
from rate_limit import rate_limit
from unlinked_email_service import (
    AssociateRequest,
    CreateClientFromEmailRequest,
    associate_communication_to_client,
    count_unlinked_emails,
    create_client_from_communication,
    dismiss_suggestion,
    ignore_communication,
    list_unlinked_emails,
    prefill_from_communication,
    restore_communication,
)

communications_router = APIRouter(prefix="/communications", tags=["communications"])

MAX_LIMIT = 100
unlinked_rate_limit = rate_limit(max_requests=120, window_seconds=60)


class PrefillResponse(BaseModel):
    name: str
    contactName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None


@communications_router.get("", response_model=CommunicationListResponse)
async def get_communications(
    clientId: Optional[str] = Query(None),
    category: Optional[CommunicationCategory] = Query(None),
    limit: int = Query(50, ge=1, le=MAX_LIMIT),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    user_id = current_user["id"]
    if clientId:
        client = await db.clients.find_one({"userId": user_id, "id": clientId}, {"_id": 1})
        if not client:
            raise HTTPException(status_code=404, detail={"message": "Client not found."})

    return await list_communications(
        db,
        user_id,
        client_id=clientId,
        category=category,
        limit=limit,
    )


@communications_router.get("/unlinked/count")
async def get_unlinked_count(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(unlinked_rate_limit),
):
    total = await count_unlinked_emails(db, current_user["id"])
    return {"total": total}


@communications_router.get("/unlinked")
async def get_unlinked_emails(
    limit: int = Query(20, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
    includeIgnored: bool = Query(False),
    linkStatus: Optional[str] = Query(None, pattern="^(unlinked|linked|ignored|all)$"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(unlinked_rate_limit),
):
    return await list_unlinked_emails(
        db,
        current_user["id"],
        limit=limit,
        offset=offset,
        include_ignored=includeIgnored,
        link_status=linkStatus,
    )


@communications_router.post("/{communication_id}/associate")
async def post_associate_communication(
    communication_id: str,
    body: AssociateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(unlinked_rate_limit),
):
    try:
        return await associate_communication_to_client(
            db, current_user["id"], communication_id, body.clientId
        )
    except LookupError as exc:
        code = str(exc)
        if code == "client_not_found":
            raise HTTPException(status_code=404, detail={"message": "Client not found."}) from exc
        raise HTTPException(status_code=404, detail={"message": "Communication not found."}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": "Not an email communication."}) from exc


@communications_router.post("/{communication_id}/ignore")
async def post_ignore_communication(
    communication_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(unlinked_rate_limit),
):
    try:
        return await ignore_communication(db, current_user["id"], communication_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail={"message": "Communication not found."}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": "Not an email communication."}) from exc


@communications_router.post("/{communication_id}/restore")
async def post_restore_communication(
    communication_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(unlinked_rate_limit),
):
    try:
        return await restore_communication(db, current_user["id"], communication_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail={"message": "Communication not found."}) from exc


@communications_router.post("/{communication_id}/dismiss-suggestion")
async def post_dismiss_suggestion(
    communication_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(unlinked_rate_limit),
):
    try:
        return await dismiss_suggestion(db, current_user["id"], communication_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail={"message": "Communication not found."}) from exc


@communications_router.get("/{communication_id}/prefill-client", response_model=PrefillResponse)
async def get_prefill_client(
    communication_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(unlinked_rate_limit),
):
    doc = await db.communications.find_one(
        {"userId": current_user["id"], "id": communication_id},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Communication not found."})
    data = prefill_from_communication(doc)
    return PrefillResponse(**data)


@communications_router.post("/{communication_id}/create-client")
async def post_create_client_from_email(
    communication_id: str,
    body: Optional[CreateClientFromEmailRequest] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(unlinked_rate_limit),
):
    try:
        return await create_client_from_communication(
            db, current_user["id"], communication_id, body
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail={"message": "Communication not found."}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": "Not an email communication."}) from exc
