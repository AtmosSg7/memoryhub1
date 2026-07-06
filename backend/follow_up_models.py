from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

FollowUpEntityType = Literal["quote", "invoice"]


class FollowUpPreviewResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    entityType: FollowUpEntityType
    entityId: str
    clientId: str
    clientName: str
    subject: str
    message: str
    documentNumber: str


class FollowUpRecordRequest(BaseModel):
    entityType: FollowUpEntityType
    entityId: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1, max_length=10000)
    subject: Optional[str] = Field(None, max_length=500)


class FollowUpRecordResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    entityType: FollowUpEntityType
    entityId: str
    subject: str
    message: str
    recordedAt: str


class FollowUpHistoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    entityType: FollowUpEntityType
    entityId: str
    clientId: str
    clientName: str = ""
    documentNumber: str = ""
    subject: str = ""
    excerpt: str = ""
    recordedAt: str


class FollowUpListResponse(BaseModel):
    items: List[FollowUpHistoryItem]
    total: int


class FollowUpLastItem(BaseModel):
    recordedAt: str
    documentNumber: str = ""
    excerpt: str = ""
    count: int = 1


class FollowUpLastResponse(BaseModel):
    items: Dict[str, FollowUpLastItem] = Field(default_factory=dict)
