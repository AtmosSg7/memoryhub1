"""User-facing credit API — balance, history, and cost catalog."""

import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user, get_db
from ai_import_estimator import ImportEstimateInput, estimate_import
from ai_usage_history_service import list_user_ai_usage
from analysis_presentation_service import balance_to_analyses_public, import_analysis_cost_credits
from billing_service import activate_subscription
from credit_cost_service import list_active_costs
from credit_models import (
    AiUsageHistoryResponse,
    AiUsageEventPublic,
    AnalysisBalancePublic,
    CreditCostPublic,
    CreditTransactionListResponse,
    ImportAnalysisEstimatePublic,
)
from credit_service import get_balance
from credit_transaction_service import list_transactions
from subscription_service import get_subscription_doc, sync_lifecycle

credits_router = APIRouter(prefix="/credits", tags=["credits"])

IS_DEV = os.environ.get("ENV", "development").lower() in {"development", "test"}


@credits_router.get("/balance", response_model=AnalysisBalancePublic)
async def read_balance(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    sub = await get_subscription_doc(db, current_user["id"])
    if sub:
        await sync_lifecycle(db, current_user["id"], sub)
    balance = await get_balance(db, current_user["id"])
    return balance_to_analyses_public(balance)


@credits_router.get("/transactions", response_model=CreditTransactionListResponse)
async def read_transactions(
    limit: int = Query(50, ge=1, le=200),
    type: Optional[str] = Query(None, alias="type"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    items, total = await list_transactions(
        db,
        current_user["id"],
        limit=limit,
        transaction_type=type,
    )
    return CreditTransactionListResponse(items=items, total=total)


@credits_router.get("/ai-history", response_model=AiUsageHistoryResponse)
async def read_ai_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    actionKey: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    items, total = await list_user_ai_usage(
        db,
        current_user["id"],
        limit=limit,
        offset=offset,
        action_key=actionKey,
    )
    return AiUsageHistoryResponse(
        items=[AiUsageEventPublic(**item) for item in items],
        total=total,
    )


@credits_router.get("/costs", response_model=list[CreditCostPublic])
async def read_cost_catalog(db=Depends(get_db)):
    """Public catalog of AI action costs (no auth required for transparency)."""
    return await list_active_costs(db)


@credits_router.get("/costs/import-preview")
async def preview_import_credit_cost(
    tier: Optional[str] = Query(None),
    extension: Optional[str] = Query(None),
    sizeBytes: Optional[int] = Query(None, ge=1),
    db=Depends(get_db),
):
    """
    Preview import credit cost.

    Pass extension + sizeBytes for a full estimate (tier resolved automatically),
    or tier alone for a static tier lookup.
    """
    if extension and sizeBytes:
        result = await estimate_import(
            db,
            ImportEstimateInput(extension=extension, size_bytes=sizeBytes),
        )
        return ImportAnalysisEstimatePublic(
            tierKey=result.tier_key,
            estimatedAnalyses=1,
            pageCountEstimate=result.page_count_estimate,
            requiresOcr=result.requires_ocr,
            factors=result.factors,
        )

    return {"actionKey": "IMPORT_DOCUMENT", "tierKey": tier, "estimatedAnalyses": 1}


@credits_router.post("/dev/assign-plan", response_model=AnalysisBalancePublic)
async def dev_assign_plan(
    planId: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Development-only helper to assign a plan without Stripe (tests / staging)."""
    if not IS_DEV:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    balance = await activate_subscription(db, current_user["id"], planId)
    return balance_to_analyses_public(balance)
