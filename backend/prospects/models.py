"""Public API models for automatic prospects."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

ProspectStatus = Literal["pending", "ignored", "associated", "converted", "automatic"]
ProspectSource = Literal["gmail", "email", "whatsapp", "sms", "phone", "mixed"]


class ProspectPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    identityKey: str
    channel: str = "email"
    email: Optional[str] = None
    phone: Optional[str] = None
    displayName: Optional[str] = None
    company: Optional[str] = None
    firstContactAt: Optional[str] = None
    lastContactAt: Optional[str] = None
    communicationsCount: int = 0
    inboundCount: int = 0
    lastSubject: Optional[str] = None
    lastPreview: Optional[str] = None
    source: ProspectSource = "gmail"
    status: ProspectStatus = "pending"
    clientId: Optional[str] = None
    noiseClass: Optional[str] = None
    ignoredAt: Optional[str] = None


class ProspectCommunicationPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    direction: Optional[str] = None
    provider: Optional[str] = None
    subject: Optional[str] = None
    preview: Optional[str] = None
    createdAt: str
    fromEmail: Optional[str] = None
    fromName: Optional[str] = None
    toEmails: List[str] = Field(default_factory=list)
    externalUrl: Optional[str] = None
    attachmentsCount: int = 0
    clientId: Optional[str] = None
    ignoredAt: Optional[str] = None


class ProspectListResponse(BaseModel):
    items: List[ProspectPublic]
    total: int
    offset: int = 0
    limit: int = 20


class ProspectDetailResponse(BaseModel):
    prospect: ProspectPublic
    communications: List[ProspectCommunicationPublic]
    totalCommunications: int


class ProspectCountResponse(BaseModel):
    total: int


class ProspectAssociateRequest(BaseModel):
    clientId: str = Field(..., min_length=1, max_length=80)


class ProspectAssociateResponse(BaseModel):
    prospectId: str
    clientId: str
    clientName: str
    linkedCommunications: int
    alreadyLinked: bool = False


class ProspectIgnoreResponse(BaseModel):
    prospectId: str
    ignoredAt: str
    status: ProspectStatus = "ignored"


class ProspectRestoreResponse(BaseModel):
    prospectId: str
    restored: bool = True
    status: ProspectStatus = "pending"


class ProspectCreateClientRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    contactName: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=200)


class ProspectCreateClientResponse(BaseModel):
    prospectId: str
    client: Dict[str, Any]
    association: ProspectAssociateResponse
    duplicateClientId: Optional[str] = None
