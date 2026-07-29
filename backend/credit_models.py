"""Pydantic models for the AI credit engine."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from credit_constants import CreditActionKey, CreditTransactionType, ImportComplexityTier


class CreditPlanPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    monthlyAnalyses: int = Field(..., ge=0)
    isActive: bool = True
    sortOrder: int = 0


class CreditCostPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    actionKey: CreditActionKey
    label: str
    defaultCost: int = Field(..., ge=0)
    supportsTiers: bool = False
    tierCosts: Optional[Dict[str, int]] = None
    isActive: bool = True


class CreditBalancePublic(BaseModel):
    """Internal balance — use AnalysisBalancePublic for user APIs."""

    model_config = ConfigDict(extra="ignore")

    monthlyRemaining: int = Field(..., ge=0)
    monthlyAllocated: int = Field(..., ge=0)
    permanentRemaining: int = Field(..., ge=0)
    totalRemaining: int = Field(..., ge=0)
    planId: Optional[str] = None
    periodKey: Optional[str] = None
    periodStart: Optional[str] = None
    periodEnd: Optional[str] = None


class AnalysisBalancePublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    monthlyRemaining: int = Field(..., ge=0)
    monthlyAllocated: int = Field(..., ge=0)
    permanentRemaining: int = Field(..., ge=0)
    totalRemaining: int = Field(..., ge=0)
    planId: Optional[str] = None
    periodKey: Optional[str] = None
    periodStart: Optional[str] = None
    periodEnd: Optional[str] = None


class CreditTransactionPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    type: CreditTransactionType
    actionKey: Optional[CreditActionKey] = None
    tierKey: Optional[str] = None
    costApplied: Optional[int] = None
    monthlyDelta: int
    permanentDelta: int
    monthlyBalanceAfter: int
    permanentBalanceAfter: int
    source: Optional[str] = None
    referenceType: Optional[str] = None
    referenceId: Optional[str] = None
    label: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    createdAt: str


class CreditTransactionListResponse(BaseModel):
    items: List[CreditTransactionPublic]
    total: int


class ImportAnalysisEstimatePublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    actionKey: Literal["IMPORT_DOCUMENT"] = "IMPORT_DOCUMENT"
    tierKey: ImportComplexityTier
    estimatedAnalyses: int = Field(1, ge=1)
    pageCountEstimate: int = Field(..., ge=1)
    requiresOcr: bool = False
    factors: Dict[str, Any] = Field(default_factory=dict)


class ImportCreditEstimatePublic(BaseModel):
    """Deprecated internal shape — prefer ImportAnalysisEstimatePublic."""

    model_config = ConfigDict(extra="ignore")

    actionKey: Literal["IMPORT_DOCUMENT"] = "IMPORT_DOCUMENT"
    tierKey: ImportComplexityTier
    estimatedCredits: int = Field(..., ge=0)
    pageCountEstimate: int = Field(..., ge=1)
    requiresOcr: bool = False
    factors: Dict[str, Any] = Field(default_factory=dict)


class AiUsageEventPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    createdAt: str
    success: bool
    documentType: Optional[str] = None
    detectedKind: Optional[str] = None
    analysesConsumed: Optional[int] = None
    errorMessage: Optional[str] = None


class AiUsageHistoryResponse(BaseModel):
    items: List[AiUsageEventPublic]
    total: int


class AnalysisPackPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    packKey: str
    name: str
    analyses: int = Field(..., ge=1)
    priceCents: int = Field(..., ge=0)
    currency: str = "eur"
    isActive: bool = True
    sortOrder: int = 0
    stripeConfigured: bool = False


class CreditPackPublic(BaseModel):
    """Internal pack catalog — user APIs expose AnalysisPackPublic."""

    model_config = ConfigDict(extra="ignore")

    packKey: str
    name: str
    credits: int = Field(..., ge=1)
    priceCents: int = Field(..., ge=0)
    currency: str = "eur"
    isActive: bool = True
    sortOrder: int = 0
    stripeConfigured: bool = False


class AnalysisPackListResponse(BaseModel):
    packs: List[AnalysisPackPublic]
    devCreditPurchasesEnabled: bool = False
    stripeCreditCheckoutEnabled: bool = False


class CreditPackListResponse(BaseModel):
    packs: List[CreditPackPublic]
    devCreditPurchasesEnabled: bool = False
    stripeCreditCheckoutEnabled: bool = False


class AnalysisPurchasePublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    packKey: str
    packName: Optional[str] = None
    analyses: int
    priceCents: int
    currency: str
    status: str
    method: str
    transactionId: Optional[str] = None
    createdAt: str
    completedAt: Optional[str] = None


class CreditPurchasePublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    packKey: str
    packName: Optional[str] = None
    credits: int
    priceCents: int
    currency: str
    status: str
    method: str
    transactionId: Optional[str] = None
    createdAt: str
    completedAt: Optional[str] = None


class AnalysisPurchaseListResponse(BaseModel):
    items: List[AnalysisPurchasePublic]
    total: int


class CreditPurchaseListResponse(BaseModel):
    items: List[CreditPurchasePublic]
    total: int


class DevCreditPurchaseRequest(BaseModel):
    packKey: str = Field(..., min_length=1)


class CreditPackCheckoutRequest(BaseModel):
    packKey: str = Field(..., min_length=1)


class DevCreditPurchaseResponse(BaseModel):
    purchase: AnalysisPurchasePublic
    balance: AnalysisBalancePublic
    transactionId: Optional[str] = None
    idempotentReplay: bool = False


class ConsumeCreditsResult(BaseModel):
    """Internal result returned by CreditService.consume."""

    model_config = ConfigDict(extra="ignore")

    transactionId: str
    costApplied: int
    monthlyDebited: int
    permanentDebited: int
    monthlyBalanceAfter: int
    permanentBalanceAfter: int
    idempotentReplay: bool = False


class AIUsageRequest(BaseModel):
    """Payload for AIUsageService — cost may be pre-calculated (e.g. import tiers)."""

    actionKey: CreditActionKey
    userId: str
    cost: Optional[int] = Field(None, ge=0)
    tierKey: Optional[ImportComplexityTier] = None
    idempotencyKey: Optional[str] = None
    referenceType: Optional[str] = None
    referenceId: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class GrantPermanentCreditsRequest(BaseModel):
    amount: int = Field(..., gt=0)
    source: Literal["purchase", "bonus", "admin", "refund"] = "admin"
    referenceType: Optional[str] = None
    referenceId: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
