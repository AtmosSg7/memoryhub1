"""Pydantic models for internal admin API."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AdminGrantCreditsRequest(BaseModel):
    credits: int = Field(..., ge=1, le=100_000)
    reason: str = Field(..., min_length=3, max_length=500)


class AdminSuspendRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


class AdminActionResponse(BaseModel):
    message: str
    auditId: Optional[str] = None


class AdminUserListItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    email: str
    firstName: str
    lastName: str
    companyName: str
    emailVerified: bool = False
    createdAt: Optional[str] = None
    lastActivityAt: Optional[str] = None
    accountStatus: str = "active"
    planId: Optional[str] = None
    subscriptionStatus: Optional[str] = None
    clientsCount: int = 0
    importsCount: int = 0
    creditsAvailable: int = 0


class AdminUserListResponse(BaseModel):
    items: List[AdminUserListItem]
    page: int
    pageSize: int
    total: int
    totalPages: int


class AdminOverviewResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    period: str
    startAt: str
    endAt: str
    users: Dict[str, Any]
    subscriptions: Dict[str, Any]
    mrr: Dict[str, Any]
    conversion: Dict[str, Any]
    credits: Dict[str, Any]
    aiUsage: Dict[str, Any]
    imports: Dict[str, Any]
    emails: Dict[str, Any]
    stripe: Dict[str, Any]
    alerts: List[Dict[str, Any]] = []
    grossAiMarginEstimate: Optional[Dict[str, Any]] = None


class AdminSimulateCreditsRequest(BaseModel):
    actionKey: str = Field(..., min_length=1, max_length=80)
    hypotheticalCost: int = Field(..., ge=1, le=10_000)
    period: Optional[str] = "30d"


class AdminSimulateCreditsResponse(BaseModel):
    actionKey: str
    currentTotalDebits: int
    hypotheticalTotalDebits: int
    delta: int
    eventsCounted: int
    disclaimer: str
