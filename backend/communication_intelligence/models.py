"""Pydantic models for Communication Intelligence API."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

Intent = Literal[
    "request_quote",
    "request_callback",
    "appointment_request",
    "question",
    "complaint",
    "payment_question",
    "document_sent",
    "quote_accepted",
    "quote_rejected",
    "invoice_paid_claim",
    "follow_up",
    "other",
]

Urgency = Literal["low", "normal", "high", "urgent"]
AnalysisStatus = Literal["pending", "ready", "error", "skipped"]
SuggestionStatus = Literal["pending", "accepted", "rejected", "none"]


class AnalysisEntities(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[str] = None
    address: Optional[str] = None
    workType: Optional[str] = None
    quoteNumber: Optional[str] = None
    invoiceNumber: Optional[str] = None


class CommunicationAnalysisPublic(BaseModel):
    id: str
    userId: str
    communicationId: str
    status: AnalysisStatus
    suggestionStatus: SuggestionStatus = "none"
    summary: Optional[str] = None
    intent: Optional[str] = None
    urgency: Optional[str] = None
    suggestedActionType: Optional[str] = None
    suggestedActionTitle: Optional[str] = None
    suggestedActionDescription: Optional[str] = None
    entities: Dict[str, Any] = Field(default_factory=dict)
    confidence: Optional[float] = None
    analyzedAt: Optional[str] = None
    model: Optional[str] = None
    version: str
    contentHash: Optional[str] = None
    skipReason: Optional[str] = None
    errorCode: Optional[str] = None
    acceptedActionId: Optional[str] = None
    createdAt: str
    updatedAt: str


class AnalyzeRequest(BaseModel):
    force: bool = False


class AcceptSuggestionResponse(BaseModel):
    analysis: CommunicationAnalysisPublic
    action: Optional[Dict[str, Any]] = None
    created: bool = False
