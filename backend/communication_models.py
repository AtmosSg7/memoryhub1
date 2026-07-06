from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

CommunicationCategory = Literal[
    "note",
    "payment",
    "quote_acceptance",
    "follow_up",
    "email",
    "commercial",
    "document_send",
]

CommunicationChannel = Literal["app", "portal", "email", "manual"]


class CommunicationPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    category: CommunicationCategory
    channel: CommunicationChannel = "app"
    clientId: Optional[str] = None
    clientName: Optional[str] = None
    title: str
    summary: str = ""
    amount: Optional[int] = None
    eventType: Optional[str] = None
    entityType: Optional[str] = None
    entityId: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    occurredAt: str


class CommunicationListResponse(BaseModel):
    items: List[CommunicationPublic]
    total: int
    emailIntegrationReady: bool = True
