from fastapi import APIRouter, Depends, Query

from auth import get_current_user, get_db
from personal_reminder_models import (
    PersonalReminderListResponse,
    PersonalReminderPublic,
    PersonalReminderSnoozeBody,
)
from personal_reminder_service import (
    complete_personal_reminder,
    list_due_personal_reminders,
    snooze_personal_reminder,
)

personal_reminders_router = APIRouter(prefix="/personal-reminders", tags=["personal-reminders"])

DEFAULT_LIMIT = 20
MAX_LIMIT = 50


@personal_reminders_router.get("/due", response_model=PersonalReminderListResponse)
async def get_due_personal_reminders(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    items = await list_due_personal_reminders(db, current_user["id"], limit=limit)
    return PersonalReminderListResponse(items=items, total=len(items))


@personal_reminders_router.post("/{reminder_id}/complete", response_model=PersonalReminderPublic)
async def complete_reminder(
    reminder_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await complete_personal_reminder(db, current_user["id"], reminder_id)


@personal_reminders_router.post("/{reminder_id}/snooze", response_model=PersonalReminderPublic)
async def snooze_reminder(
    reminder_id: str,
    body: PersonalReminderSnoozeBody,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await snooze_personal_reminder(db, current_user["id"], reminder_id, body.remindAt)
