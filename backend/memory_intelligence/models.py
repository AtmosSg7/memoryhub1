"""Memory Intelligence public models."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

SignalKind = Literal["insight", "action"]
Priority = Literal["critical", "high", "medium", "low"]
Category = Literal[
    "activity",
    "relationship",
    "documents",
    "revenue",
    "data_quality",
    "sync",
    "communication",
    "commercial",
    "future",
]


class MemorySignal(BaseModel):
    """Generic output of a rule (insight or action)."""

    model_config = ConfigDict(extra="ignore")

    id: str
    kind: SignalKind
    ruleId: str
    priority: Priority = "medium"
    category: Category = "activity"
    title: str
    reason: str
    date: Optional[str] = None
    link: Optional[str] = None
    clientId: Optional[str] = None
    clientName: Optional[str] = None
    expiresAt: Optional[str] = None
    resolved: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ClientFacts(BaseModel):
    """Normalized facts fed into the rule engine (no UI logic)."""

    model_config = ConfigDict(extra="ignore")

    clientId: str
    name: str = ""
    company: Optional[str] = None
    displayName: str = ""
    email: Optional[str] = None
    phone: Optional[str] = None
    hasEmail: bool = False
    hasPhone: bool = False
    hasAddress: bool = False
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    lastActivityAt: Optional[str] = None
    daysSinceCreated: Optional[int] = None
    daysSinceActivity: Optional[int] = None
    exchangesTotal: int = 0
    emailsReceived: int = 0
    emailsSent: int = 0
    notesCount: int = 0
    documentsCount: int = 0
    quotesCount: int = 0
    invoicesCount: int = 0
    totalRevenue: int = 0
    isFavorite: bool = False
    # Future channel stubs (always 0 until providers exist)
    phoneCallCount: int = 0
    whatsappCount: int = 0
    calendarEventCount: int = 0


class WorkspaceFacts(BaseModel):
    """Account-level facts (integrations, inbox)."""

    model_config = ConfigDict(extra="ignore")

    googleContactsConnected: bool = False
    googleContactsLastSyncedAt: Optional[str] = None
    gmailConnected: bool = False
    gmailLastSyncedAt: Optional[str] = None
    unlinkedEmailCount: int = 0


class ClientIntelligence(BaseModel):
    clientId: str
    displayName: str
    facts: ClientFacts
    insights: List[MemorySignal] = Field(default_factory=list)
    actions: List[MemorySignal] = Field(default_factory=list)
    followUpInDays: Optional[int] = None
    integrations: Dict[str, Any] = Field(default_factory=dict)


class SyncStatusPublic(BaseModel):
    googleContacts: Dict[str, Any] = Field(default_factory=dict)
    gmail: Dict[str, Any] = Field(default_factory=dict)
    unlinkedEmailCount: int = 0


class RecentItemPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    subtitle: Optional[str] = None
    clientId: Optional[str] = None
    clientName: Optional[str] = None
    date: Optional[str] = None
    link: Optional[str] = None
    kind: Optional[str] = None


class ImportantClientPublic(BaseModel):
    clientId: str
    displayName: str
    reason: str
    insightIds: List[str] = Field(default_factory=list)
    link: str
    lastActivityAt: Optional[str] = None
    totalRevenue: int = 0
    exchangesTotal: int = 0


class IntelligenceOverview(BaseModel):
    computedAt: str
    fromCache: bool = False
    actions: List[MemorySignal] = Field(default_factory=list)
    importantClients: List[ImportantClientPublic] = Field(default_factory=list)
    followUpClients: List[ImportantClientPublic] = Field(default_factory=list)
    sync: SyncStatusPublic = Field(default_factory=SyncStatusPublic)
    recentExchanges: List[RecentItemPublic] = Field(default_factory=list)
    recentDocuments: List[RecentItemPublic] = Field(default_factory=list)
    recentNotes: List[RecentItemPublic] = Field(default_factory=list)
    insightCounts: Dict[str, int] = Field(default_factory=dict)
