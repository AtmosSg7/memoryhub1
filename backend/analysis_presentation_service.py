"""Convert internal credit balances to user-facing AI analysis counts."""

from __future__ import annotations

from typing import Optional

from analysis_constants import CREDITS_PER_ANALYSIS
from credit_models import (
    AiUsageEventPublic,
    AnalysisBalancePublic,
    AnalysisPackPublic,
    AnalysisPurchasePublic,
    CreditBalancePublic,
    CreditPackPublic,
    CreditPurchasePublic,
    ImportAnalysisEstimatePublic,
)


def credits_to_analyses(credits: int) -> int:
    return max(0, int(credits) // CREDITS_PER_ANALYSIS)


def analyses_to_credits(analyses: int) -> int:
    return max(0, int(analyses) * CREDITS_PER_ANALYSIS)


def import_analysis_cost_credits() -> int:
    """Flat internal debit for one import request (= 1 user analysis)."""
    return CREDITS_PER_ANALYSIS


def balance_to_analyses_public(balance: CreditBalancePublic) -> AnalysisBalancePublic:
    return AnalysisBalancePublic(
        monthlyRemaining=credits_to_analyses(balance.monthlyRemaining),
        monthlyAllocated=credits_to_analyses(balance.monthlyAllocated),
        permanentRemaining=credits_to_analyses(balance.permanentRemaining),
        totalRemaining=credits_to_analyses(balance.totalRemaining),
        planId=balance.planId,
        periodKey=balance.periodKey,
        periodStart=balance.periodStart,
        periodEnd=balance.periodEnd,
    )


def pack_to_analyses_public(pack: CreditPackPublic) -> AnalysisPackPublic:
    return AnalysisPackPublic(
        packKey=pack.packKey,
        name=pack.name,
        analyses=credits_to_analyses(pack.credits),
        priceCents=pack.priceCents,
        currency=pack.currency,
        isActive=pack.isActive,
        sortOrder=pack.sortOrder,
        stripeConfigured=pack.stripeConfigured,
    )


def purchase_to_analyses_public(purchase: CreditPurchasePublic) -> AnalysisPurchasePublic:
    return AnalysisPurchasePublic(
        id=purchase.id,
        packKey=purchase.packKey,
        packName=purchase.packName,
        analyses=credits_to_analyses(purchase.credits),
        priceCents=purchase.priceCents,
        currency=purchase.currency,
        status=purchase.status,
        method=purchase.method,
        transactionId=purchase.transactionId,
        createdAt=purchase.createdAt,
        completedAt=purchase.completedAt,
    )


def import_estimate_public(*, tier_key: str, page_count_estimate: int, requires_ocr: bool, factors: dict) -> ImportAnalysisEstimatePublic:
    return ImportAnalysisEstimatePublic(
        tierKey=tier_key,
        estimatedAnalyses=1,
        pageCountEstimate=page_count_estimate,
        requiresOcr=requires_ocr,
        factors=factors,
    )


def usage_event_to_analyses_public(doc: dict) -> AiUsageEventPublic:
    metadata = doc.get("metadata") or {}
    action_key = doc.get("actionKey") or ""
    if action_key == "IMPORT_DOCUMENT":
        analyses_consumed = 1 if doc.get("success") else 0
    elif doc.get("creditsConsumed"):
        analyses_consumed = max(1, credits_to_analyses(int(doc["creditsConsumed"])))
    else:
        analyses_consumed = 0

    doc_type = doc.get("documentType") or metadata.get("extension")
    return AiUsageEventPublic(
        id=doc["id"],
        createdAt=doc.get("createdAt", ""),
        success=bool(doc.get("success")),
        documentType=doc_type,
        detectedKind=metadata.get("detectedKind"),
        analysesConsumed=analyses_consumed,
        errorMessage=doc.get("errorMessage"),
    )


def insufficient_analyses_detail(exc) -> dict:
    """Build user-facing 402 payload (no credit units exposed)."""
    available = getattr(exc, "available", 0) or 0
    required_credits = getattr(exc, "required", import_analysis_cost_credits())
    return {
        "message": "Analyses IA insuffisantes pour cette importation.",
        "code": "insufficient_analyses",
        "analysesRequired": max(1, credits_to_analyses(required_credits)),
        "analysesAvailable": credits_to_analyses(available),
        "tierKey": getattr(exc, "tier_key", None),
    }
