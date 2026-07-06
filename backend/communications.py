from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user, get_db
from communication_models import CommunicationCategory, CommunicationListResponse
from communication_service import list_communications

communications_router = APIRouter(prefix="/communications", tags=["communications"])

MAX_LIMIT = 100


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
