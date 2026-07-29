"""CRM Analytics HTTP routes."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user, get_db
from analytics.models import AnalyticsOverviewResponse
from analytics.service import build_analytics_overview

analytics_router = APIRouter(prefix="/analytics", tags=["analytics"])


@analytics_router.get("/overview", response_model=AnalyticsOverviewResponse)
async def get_analytics_overview(
    period: str = Query("30d"),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    timezone_name: Optional[str] = Query(None, alias="timezone"),
    sort: str = Query("collected"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if sort not in {"collected", "billed", "invoices", "activity"}:
        sort = "collected"
    try:
        return await build_analytics_overview(
            db,
            current_user["id"],
            period=period,
            from_date=from_date,
            to_date=to_date,
            timezone_name=timezone_name,
            sort_top=sort,
        )
    except ValueError as exc:
        code = str(exc)
        messages = {
            "invalid_period": "Période invalide.",
            "custom_requires_from_to": "Une période personnalisée nécessite from et to.",
            "invalid_range": "La date de fin doit être postérieure à la date de début.",
            "range_too_large": "La période personnalisée est trop longue.",
            "invalid_date": "Format de date invalide (attendu YYYY-MM-DD).",
        }
        raise HTTPException(status_code=400, detail={"code": code, "message": messages.get(code, "Paramètres invalides.")})
