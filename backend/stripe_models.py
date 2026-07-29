"""Pydantic models for Stripe billing API."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from subscription_constants import SubscriptionStatus


class CheckoutRequest(BaseModel):
    planId: str = Field(..., min_length=1)


class CheckoutResponse(BaseModel):
    checkoutUrl: str


class ChangePlanRequest(BaseModel):
    planId: str = Field(..., min_length=1)


class ChangePlanResponse(BaseModel):
    message: str
    effective: str
    planId: str


class PortalResponse(BaseModel):
    portalUrl: str


class BillingActions(BaseModel):
    canCheckout: bool = False
    canManage: bool = False
    canUpgrade: bool = False
    canDowngrade: bool = False
    canCancel: bool = False
    canChangePlan: bool = False


class BillingMeResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    hasSubscription: bool = False
    planId: Optional[str] = None
    planName: Optional[str] = None
    subscriptionStatus: Optional[SubscriptionStatus] = None
    trialEndsAt: Optional[str] = None
    currentPeriodEnd: Optional[str] = None
    cancelAtPeriodEnd: bool = False
    monthlyAnalysesRemaining: int = 0
    monthlyAnalysesAllocated: int = 0
    permanentAnalysesRemaining: int = 0
    totalAnalysesRemaining: int = 0
    stripeConfigured: bool = False
    stripeTestMode: bool = False
    devCreditPurchasesEnabled: bool = False
    stripeCreditCheckoutEnabled: bool = False
    availablePlans: List[str] = Field(default_factory=list)
    actions: BillingActions = Field(default_factory=BillingActions)


class StripeEventPublic(BaseModel):
    eventId: str
    eventType: str
    status: str
    processedAt: str
