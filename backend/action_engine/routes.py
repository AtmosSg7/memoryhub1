"""HTTP routes for the Action Engine."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from action_engine import service as action_service
from action_engine.engine import evaluate_communication, evaluate_invoice, evaluate_quote
from action_engine.models import (
    ActionCountResponse,
    ActionEvaluateResponse,
    ActionListResponse,
    ActionPublic,
    ActionSnoozeRequest,
)
from auth import get_current_user, get_db
from rate_limit import rate_limit

actions_router = APIRouter(prefix="/actions", tags=["actions"])

actions_rate_limit = rate_limit(max_requests=120, window_seconds=60)


@actions_router.get("", response_model=ActionListResponse)
async def get_actions(
    status: str = Query("pending", pattern="^(pending|completed|dismissed|expired|all)$"),
    type: Optional[str] = Query(None, alias="type"),
    clientId: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    includeSnoozed: bool = Query(False),
    snoozedOnly: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(actions_rate_limit),
):
    return await action_service.list_actions(
        db,
        current_user["id"],
        status=status,
        action_type=type,
        client_id=clientId,
        limit=limit,
        offset=offset,
        include_snoozed=includeSnoozed,
        snoozed_only=snoozedOnly,
    )


@actions_router.get("/count", response_model=ActionCountResponse)
async def get_actions_count(
    status: str = Query("pending", pattern="^(pending|completed|dismissed|expired|all)$"),
    includeSnoozed: bool = Query(False),
    snoozedOnly: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(actions_rate_limit),
):
    total = await action_service.count_actions(
        db,
        current_user["id"],
        status=status,
        include_snoozed=includeSnoozed,
        snoozed_only=snoozedOnly,
    )
    return ActionCountResponse(total=total, status=status)


@actions_router.post(
    "/evaluate/communication/{communication_id}",
    response_model=ActionEvaluateResponse,
)
async def post_evaluate_communication(
    communication_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(actions_rate_limit),
):
    """Re-evaluate rules for one communication (idempotent)."""
    comm = await db.communications.find_one(
        {"userId": current_user["id"], "id": communication_id},
        {"_id": 0},
    )
    if not comm:
        raise HTTPException(status_code=404, detail={"message": "Communication not found."})
    result = await evaluate_communication(db, comm)
    return ActionEvaluateResponse(**result)


@actions_router.post(
    "/evaluate/invoice/{invoice_id}",
    response_model=ActionEvaluateResponse,
)
async def post_evaluate_invoice(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(actions_rate_limit),
):
    invoice = await db.invoices.find_one(
        {"userId": current_user["id"], "id": invoice_id},
        {"_id": 0},
    )
    if not invoice:
        raise HTTPException(status_code=404, detail={"message": "Invoice not found."})
    result = await evaluate_invoice(db, invoice)
    return ActionEvaluateResponse(**result)


@actions_router.post(
    "/evaluate/quote/{quote_id}",
    response_model=ActionEvaluateResponse,
)
async def post_evaluate_quote(
    quote_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(actions_rate_limit),
):
    quote = await db.quotes.find_one(
        {"userId": current_user["id"], "id": quote_id},
        {"_id": 0},
    )
    if not quote:
        raise HTTPException(status_code=404, detail={"message": "Quote not found."})
    result = await evaluate_quote(db, quote)
    return ActionEvaluateResponse(**result)


@actions_router.get("/{action_id}", response_model=ActionPublic)
async def get_action(
    action_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(actions_rate_limit),
):
    action = await action_service.get_action(db, current_user["id"], action_id)
    if not action:
        raise HTTPException(status_code=404, detail={"message": "Action not found."})
    return action


@actions_router.post("/{action_id}/complete", response_model=ActionPublic)
async def post_complete_action(
    action_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(actions_rate_limit),
):
    try:
        return await action_service.complete_action(db, current_user["id"], action_id)
    except LookupError:
        raise HTTPException(status_code=404, detail={"message": "Action not found."})


@actions_router.post("/{action_id}/dismiss", response_model=ActionPublic)
async def post_dismiss_action(
    action_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(actions_rate_limit),
):
    try:
        return await action_service.dismiss_action(db, current_user["id"], action_id)
    except LookupError:
        raise HTTPException(status_code=404, detail={"message": "Action not found."})


@actions_router.post("/{action_id}/snooze", response_model=ActionPublic)
async def post_snooze_action(
    action_id: str,
    body: ActionSnoozeRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(actions_rate_limit),
):
    try:
        return await action_service.snooze_action(
            db, current_user["id"], action_id, body.until
        )
    except LookupError:
        raise HTTPException(status_code=404, detail={"message": "Action not found."})
    except ValueError as exc:
        code = str(exc)
        if code == "invalid_until":
            raise HTTPException(
                status_code=422,
                detail={"message": "Invalid date.", "code": "invalid_until"},
            ) from exc
        if code == "until_must_be_future":
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Choose a future date and time.",
                    "code": "until_must_be_future",
                },
            ) from exc
        raise HTTPException(status_code=422, detail={"message": "Unable to postpone."}) from exc
