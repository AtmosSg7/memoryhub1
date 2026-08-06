"""Client HTTP routes — thin layer over client_service / client_models."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user, get_db
from client_models import (
    ClientCreate,
    ClientListResponse,
    ClientPublic,
    ClientStatus,
    ClientUpdate,
)
from client_service import (
    CLIENT_PROJECTION,
    aggregate_client_list_stats,
    apply_client_updates,
    build_client_document,
    cascade_client_display_name,
    client_display_name,
    client_public,
    count_linked_records,
    merge_client_list_stats,
)
from observability import log_event
from events import record_event
from analytics import invalidate_user
from security_config import MAX_LIST_ITEMS

clients_router = APIRouter(prefix="/clients", tags=["clients"])

# Re-exports for backward-compatible imports (`from clients import ClientPublic`, …)
__all__ = [
    "clients_router",
    "ClientCreate",
    "ClientUpdate",
    "ClientPublic",
    "ClientListResponse",
    "ClientStatus",
    "client_public",
    "CLIENT_PROJECTION",
]


def _user_filter(user_id: str) -> dict:
    return {"userId": user_id}


@clients_router.post("", response_model=ClientPublic, status_code=201)
async def create_client(
    body: ClientCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    doc = build_client_document(current_user["id"], body)
    await db.clients.insert_one(doc)
    invalidate_user(current_user["id"])
    await record_event(
        db,
        current_user["id"],
        "client_created",
        "client",
        doc["id"],
        client_id=doc["id"],
        metadata={"clientName": client_display_name(doc)},
    )
    log_event("client.create", user_id=current_user["id"], result="ok")
    return client_public(doc)


@clients_router.get("", response_model=ClientListResponse)
async def list_clients(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    user_id = current_user["id"]
    query = _user_filter(user_id)
    total = await db.clients.count_documents(query)
    cursor = db.clients.find(query, CLIENT_PROJECTION).sort("updatedAt", -1).limit(MAX_LIST_ITEMS)
    list_stats = await aggregate_client_list_stats(db, user_id)
    items = []
    async for doc in cursor:
        public = client_public(doc)
        merged = merge_client_list_stats(doc, list_stats.get(public.id))
        items.append(public.model_copy(update=merged))
    return ClientListResponse(items=items, total=total)


@clients_router.get("/recent", response_model=List[ClientPublic])
async def recent_clients(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    query = _user_filter(current_user["id"])
    cursor = (
        db.clients.find(query, CLIENT_PROJECTION)
        .sort("updatedAt", -1)
        .limit(5)
    )
    return [client_public(doc) async for doc in cursor]


@clients_router.get("/{client_id}", response_model=ClientPublic)
async def get_client(
    client_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    doc = await db.clients.find_one(
        {**_user_filter(current_user["id"]), "id": client_id},
        CLIENT_PROJECTION,
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})
    return client_public(doc)


@clients_router.get("/{client_id}/360")
async def get_client_360(
    client_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Client 360 dashboard aggregate — stats, integrations, recent activity."""
    from client_360_service import build_client_360

    exists = await db.clients.find_one(
        {**_user_filter(current_user["id"]), "id": client_id},
        {"_id": 1},
    )
    if not exists:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})
    return await build_client_360(db, current_user["id"], client_id)


@clients_router.get("/{client_id}/timeline-v2")
async def get_client_timeline_v2(
    client_id: str,
    limit: int = Query(40, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: str = Query("all"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Client Timeline V2 — fused chronology with intelligence + relation summary."""
    from timeline_v2_service import list_client_timeline_v2

    exists = await db.clients.find_one(
        {**_user_filter(current_user["id"]), "id": client_id},
        {"_id": 1},
    )
    if not exists:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})
    return await list_client_timeline_v2(
        db,
        current_user["id"],
        client_id,
        limit=limit,
        offset=offset,
        category=category,
    )


@clients_router.put("/{client_id}", response_model=ClientPublic)
async def update_client(
    client_id: str,
    body: ClientUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    # analytics cache busted after successful update below
    existing = await db.clients.find_one(
        {**_user_filter(current_user["id"]), "id": client_id},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})

    merged, set_payload = apply_client_updates(existing, body)
    if not set_payload:
        return client_public(existing)

    await db.clients.update_one(
        {"userId": current_user["id"], "id": client_id},
        {"$set": set_payload},
    )

    updates = body.model_dump(exclude_unset=True)
    if "company" in updates or "name" in updates:
        await cascade_client_display_name(
            db,
            current_user["id"],
            client_id,
            client_display_name(merged),
        )

    await record_event(
        db,
        current_user["id"],
        "client_updated",
        "client",
        client_id,
        client_id=client_id,
        metadata={"clientName": client_display_name(merged)},
    )

    try:
        from memory_intelligence.service import recompute_client

        await recompute_client(db, current_user["id"], client_id)
    except Exception:
        pass

    public_doc = {k: v for k, v in merged.items() if k not in ("userId", "_id")}
    invalidate_user(current_user["id"])
    return client_public(public_doc)


@clients_router.delete("/{client_id}", status_code=204)
async def delete_client(
    client_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    user_id = current_user["id"]
    existing = await db.clients.find_one(
        {**_user_filter(user_id), "id": client_id},
        {"_id": 1},
    )
    if not existing:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})

    linked = await count_linked_records(db, user_id, client_id)
    if any(linked.values()):
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    "Cannot delete this client because they have linked notes, "
                    "documents, quotes, or invoices."
                )
            },
        )

    await db.clients.delete_one({**_user_filter(user_id), "id": client_id})
    invalidate_user(user_id)
