from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

DocumentKind = Literal[
    "quote",
    "invoice",
    "purchase_order",
    "delivery_note",
    "receipt",
    "supplier_invoice",
    "contract",
    "other",
]

ImportSessionStatus = Literal[
    "pending",
    "confirmed",
    "failed",
    "expired",
    "cancelled",
]

ClientMatchAction = Literal["use_existing", "create_new"]

IMPORT_FILE_EXTENSIONS = {"pdf", "jpg", "jpeg", "png", "webp"}
IMPORT_SESSION_TTL_HOURS = 72


class FieldConfidence(BaseModel):
    value: Optional[Any] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class NormalizedCommercialFields(BaseModel):
    model_config = ConfigDict(extra="ignore")

    clientName: Optional[str] = None
    company: Optional[str] = None
    contactName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    externalNumber: Optional[str] = None
    documentDate: Optional[str] = None
    title: Optional[str] = None
    amountHT: Optional[int] = Field(default=None, ge=0)
    vatRate: Optional[int] = Field(default=None, ge=0, le=100)
    amountTTC: Optional[int] = Field(default=None, ge=0)
    internalNotes: Optional[str] = None
    status: Optional[str] = None


class AnalysisResultData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    rawExtracted: Dict[str, Any] = Field(default_factory=dict)
    normalized: NormalizedCommercialFields = Field(default_factory=NormalizedCommercialFields)
    confidence: Dict[str, float] = Field(default_factory=dict)
    overallConfidence: float = Field(default=0.0, ge=0.0, le=1.0)
    provider: str
    providerVersion: str
    analyzedAt: str
    detectedKind: DocumentKind
    detectedKindConfidence: float = Field(default=0.0, ge=0.0, le=1.0)
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class ImportFileInfo(BaseModel):
    name: str
    mimeType: str
    extension: str
    sizeBytes: int
    storageProvider: str
    storageKey: str


class ClientMatch(BaseModel):
    clientId: str
    clientName: str
    score: float = Field(ge=0.0, le=100.0)
    reasons: List[str] = Field(default_factory=list)


class CreatedEntities(BaseModel):
    model_config = ConfigDict(extra="ignore")

    clientId: Optional[str] = None
    clientCreated: bool = False
    quoteId: Optional[str] = None
    invoiceId: Optional[str] = None
    documentId: Optional[str] = None
    entityType: Optional[str] = None
    entityId: Optional[str] = None
    entityNumber: Optional[str] = None


class ImportSessionPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    status: ImportSessionStatus
    file: ImportFileInfo
    analysis: AnalysisResultData
    detectedKind: DocumentKind
    clientMatches: List[ClientMatch] = Field(default_factory=list)
    duplicateWarning: Optional[str] = None
    createdEntities: Optional[CreatedEntities] = None
    confirmedAt: Optional[str] = None
    createdAt: str
    updatedAt: str
    expiresAt: str


class ImportSessionListResponse(BaseModel):
    items: List[ImportSessionPublic]
    total: int


class ImportClientCreatePayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    contactName: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=200)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=200)


class ImportConfirmPayload(BaseModel):
    targetKind: DocumentKind
    clientAction: ClientMatchAction
    clientId: Optional[str] = None
    clientData: Optional[ImportClientCreatePayload] = None
    fields: NormalizedCommercialFields


class ImportConfirmResponse(BaseModel):
    session: ImportSessionPublic
    created: CreatedEntities


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
