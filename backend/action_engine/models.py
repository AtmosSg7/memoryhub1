"""Pydantic models for the Action Engine API."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

ActionStatus = Literal["pending", "completed", "dismissed", "expired"]
ActionPriority = Literal["low", "normal", "high", "urgent"]
ActionType = Literal[
    "reply_to_prospect",
    "read_client_reply",
    "call_back",
    "follow_up_overdue_invoice",
    "create_invoice_from_quote",
]


class ActionPublic(BaseModel):
    id: str
    userId: str
    clientId: Optional[str] = None
    communicationId: Optional[str] = None
    eventId: Optional[str] = None
    type: str
    priority: ActionPriority = "normal"
    status: ActionStatus = "pending"
    source: str
    createdAt: str
    dueAt: Optional[str] = None
    completedAt: Optional[str] = None
    snoozedUntil: Optional[str] = None
    snoozedAt: Optional[str] = None
    snoozedBy: Optional[str] = None
    previousDueAt: Optional[str] = None
    title: str
    description: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    idempotencyKey: str


class ActionListResponse(BaseModel):
    items: List[ActionPublic]
    total: int
    limit: int
    offset: int


class ActionCountResponse(BaseModel):
    total: int
    status: str


class ActionEvaluateResponse(BaseModel):
    created: int
    skipped: int
    actions: List[ActionPublic] = Field(default_factory=list)


class ActionSnoozeRequest(BaseModel):
    until: str = Field(..., min_length=8, max_length=64)
