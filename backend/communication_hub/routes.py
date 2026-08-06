"""Communication Hub V2 HTTP API — additive, non-breaking."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from auth import get_current_user, get_db
from communication_hub import migration as hub_migration
from communication_hub import service as hub_service
from communication_hub.models import (
    ClientInboxResponse,
    HubConversationDetailResponse,
    HubConversationListResponse,
    HubMigrateResponse,
    LifecycleUpdateRequest,
    LifecycleUpdateResponse,
)
from communication_hub.providers import list_channel_providers
from rate_limit import rate_limit

hub_router = APIRouter(prefix="/hub", tags=["communication-hub"])
hub_rate = rate_limit(max_requests=120, window_seconds=60)


@hub_router.get("/providers")
async def hub_providers(
    current_user: dict = Depends(get_current_user),
    _rate=Depends(hub_rate),
):
    """List channel providers and readiness (Gmail live, phone/WA reserved)."""
    items = []
    for provider_id, provider in list_channel_providers().items():
        items.append(
            {
                "providerId": provider_id,
                "channel": provider.channel,
                "configured": provider.is_configured(),
                "ready": provider.is_ready(),
            }
        )
    return {"items": items}


@hub_router.get("/conversations", response_model=HubConversationListResponse)
async def hub_list_conversations(
    clientId: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    lifecycleStatus: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(hub_rate),
):
    return await hub_service.list_conversations(
        db,
        current_user["id"],
        client_id=clientId,
        channel=channel,
        lifecycle_status=lifecycleStatus,
        limit=limit,
        offset=offset,
    )


@hub_router.get(
    "/conversations/{conversation_id}",
    response_model=HubConversationDetailResponse,
)
async def hub_get_conversation(
    conversation_id: str,
    markRead: bool = Query(False, description="Mark inbound unread messages as read"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(hub_rate),
):
    return await hub_service.get_conversation_detail(
        db, current_user["id"], conversation_id, mark_read=markRead
    )


@hub_router.get(
    "/clients/{client_id}/inbox",
    response_model=ClientInboxResponse,
)
async def hub_client_inbox(
    client_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(hub_rate),
):
    return await hub_service.get_client_inbox(
        db, current_user["id"], client_id, limit=limit, offset=offset
    )


@hub_router.patch(
    "/communications/{communication_id}/lifecycle",
    response_model=LifecycleUpdateResponse,
)
async def hub_update_lifecycle(
    communication_id: str,
    body: LifecycleUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(hub_rate),
):
    return await hub_service.update_communication_lifecycle(
        db,
        current_user["id"],
        communication_id,
        body.lifecycleStatus,
    )


@hub_router.post("/migrate", response_model=HubMigrateResponse)
async def hub_migrate(
    limit: int = Query(2000, ge=1, le=20_000),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(hub_rate),
):
    """Idempotent backfill for the current user (progressive migration)."""
    return await hub_migration.migrate_communications_to_hub(
        db, user_id=current_user["id"], limit=limit
    )
