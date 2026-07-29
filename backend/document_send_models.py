from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

DocumentSendEntityType = Literal["quote", "invoice"]


class DocumentSendPreviewResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    entityType: DocumentSendEntityType
    entityId: str
    clientId: str
    clientName: str
    clientEmail: Optional[str] = None
    subject: str
    preheader: str = ""
    message: str
    documentNumber: str
    portalUrl: Optional[str] = None


class DocumentSendRecordRequest(BaseModel):
    entityType: DocumentSendEntityType
    entityId: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1, max_length=10000)
    subject: Optional[str] = Field(None, max_length=500)


class DocumentSendRecordResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    entityType: DocumentSendEntityType
    entityId: str
    subject: str
    message: str
    recordedAt: str


class DocumentSendEmailRequest(BaseModel):
    entityType: DocumentSendEntityType
    entityId: str = Field(..., min_length=1)
    recipientEmail: str = Field(..., min_length=3, max_length=254)
    idempotencyKey: Optional[str] = Field(None, max_length=128)


class DocumentSendEmailResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    entityType: DocumentSendEntityType
    entityId: str
    emailStatus: str
    emailDelivered: bool
    emailEventId: str
    recordedAt: str
