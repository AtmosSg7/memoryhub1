"""Response models for Client Timeline V2 (enriched, filterable)."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

TimelineCategory = Literal[
    "all",
    "communications",
    "commercial",
    "actions",
    "notes",
    "documents",
]


class TimelineIntelligencePublic(BaseModel):
    summary: Optional[str] = None
    intent: Optional[str] = None
    urgency: Optional[str] = None
    suggestedActionTitle: Optional[str] = None
    suggestedActionType: Optional[str] = None
    suggestionStatus: Optional[str] = None
    status: Optional[str] = None
    confidence: Optional[float] = None


class TimelineItemV2(BaseModel):
    """Enriched timeline card — extends EventPublic fields without rewriting the ledger."""

    id: str
    type: str
    entityType: str
    entityId: str
    clientId: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    createdAt: str
    category: str = "all"
    kind: str = "event"  # event | action | communication
    title: Optional[str] = None
    summary: Optional[str] = None
    badges: List[str] = Field(default_factory=list)
    amountCents: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    actionStatus: Optional[str] = None
    intelligence: Optional[TimelineIntelligencePublic] = None
    externalUrl: Optional[str] = None
    searchableText: str = ""


class TopOpenActionPublic(BaseModel):
    id: str
    title: str
    priority: str = "normal"
    dueAt: Optional[str] = None
    type: Optional[str] = None
    communicationId: Optional[str] = None
    status: str = "pending"


class NextReminderPublic(BaseModel):
    id: str
    remindAt: str
    message: Optional[str] = None
    noteId: Optional[str] = None


class LastImportantCommunicationPublic(BaseModel):
    id: str
    subject: Optional[str] = None
    createdAt: Optional[str] = None
    direction: Optional[str] = None
    summary: Optional[str] = None
    intent: Optional[str] = None
    urgency: Optional[str] = None
    externalUrl: Optional[str] = None


class ClientRelationSummary(BaseModel):
    """Fiche-level relation brief — additive fields only; never invent."""

    clientSinceYear: Optional[int] = None
    clientSinceLabel: Optional[str] = None
    lastExchangeAt: Optional[str] = None
    lastExchangeLabel: Optional[str] = None
    lastActionLabel: Optional[str] = None
    invoicesCount: int = 0
    unpaidCount: int = 0
    openActionsCount: int = 0
    isProspect: bool = False
    aiRelationSummary: Optional[str] = None
    aiLastExchangeSummary: Optional[str] = None
    # Additive enrichment for intelligent fiche header
    narrative: Optional[str] = None
    topOpenActions: List[TopOpenActionPublic] = Field(default_factory=list)
    nextReminder: Optional[NextReminderPublic] = None
    lastImportantCommunication: Optional[LastImportantCommunicationPublic] = None
    latestIntelligenceSummary: Optional[str] = None
    activeQuotesCount: int = 0
    acceptedQuotesCount: int = 0
    sentQuotesCount: int = 0
    overdueInvoicesCount: int = 0
    totalRevenue: int = 0
    communicationCount: int = 0
    lastDocumentLabel: Optional[str] = None
    recommendedActionTitle: Optional[str] = None
    primarySubject: Optional[str] = None
    lastRequestLabel: Optional[str] = None


class TimelineV2Response(BaseModel):
    items: List[TimelineItemV2]
    total: int
    limit: int
    offset: int
    category: str = "all"
    summary: ClientRelationSummary
