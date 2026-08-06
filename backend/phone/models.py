"""Phone Hub domain models — RemoteCall → PhoneCall → communications."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from phone.constants import CallDirection, CallStatus


class PhoneIdentity(BaseModel):
    """Stable phone identity used for conversation grouping + client match."""

    model_config = ConfigDict(extra="ignore")

    raw: str = ""
    normalized: str = ""
    e164: Optional[str] = None
    identityKey: str = ""  # phone:{normalized}


class PhoneCallAttachment(BaseModel):
    model_config = ConfigDict(extra="ignore")

    filename: Optional[str] = None
    mimeType: Optional[str] = None
    url: Optional[str] = None
    size: Optional[int] = None


class RemoteCall(BaseModel):
    """Normalized call payload from any telephony vendor (pre-persistence)."""

    model_config = ConfigDict(extra="ignore")

    providerCallId: str
    provider: str = "phone"
    vendor: str = "mock"
    phoneNumber: str = ""
    counterpartyPhone: Optional[str] = None
    direction: CallDirection = "incoming"
    status: CallStatus = "answered"
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None
    duration: Optional[int] = None  # seconds
    recordingUrl: Optional[str] = None
    voicemail: bool = False
    notes: Optional[str] = None
    attachments: List[PhoneCallAttachment] = Field(default_factory=list)
    raw: Dict[str, Any] = Field(default_factory=dict)


class PhoneCall(BaseModel):
    """Canonical call record — maps 1:1 into Communication Center type=phone."""

    model_config = ConfigDict(extra="ignore")

    id: Optional[str] = None
    provider: str = "phone"
    vendor: str = "mock"
    providerCallId: str
    conversationId: Optional[str] = None
    clientId: Optional[str] = None
    phoneNumber: str = ""
    normalizedPhone: str = ""
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None
    duration: Optional[int] = None
    direction: CallDirection = "incoming"
    status: CallStatus = "answered"
    recordingUrl: Optional[str] = None
    voicemail: bool = False
    notes: Optional[str] = None
    attachments: List[PhoneCallAttachment] = Field(default_factory=list)
    matchedBy: Optional[str] = None
    connectedAccountId: Optional[str] = None


class PhoneMailboxStats(BaseModel):
    linked: int = 0
    unmatched: int = 0
    total: int = 0
    missed: int = 0


class PhoneLastCallPublic(BaseModel):
    providerCallId: Optional[str] = None
    phoneNumber: Optional[str] = None
    direction: Optional[str] = None
    status: Optional[str] = None
    startedAt: Optional[str] = None
    clientId: Optional[str] = None


class PhoneAccountPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    provider: str = "phone"
    vendor: str = "mock"
    status: Literal["connected", "disconnected", "error"] = "disconnected"
    accountName: Optional[str] = None
    accountEmail: Optional[str] = None
    connectedAt: Optional[str] = None
    lastSyncedAt: Optional[str] = None
    syncState: Optional[str] = None
    lastError: Optional[str] = None


class PhoneSyncSummary(BaseModel):
    linked: int = 0
    unmatched: int = 0
    skipped: int = 0
    total: int = 0
    finishedAt: Optional[str] = None


class PhoneStatusResponse(BaseModel):
    configured: bool
    providerMode: str
    # Product mode for UI — V2 defaults to manual_journal (not a live carrier).
    mode: str = "manual_journal"
    connected: bool
    # True only for a live carrier account — never for manual journal alone.
    carrierConnected: bool = False
    syncing: bool = False
    account: Optional[PhoneAccountPublic] = None
    lastSync: Optional[PhoneSyncSummary] = None
    lastCall: Optional[PhoneLastCallPublic] = None
    stats: PhoneMailboxStats = Field(default_factory=PhoneMailboxStats)
    availableVendors: List[str] = Field(default_factory=list)
    comingSoonVendors: List[str] = Field(default_factory=list)


class PhonePreviewResponse(BaseModel):
    connected: bool
    callCount: int
    accountName: Optional[str] = None


class PhoneSyncResponse(BaseModel):
    summary: PhoneSyncSummary
    account: PhoneAccountPublic


class PhoneConnectResponse(BaseModel):
    connected: bool
    account: PhoneAccountPublic
    providerMode: str
    message: Optional[str] = None


# --- Phone Hub V2: journal / manual / CSV / association ---


class CallJournalItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    providerCallId: Optional[str] = None
    phoneNumber: str = ""
    normalizedPhone: str = ""
    counterpartyName: Optional[str] = None
    clientId: Optional[str] = None
    clientName: Optional[str] = None
    isProspect: bool = False
    direction: str = "incoming"
    status: str = "unknown"
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None
    duration: Optional[int] = None
    notes: Optional[str] = None
    voicemail: bool = False
    conversationId: Optional[str] = None
    actionId: Optional[str] = None
    actionStatus: Optional[str] = None
    associationStatus: Optional[str] = None
    vendor: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class CallJournalListResponse(BaseModel):
    items: List[CallJournalItem] = Field(default_factory=list)
    total: int = 0
    limit: int = 30
    offset: int = 0
    filter: str = "all"


class ManualCallCreateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    phoneNumber: str
    direction: CallDirection = "incoming"
    status: Optional[str] = None
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None
    duration: Optional[int] = None
    notes: Optional[str] = None
    counterpartyName: Optional[str] = None


class ManualCallCreateResponse(BaseModel):
    call: CallJournalItem
    outcome: str = "unmatched"


class CsvImportRowPreview(BaseModel):
    lineNumber: int
    valid: bool = True
    errors: List[str] = Field(default_factory=list)
    duplicate: bool = False
    phoneNumber: str = ""
    normalizedPhone: str = ""
    direction: str = "incoming"
    status: str = "unknown"
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None
    duration: Optional[int] = None
    counterpartyName: Optional[str] = None
    notes: Optional[str] = None
    providerCallId: Optional[str] = None


class CsvImportPreviewResponse(BaseModel):
    headers: List[str] = Field(default_factory=list)
    mapping: Dict[str, str] = Field(default_factory=dict)
    totalRows: int = 0
    validRows: int = 0
    invalidRows: int = 0
    duplicateRows: int = 0
    rows: List[CsvImportRowPreview] = Field(default_factory=list)


class CsvImportReport(BaseModel):
    dryRun: bool = False
    totalRows: int = 0
    imported: int = 0
    skippedDuplicates: int = 0
    skippedInvalid: int = 0
    linked: int = 0
    unmatched: int = 0
    mapping: Dict[str, str] = Field(default_factory=dict)


class PhoneAssociateRequest(BaseModel):
    clientId: str


class PhoneAssociateResponse(BaseModel):
    communicationId: str
    clientId: str
    clientName: str
    linkedCommunications: int = 0
    alreadyLinked: bool = False


class PhoneCreateClientRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = None
    contactName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None


class PhoneCreateClientResponse(BaseModel):
    communicationId: str
    client: Dict[str, Any]
    association: PhoneAssociateResponse


class PhoneSpamResponse(BaseModel):
    communicationId: str
    status: str = "spam"
    ignoredAt: Optional[str] = None


class PhoneDashboardStats(BaseModel):
    today: int = 0
    missed: int = 0
    toCallBack: int = 0
    recognized: int = 0
    unknowns: int = 0
    call7: int = 0
    call30: int = 0
