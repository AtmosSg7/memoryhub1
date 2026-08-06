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
    connected: bool
    syncing: bool = False
    account: Optional[PhoneAccountPublic] = None
    lastSync: Optional[PhoneSyncSummary] = None
    lastCall: Optional[PhoneLastCallPublic] = None
    stats: PhoneMailboxStats = Field(default_factory=PhoneMailboxStats)
    availableVendors: List[str] = Field(default_factory=list)


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
