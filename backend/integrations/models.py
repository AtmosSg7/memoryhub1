"""Integration domain models (API + persistence shapes)."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

AccountStatus = Literal["connected", "disconnected", "error"]
ImportOutcome = Literal["created", "enriched", "conflict", "skipped"]


class ConnectedAccountPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    provider: str
    status: AccountStatus = "disconnected"
    accountEmail: Optional[str] = None
    accountName: Optional[str] = None
    scopes: List[str] = Field(default_factory=list)
    connectedAt: Optional[str] = None
    lastSyncedAt: Optional[str] = None
    lastError: Optional[str] = None


class SyncSummary(BaseModel):
    created: int = 0
    enriched: int = 0
    conflicts: int = 0
    skipped: int = 0
    total: int = 0
    finishedAt: Optional[str] = None


class GoogleContactsStatusResponse(BaseModel):
    configured: bool
    providerMode: str
    connected: bool
    account: Optional[ConnectedAccountPublic] = None
    lastSync: Optional[SyncSummary] = None


class GoogleContactsPreviewResponse(BaseModel):
    connected: bool
    contactCount: int
    accountEmail: Optional[str] = None


class GoogleContactsSyncResponse(BaseModel):
    summary: SyncSummary
    account: ConnectedAccountPublic


class RemoteContactEmail(BaseModel):
    value: str
    label: Optional[str] = None
    primary: bool = False
    sourceId: Optional[str] = None


class RemoteContactPhone(BaseModel):
    value: str
    label: Optional[str] = None
    primary: bool = False
    sourceId: Optional[str] = None


class RemoteContactAddress(BaseModel):
    line1: Optional[str] = None
    line2: Optional[str] = None
    city: Optional[str] = None
    postalCode: Optional[str] = None
    country: Optional[str] = "FR"
    label: Optional[str] = None
    primary: bool = False
    sourceId: Optional[str] = None


class RemoteContact(BaseModel):
    """Normalized contact from any contacts provider."""

    model_config = ConfigDict(extra="ignore")

    sourceId: str
    displayName: str
    givenName: Optional[str] = None
    familyName: Optional[str] = None
    company: Optional[str] = None
    photoUrl: Optional[str] = None
    emails: List[RemoteContactEmail] = Field(default_factory=list)
    phones: List[RemoteContactPhone] = Field(default_factory=list)
    addresses: List[RemoteContactAddress] = Field(default_factory=list)
    raw: Dict[str, Any] = Field(default_factory=dict)


class ImportItemResult(BaseModel):
    sourceId: str
    outcome: ImportOutcome
    clientId: Optional[str] = None
    clientName: Optional[str] = None
    reason: Optional[str] = None


# --- Gmail / email inbox ---

EmailDirection = Literal["inbound", "outbound"]
EmailSyncOutcome = Literal["linked", "unmatched", "skipped"]


class RemoteEmailAttachment(BaseModel):
    filename: Optional[str] = None
    mimeType: Optional[str] = None
    size: Optional[int] = None


class RemoteEmailMessage(BaseModel):
    """Normalized inbox message from any email provider (metadata only)."""

    model_config = ConfigDict(extra="ignore")

    sourceId: str
    threadId: Optional[str] = None
    subject: Optional[str] = None
    snippet: Optional[str] = None
    fromEmail: Optional[str] = None
    fromName: Optional[str] = None
    toEmails: List[str] = Field(default_factory=list)
    ccEmails: List[str] = Field(default_factory=list)
    direction: EmailDirection = "inbound"
    sentAt: Optional[str] = None
    webLink: Optional[str] = None
    attachments: List[RemoteEmailAttachment] = Field(default_factory=list)
    raw: Dict[str, Any] = Field(default_factory=dict)


class GmailStatusResponse(BaseModel):
    configured: bool
    providerMode: str
    connected: bool
    account: Optional[ConnectedAccountPublic] = None
    lastSync: Optional[SyncSummary] = None


class GmailPreviewResponse(BaseModel):
    connected: bool
    messageCount: int
    accountEmail: Optional[str] = None


class GmailMailboxProfile(BaseModel):
    emailAddress: Optional[str] = None
    historyId: Optional[str] = None
    messagesTotal: Optional[int] = None


class GmailHistoryResult(BaseModel):
    messageIds: List[str] = Field(default_factory=list)
    historyId: Optional[str] = None
    pages: int = 0


class GmailSyncSummary(BaseModel):
    """Sync summary — core counters stay FE-compatible; extras are additive."""

    linked: int = 0
    unmatched: int = 0
    skipped: int = 0
    total: int = 0
    finishedAt: Optional[str] = None
    mode: Optional[Literal["full", "incremental"]] = None
    detected: int = 0
    analyzed: int = 0
    created: int = 0
    updated: int = 0
    automatic: int = 0
    ignored: int = 0
    errors: int = 0
    cursorUpdated: bool = False
    fallbackFromIncremental: bool = False


class GmailSyncResponse(BaseModel):
    summary: GmailSyncSummary
    account: ConnectedAccountPublic


class SyncedEmailAttachmentPublic(BaseModel):
    filename: Optional[str] = None
    mimeType: Optional[str] = None
    size: Optional[int] = None


class SyncedEmailPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    clientId: Optional[str] = None
    provider: str = "gmail"
    providerMessageId: str
    threadId: Optional[str] = None
    direction: EmailDirection = "inbound"
    subject: Optional[str] = None
    preview: Optional[str] = None
    fromEmail: Optional[str] = None
    fromName: Optional[str] = None
    toEmail: Optional[str] = None
    toEmails: List[str] = Field(default_factory=list)
    attachments: List[SyncedEmailAttachmentPublic] = Field(default_factory=list)
    attachmentCount: int = 0
    gmailUrl: Optional[str] = None
    sentAt: Optional[str] = None
    matchedBy: Optional[str] = None


class ClientEmailsResponse(BaseModel):
    items: List[SyncedEmailPublic]
    total: int
