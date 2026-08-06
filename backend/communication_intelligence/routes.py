"""HTTP routes for Communication Intelligence."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user, get_db
from communication_intelligence import service as ci_service
from communication_intelligence.models import (
    AcceptSuggestionResponse,
    AnalyzeRequest,
    CommunicationAnalysisPublic,
)
from credit_exceptions import InsufficientCreditsError
from rate_limit import rate_limit

ci_router = APIRouter(
    prefix="/communication-intelligence",
    tags=["communication-intelligence"],
)

ci_rate_limit = rate_limit(max_requests=60, window_seconds=60)


@ci_router.get(
    "/{communication_id}",
    response_model=CommunicationAnalysisPublic,
)
async def get_communication_intelligence(
    communication_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(ci_rate_limit),
):
    analysis = await ci_service.get_analysis(
        db, current_user["id"], communication_id
    )
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail={"message": "No analysis yet.", "code": "analysis_not_found"},
        )
    return analysis


@ci_router.post(
    "/{communication_id}/analyze",
    response_model=CommunicationAnalysisPublic,
)
async def post_analyze_communication(
    communication_id: str,
    body: Optional[AnalyzeRequest] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(ci_rate_limit),
):
    force = bool(body.force) if body else False
    try:
        return await ci_service.analyze_communication(
            db,
            current_user["id"],
            communication_id,
            force=force,
            trigger="manual",
        )
    except PermissionError:
        raise HTTPException(
            status_code=403,
            detail={
                "message": "Communication Intelligence is disabled.",
                "code": "communication_intelligence_disabled",
            },
        )
    except LookupError:
        raise HTTPException(
            status_code=404,
            detail={"message": "Communication not found.", "code": "not_found"},
        )
    except RuntimeError as exc:
        if str(exc) == "quota_exceeded":
            raise HTTPException(
                status_code=429,
                detail={
                    "message": "Daily analysis limit reached.",
                    "code": "quota_exceeded",
                },
            ) from exc
        raise
    except InsufficientCreditsError as exc:
        raise HTTPException(
            status_code=402,
            detail={
                "message": "Insufficient AI credits.",
                "code": "insufficient_credits",
                "required": exc.required,
                "available": exc.available,
            },
        ) from exc


@ci_router.post(
    "/{communication_id}/accept",
    response_model=AcceptSuggestionResponse,
)
async def post_accept_suggestion(
    communication_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(ci_rate_limit),
):
    try:
        analysis, action, created = await ci_service.accept_suggestion(
            db, current_user["id"], communication_id
        )
        return AcceptSuggestionResponse(
            analysis=analysis, action=action, created=created
        )
    except PermissionError:
        raise HTTPException(
            status_code=403,
            detail={
                "message": "Communication Intelligence is disabled.",
                "code": "communication_intelligence_disabled",
            },
        )
    except LookupError as exc:
        code = str(exc)
        raise HTTPException(
            status_code=404,
            detail={"message": "Analysis not ready.", "code": code},
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail={"message": "Suggestion already rejected.", "code": str(exc)},
        ) from exc


@ci_router.post(
    "/{communication_id}/reject",
    response_model=CommunicationAnalysisPublic,
)
async def post_reject_suggestion(
    communication_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(ci_rate_limit),
):
    try:
        return await ci_service.reject_suggestion(
            db, current_user["id"], communication_id
        )
    except PermissionError:
        raise HTTPException(
            status_code=403,
            detail={
                "message": "Communication Intelligence is disabled.",
                "code": "communication_intelligence_disabled",
            },
        )
    except LookupError:
        raise HTTPException(
            status_code=404,
            detail={"message": "Analysis not ready.", "code": "analysis_not_ready"},
        )
