"""Memory Intelligence HTTP routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user, get_db
from memory_intelligence.models import ClientIntelligence, IntelligenceOverview
from memory_intelligence.service import get_client_insights, get_overview, recompute_client
from rate_limit import rate_limit

intelligence_router = APIRouter(prefix="/intelligence", tags=["memory-intelligence"])
intel_rate_limit = rate_limit(max_requests=60, window_seconds=60)


@intelligence_router.get("/overview", response_model=IntelligenceOverview)
async def intelligence_overview(
    force: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(intel_rate_limit),
):
    return await get_overview(db, current_user["id"], force=force)


@intelligence_router.get("/actions")
async def intelligence_actions(
    force: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(intel_rate_limit),
):
    overview = await get_overview(db, current_user["id"], force=force)
    return {"items": overview.actions, "total": len(overview.actions), "computedAt": overview.computedAt}


@intelligence_router.get("/clients/{client_id}", response_model=ClientIntelligence)
async def intelligence_client(
    client_id: str,
    force: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(intel_rate_limit),
):
    exists = await db.clients.find_one(
        {"userId": current_user["id"], "id": client_id},
        {"_id": 1},
    )
    if not exists:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})
    intel = await get_client_insights(db, current_user["id"], client_id, force=force)
    if not intel:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})
    return intel


@intelligence_router.post("/clients/{client_id}/recompute", response_model=ClientIntelligence)
async def intelligence_recompute_client(
    client_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(intel_rate_limit),
):
    exists = await db.clients.find_one(
        {"userId": current_user["id"], "id": client_id},
        {"_id": 1},
    )
    if not exists:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})
    intel = await recompute_client(db, current_user["id"], client_id)
    if not intel:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})
    return intel
