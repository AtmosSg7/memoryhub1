"""Pydantic models for the subscription engine."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from subscription_constants import SubscriptionEvent, SubscriptionStatus


class SubscriptionPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    userId: str
    status: SubscriptionStatus
    planId: str
    trialStartedAt: Optional[str] = None
    trialEndsAt: Optional[str] = None
    currentPeriodStart: str
    currentPeriodEnd: str
    periodKey: str
    cancelAtPeriodEnd: bool = False
    cancelledAt: Optional[str] = None
    activatedAt: Optional[str] = None
    expiredAt: Optional[str] = None
    suspendedAt: Optional[str] = None
    pastDueAt: Optional[str] = None
    createdAt: str
    updatedAt: str


class SubscriptionHistoryPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    subscriptionId: str
    event: SubscriptionEvent
    previousStatus: Optional[SubscriptionStatus] = None
    newStatus: SubscriptionStatus
    previousPlanId: Optional[str] = None
    newPlanId: Optional[str] = None
    label: Optional[str] = None
    metadata: Optional[dict] = None
    createdAt: str


class SubscriptionHistoryListResponse(BaseModel):
    items: List[SubscriptionHistoryPublic]
    total: int


class CreateSubscriptionRequest(BaseModel):
    planId: str = Field(..., min_length=1)
    startWithTrial: bool = True


class ChangePlanRequest(BaseModel):
    planId: str = Field(..., min_length=1)
    effective: Literal["immediate", "next_period"] = "immediate"


class CancelSubscriptionRequest(BaseModel):
    atPeriodEnd: bool = True
    reason: Optional[str] = None


class ReactivateSubscriptionRequest(BaseModel):
    planId: Optional[str] = None
