from fastapi import APIRouter, Depends, Query

from auth import get_current_user, get_db
from reminder_models import ReminderListResponse
from reminder_service import generate_reminders

reminders_router = APIRouter(prefix="/reminders", tags=["reminders"])

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


@reminders_router.get("", response_model=ReminderListResponse)
async def list_reminders(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    items = await generate_reminders(db, current_user["id"])
    return ReminderListResponse(items=items[:limit], total=len(items))
