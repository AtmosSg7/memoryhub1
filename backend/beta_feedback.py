"""Beta feedback API — authenticated, rate-limited, no CRM payload."""

from fastapi import APIRouter, Depends, Request

from auth import get_current_user, get_db
from beta_feedback_models import BetaFeedbackCreate, BetaFeedbackResponse
from beta_feedback_service import create_beta_feedback
from rate_limit import rate_limit

beta_feedback_router = APIRouter(prefix="/beta", tags=["beta"])

_feedback_rate = rate_limit(8, 3600, key_suffix=":beta-feedback")


@beta_feedback_router.post("/feedback", response_model=BetaFeedbackResponse, status_code=201)
async def submit_feedback(
    body: BetaFeedbackCreate,
    request: Request,
    _rate=Depends(_feedback_rate),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    ua = request.headers.get("user-agent")
    return await create_beta_feedback(db, current_user["id"], body, user_agent=ua)
