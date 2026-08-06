"""HTTP routes for automatic prospects."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user, get_db
from prospects.models import (
    ProspectAssociateRequest,
    ProspectCreateClientRequest,
)
from prospects import service as prospect_service
from rate_limit import rate_limit

prospects_router = APIRouter(prefix="/prospects", tags=["prospects"])

MAX_LIMIT = 100
prospects_rate_limit = rate_limit(max_requests=120, window_seconds=60)


def _http_from_lookup(exc: LookupError) -> HTTPException:
    code = str(exc)
    if code == "client_not_found":
        return HTTPException(status_code=404, detail={"message": "Client not found."})
    return HTTPException(status_code=404, detail={"message": "Prospect not found."})


@prospects_router.get("/count")
async def get_prospects_count(
    status: str = Query("pending", pattern="^(pending|ignored|associated|converted|automatic|all)$"),
    includeAutomatic: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(prospects_rate_limit),
):
    total = await prospect_service.count_prospects(
        db,
        current_user["id"],
        status=status,
        include_automatic=includeAutomatic,
    )
    return {"total": total}


@prospects_router.get("")
async def get_prospects(
    limit: int = Query(20, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
    status: str = Query("pending", pattern="^(pending|ignored|associated|converted|automatic|all)$"),
    includeAutomatic: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(prospects_rate_limit),
):
    return await prospect_service.list_prospects(
        db,
        current_user["id"],
        limit=limit,
        offset=offset,
        status=status,
        include_automatic=includeAutomatic,
    )


@prospects_router.get("/{prospect_id}")
async def get_prospect_detail(
    prospect_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(prospects_rate_limit),
):
    try:
        return await prospect_service.get_prospect(db, current_user["id"], prospect_id)
    except LookupError as exc:
        raise _http_from_lookup(exc) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


@prospects_router.post("/{prospect_id}/associate")
async def post_associate_prospect(
    prospect_id: str,
    body: ProspectAssociateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(prospects_rate_limit),
):
    try:
        return await prospect_service.associate_prospect(
            db, current_user["id"], prospect_id, body.clientId
        )
    except LookupError as exc:
        raise _http_from_lookup(exc) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


@prospects_router.post("/{prospect_id}/create-client")
async def post_create_client_from_prospect(
    prospect_id: str,
    body: Optional[ProspectCreateClientRequest] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(prospects_rate_limit),
):
    try:
        return await prospect_service.create_client_from_prospect(
            db, current_user["id"], prospect_id, body
        )
    except LookupError as exc:
        raise _http_from_lookup(exc) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


@prospects_router.post("/{prospect_id}/ignore")
async def post_ignore_prospect(
    prospect_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(prospects_rate_limit),
):
    try:
        return await prospect_service.ignore_prospect(db, current_user["id"], prospect_id)
    except LookupError as exc:
        raise _http_from_lookup(exc) from exc


@prospects_router.post("/{prospect_id}/restore")
async def post_restore_prospect(
    prospect_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(prospects_rate_limit),
):
    try:
        return await prospect_service.restore_prospect(db, current_user["id"], prospect_id)
    except LookupError as exc:
        raise _http_from_lookup(exc) from exc
