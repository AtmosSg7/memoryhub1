"""Subscription API — current plan, history, and dev lifecycle helpers."""

import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user, get_db
from credit_models import CreditPlanPublic
from plan_service import list_active_plans
from subscription_exceptions import (
    InvalidPlanChangeError,
    InvalidSubscriptionTransitionError,
    SubscriptionAlreadyExistsError,
    SubscriptionEngineError,
    SubscriptionNotFoundError,
)
from subscription_history_service import list_history
from subscription_models import (
    CancelSubscriptionRequest,
    ChangePlanRequest,
    CreateSubscriptionRequest,
    ReactivateSubscriptionRequest,
    SubscriptionHistoryListResponse,
    SubscriptionPublic,
)
from subscription_service import (
    activate_paid_subscription,
    activate_subscription,
    cancel_subscription,
    change_plan,
    create_subscription,
    downgrade_subscription,
    expire_subscription,
    get_subscription,
    get_subscription_doc,
    mark_past_due,
    reactivate_subscription,
    renew_subscription,
    resume_subscription,
    suspend_subscription,
    sync_lifecycle,
    upgrade_subscription,
)

subscriptions_router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

IS_DEV = os.environ.get("ENV", "development").lower() in {"development", "test"}


def _subscription_error(exc: SubscriptionEngineError) -> HTTPException:
    status = 409 if exc.code in {"subscription_already_exists", "invalid_transition", "invalid_plan_change"} else 404
    if exc.code == "concurrency_conflict":
        status = 409
    return HTTPException(status_code=status, detail={"message": exc.message, "code": exc.code})


@subscriptions_router.get("/me", response_model=SubscriptionPublic)
async def read_my_subscription(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        return await get_subscription(db, current_user["id"])
    except SubscriptionNotFoundError as exc:
        raise _subscription_error(exc) from exc


@subscriptions_router.get("/history", response_model=SubscriptionHistoryListResponse)
async def read_subscription_history(
    limit: int = Query(50, ge=1, le=200),
    event: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not await get_subscription_doc(db, current_user["id"]):
        raise HTTPException(status_code=404, detail={"message": "Subscription not found.", "code": "subscription_not_found"})
    items, total = await list_history(db, current_user["id"], limit=limit, event=event)
    return SubscriptionHistoryListResponse(items=items, total=total)


@subscriptions_router.get("/plans", response_model=list[CreditPlanPublic])
async def read_plans(db=Depends(get_db)):
    """Public plan catalog (Solo, Pro, Team)."""
    return await list_active_plans(db)


# --- Dev / staging lifecycle helpers (no Stripe) ---

@subscriptions_router.post("/dev/start-trial", response_model=SubscriptionPublic)
async def dev_start_trial(
    body: CreateSubscriptionRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not IS_DEV:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        return await create_subscription(
            db,
            current_user["id"],
            body.planId,
            start_with_trial=body.startWithTrial,
        )
    except SubscriptionEngineError as exc:
        raise _subscription_error(exc) from exc


@subscriptions_router.post("/dev/activate", response_model=SubscriptionPublic)
async def dev_activate(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not IS_DEV:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        return await activate_subscription(db, current_user["id"])
    except SubscriptionEngineError as exc:
        raise _subscription_error(exc) from exc


@subscriptions_router.post("/dev/activate-paid", response_model=SubscriptionPublic)
async def dev_activate_paid(
    planId: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Direct active subscription without trial — replaces credits dev/assign-plan."""
    if not IS_DEV:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        return await activate_paid_subscription(db, current_user["id"], planId, start_with_trial=False)
    except SubscriptionEngineError as exc:
        raise _subscription_error(exc) from exc


@subscriptions_router.post("/dev/renew", response_model=SubscriptionPublic)
async def dev_renew(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not IS_DEV:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        return await renew_subscription(db, current_user["id"])
    except SubscriptionEngineError as exc:
        raise _subscription_error(exc) from exc


@subscriptions_router.post("/dev/change-plan", response_model=SubscriptionPublic)
async def dev_change_plan(
    body: ChangePlanRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not IS_DEV:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        return await change_plan(db, current_user["id"], body.planId, effective=body.effective)
    except SubscriptionEngineError as exc:
        raise _subscription_error(exc) from exc


@subscriptions_router.post("/dev/upgrade", response_model=SubscriptionPublic)
async def dev_upgrade(
    planId: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not IS_DEV:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        return await upgrade_subscription(db, current_user["id"], planId)
    except SubscriptionEngineError as exc:
        raise _subscription_error(exc) from exc


@subscriptions_router.post("/dev/downgrade", response_model=SubscriptionPublic)
async def dev_downgrade(
    planId: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not IS_DEV:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        return await downgrade_subscription(db, current_user["id"], planId)
    except SubscriptionEngineError as exc:
        raise _subscription_error(exc) from exc


@subscriptions_router.post("/dev/cancel", response_model=SubscriptionPublic)
async def dev_cancel(
    body: CancelSubscriptionRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not IS_DEV:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        return await cancel_subscription(
            db,
            current_user["id"],
            at_period_end=body.atPeriodEnd,
            reason=body.reason,
        )
    except SubscriptionEngineError as exc:
        raise _subscription_error(exc) from exc


@subscriptions_router.post("/dev/reactivate", response_model=SubscriptionPublic)
async def dev_reactivate(
    body: ReactivateSubscriptionRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not IS_DEV:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        return await reactivate_subscription(db, current_user["id"], plan_id=body.planId)
    except SubscriptionEngineError as exc:
        raise _subscription_error(exc) from exc


@subscriptions_router.post("/dev/expire", response_model=SubscriptionPublic)
async def dev_expire(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not IS_DEV:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        return await expire_subscription(db, current_user["id"])
    except SubscriptionEngineError as exc:
        raise _subscription_error(exc) from exc


@subscriptions_router.post("/dev/past-due", response_model=SubscriptionPublic)
async def dev_past_due(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not IS_DEV:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        return await mark_past_due(db, current_user["id"])
    except SubscriptionEngineError as exc:
        raise _subscription_error(exc) from exc


@subscriptions_router.post("/dev/suspend", response_model=SubscriptionPublic)
async def dev_suspend(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not IS_DEV:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        return await suspend_subscription(db, current_user["id"])
    except SubscriptionEngineError as exc:
        raise _subscription_error(exc) from exc


@subscriptions_router.post("/dev/resume", response_model=SubscriptionPublic)
async def dev_resume(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not IS_DEV:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        return await resume_subscription(db, current_user["id"])
    except SubscriptionEngineError as exc:
        raise _subscription_error(exc) from exc
