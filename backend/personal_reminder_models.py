from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

PersonalReminderStatus = Literal["pending", "completed"]


class PersonalReminderPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    noteId: str
    clientId: Optional[str] = None
    clientName: Optional[str] = None
    message: str
    remindAt: str
    status: PersonalReminderStatus = "pending"
    completedAt: Optional[str] = None
    createdAt: str
    updatedAt: str


class PersonalReminderListResponse(BaseModel):
    items: List[PersonalReminderPublic]
    total: int = Field(..., ge=0)


class PersonalReminderSnoozeBody(BaseModel):
    remindAt: str = Field(..., min_length=1)
