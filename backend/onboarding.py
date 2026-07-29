"""Onboarding, checklist and account maturity API."""

from fastapi import APIRouter, Depends

from auth import get_current_user, get_db
from onboarding_models import (
    AccountMaturityPublic,
    ChecklistUpdateBody,
    FirstWinAckBody,
    OnboardingStatePublic,
    WizardUpdateBody,
)
from onboarding_service import (
    acknowledge_first_win,
    get_maturity,
    get_onboarding_state,
    mark_client_360_viewed,
    update_checklist,
    update_wizard,
)
from observability import log_event

onboarding_router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@onboarding_router.get("/state", response_model=OnboardingStatePublic)
async def get_state(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await get_onboarding_state(db, current_user)


@onboarding_router.get("/maturity", response_model=AccountMaturityPublic)
async def get_account_maturity(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await get_maturity(db, current_user)


@onboarding_router.patch("/wizard", response_model=OnboardingStatePublic)
async def patch_wizard(
    body: WizardUpdateBody,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    state = await update_wizard(
        db,
        current_user["id"],
        completed=body.completed,
        dismissed=body.dismissed,
        current_step=body.currentStep,
    )
    log_event(
        "onboarding.wizard_updated",
        user_id=current_user["id"],
        result="ok",
        completed=body.completed,
        dismissed=body.dismissed,
        step=body.currentStep,
    )
    return state


@onboarding_router.patch("/checklist", response_model=OnboardingStatePublic)
async def patch_checklist(
    body: ChecklistUpdateBody,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    state = await update_checklist(db, current_user["id"], dismissed=body.dismissed)
    log_event(
        "onboarding.checklist_updated",
        user_id=current_user["id"],
        result="ok",
        dismissed=body.dismissed,
    )
    return state


@onboarding_router.post("/checklist/viewed-client-360", response_model=OnboardingStatePublic)
async def checklist_viewed_client_360(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await mark_client_360_viewed(db, current_user["id"])


@onboarding_router.post("/first-win/ack", response_model=OnboardingStatePublic)
async def ack_first_win(
    body: FirstWinAckBody,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await acknowledge_first_win(db, current_user["id"], body.id)
