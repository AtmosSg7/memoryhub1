"""Communication Hub V2 — list / inbox / lifecycle services."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from communication_hub.constants import HUB_CHANNELS, LIFECYCLE_STATUSES, LIFECYCLE_TO_READ, LIFECYCLE_NEW
from communication_hub.conversation_engine import (
    refresh_conversation_aggregates,
)
from communication_hub.lifecycle import available_actions_for, can_transition
from communication_hub.models import (
    ClientInboxChannelGroup,
    ClientInboxResponse,
    HubAttachmentPublic,
    HubConversationDetailResponse,
    HubConversationListResponse,
    HubConversationPublic,
    HubMessagePublic,
    HubParticipantPublic,
    LifecycleUpdateResponse,
)


def _participant_public(doc: dict) -> HubParticipantPublic:
    return HubParticipantPublic(
        identityKey=doc.get("identityKey"),
        displayName=doc.get("displayName"),
        email=doc.get("email"),
        phone=doc.get("phone"),
        role=doc.get("role"),
    )


def conversation_public(doc: dict) -> HubConversationPublic:
    unread = int(doc.get("unreadCount") or 0)
    if unread <= 0 and (doc.get("lifecycleStatus") or "") in {LIFECYCLE_NEW, LIFECYCLE_TO_READ}:
        unread = 1
    channel = str(doc.get("channel") or "email")
    actions = available_actions_for(
        lifecycle=str(doc.get("lifecycleStatus") or "new"),
        channel=channel,
        association_status=None,
        has_client=bool(doc.get("clientId")),
    )
    return HubConversationPublic(
        id=doc["id"],
        conversationKey=doc.get("conversationKey") or doc["id"],
        channel=channel,
        provider=doc.get("provider"),
        clientId=doc.get("clientId"),
        clientName=doc.get("clientName"),
        subject=doc.get("subject"),
        preview=doc.get("preview"),
        lifecycleStatus=str(doc.get("lifecycleStatus") or "new"),
        priority=str(doc.get("priority") or "normal"),
        messageCount=int(doc.get("messageCount") or 0),
        attachmentCount=int(doc.get("attachmentCount") or 0),
        participants=[
            _participant_public(p) for p in (doc.get("participants") or []) if isinstance(p, dict)
        ],
        lastMessageAt=doc.get("lastMessageAt"),
        firstMessageAt=doc.get("firstMessageAt"),
        externalUrl=doc.get("externalUrl"),
        unreadCount=unread,
        availableActions=actions,
    )


def _message_participants(doc: dict) -> List[HubParticipantPublic]:
    meta = doc.get("metadata") or {}
    out: List[HubParticipantPublic] = []
    if meta.get("fromEmail") or meta.get("fromName"):
        out.append(
            HubParticipantPublic(
                identityKey=f"email:{(meta.get('fromEmail') or '').lower()}" if meta.get("fromEmail") else None,
                displayName=meta.get("fromName"),
                email=meta.get("fromEmail"),
                role="from",
            )
        )
    return out


def message_public(doc: dict, *, attachments: Optional[List[dict]] = None) -> HubMessagePublic:
    meta = doc.get("metadata") or {}
    channel = str(doc.get("type") or "email")
    lifecycle = str(doc.get("lifecycleStatus") or "new")
    association = doc.get("status") or meta.get("associationStatus")
    actions = available_actions_for(
        lifecycle=lifecycle,
        channel=channel,
        association_status=association,
        has_client=bool(doc.get("clientId")),
    )
    att_public = [
        HubAttachmentPublic(
            id=a["id"],
            conversationId=a.get("conversationId"),
            communicationId=a.get("communicationId"),
            filename=a.get("filename"),
            mimeType=a.get("mimeType"),
            size=a.get("size"),
            kind=a.get("kind") or "other",
            channel=a.get("channel"),
            provider=a.get("provider"),
            externalUrl=a.get("externalUrl"),
            createdAt=a.get("createdAt"),
        )
        for a in (attachments or [])
    ]
    return HubMessagePublic(
        id=doc["id"],
        conversationId=doc.get("conversationId"),
        channel=channel,
        provider=doc.get("provider"),
        providerId=doc.get("providerId"),
        direction=doc.get("direction"),
        subject=doc.get("subject"),
        preview=doc.get("preview"),
        lifecycleStatus=lifecycle,
        associationStatus=association,
        clientId=doc.get("clientId"),
        priority=str(doc.get("priority") or "normal"),
        attachmentsCount=int(doc.get("attachmentsCount") or len(att_public)),
        attachments=att_public,
        externalUrl=doc.get("externalUrl"),
        createdAt=doc.get("createdAt") or "",
        participants=_message_participants(doc),
        availableActions=actions,
        metadata=meta,
    )


async def list_conversations(
    db,
    user_id: str,
    *,
    client_id: Optional[str] = None,
    channel: Optional[str] = None,
    lifecycle_status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> HubConversationListResponse:
    query: Dict[str, Any] = {"userId": user_id}
    if client_id:
        query["clientId"] = client_id
    if channel:
        query["channel"] = channel
    if lifecycle_status:
        query["lifecycleStatus"] = lifecycle_status

    total = await db.conversations.count_documents(query)
    cursor = (
        db.conversations.find(query, {"_id": 0})
        .sort([("lastMessageAt", -1), ("updatedAt", -1)])
        .skip(max(0, offset))
        .limit(max(1, min(int(limit), 200)))
    )
    items = [conversation_public(doc) async for doc in cursor]
    return HubConversationListResponse(
        items=items,
        total=total,
        offset=offset,
        limit=min(int(limit), 200),
    )


async def get_conversation_detail(
    db,
    user_id: str,
    conversation_id: str,
    *,
    mark_read: bool = False,
) -> HubConversationDetailResponse:
    conv = await db.conversations.find_one(
        {"userId": user_id, "id": conversation_id},
        {"_id": 0},
    )
    if not conv:
        raise HTTPException(status_code=404, detail={"message": "Conversation not found."})

    if mark_read:
        await mark_conversation_read(db, user_id, conversation_id)
        conv = await db.conversations.find_one(
            {"userId": user_id, "id": conversation_id},
            {"_id": 0},
        ) or conv

    messages_cursor = (
        db.communications.find(
            {"userId": user_id, "conversationId": conversation_id},
            {"_id": 0},
        )
        .sort("createdAt", 1)
        .limit(500)
    )
    messages_raw = [doc async for doc in messages_cursor]
    att_cursor = db.communication_attachments.find(
        {"userId": user_id, "conversationId": conversation_id},
        {"_id": 0},
    ).limit(500)
    attachments_raw = [doc async for doc in att_cursor]
    by_comm: Dict[str, List[dict]] = {}
    for att in attachments_raw:
        by_comm.setdefault(att.get("communicationId") or "", []).append(att)

    messages = [
        message_public(m, attachments=by_comm.get(m["id"], []))
        for m in messages_raw
    ]
    return HubConversationDetailResponse(
        conversation=conversation_public(conv),
        messages=messages,
        attachments=[
            HubAttachmentPublic(
                id=a["id"],
                conversationId=a.get("conversationId"),
                communicationId=a.get("communicationId"),
                filename=a.get("filename"),
                mimeType=a.get("mimeType"),
                size=a.get("size"),
                kind=a.get("kind") or "other",
                channel=a.get("channel"),
                provider=a.get("provider"),
                externalUrl=a.get("externalUrl"),
                createdAt=a.get("createdAt"),
            )
            for a in attachments_raw
        ],
    )


async def mark_conversation_read(db, user_id: str, conversation_id: str) -> int:
    """Mark inbound unread messages as read (does not touch association status)."""
    now = datetime.now(timezone.utc).isoformat()
    result = await db.communications.update_many(
        {
            "userId": user_id,
            "conversationId": conversation_id,
            "lifecycleStatus": {"$in": [LIFECYCLE_NEW, LIFECYCLE_TO_READ]},
            "direction": "inbound",
        },
        {"$set": {"lifecycleStatus": "read", "updatedAt": now}},
    )
    await refresh_conversation_aggregates(db, user_id, conversation_id)
    return int(result.modified_count or 0)


async def get_client_inbox(
    db,
    user_id: str,
    client_id: str,
    *,
    limit: int = 50,
    offset: int = 0,
) -> ClientInboxResponse:
    client = await db.clients.find_one({"userId": user_id, "id": client_id}, {"_id": 0, "id": 1})
    if not client:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})

    query = {"userId": user_id, "clientId": client_id}
    total_conversations = await db.conversations.count_documents(query)
    cursor = (
        db.conversations.find(query, {"_id": 0})
        .sort([("lastMessageAt", -1)])
        .skip(max(0, offset))
        .limit(max(1, min(int(limit), 200)))
    )
    convs = [doc async for doc in cursor]

    by_channel: Dict[str, List[dict]] = {}
    for c in convs:
        ch = str(c.get("channel") or "email")
        by_channel.setdefault(ch, []).append(c)

    order = [ch for ch in HUB_CHANNELS if ch in by_channel]
    for ch in by_channel:
        if ch not in order:
            order.append(ch)

    channels = [
        ClientInboxChannelGroup(
            channel=ch,
            conversations=[conversation_public(c) for c in by_channel[ch]],
            total=len(by_channel[ch]),
        )
        for ch in order
    ]
    total_messages = await db.communications.count_documents(
        {"userId": user_id, "clientId": client_id}
    )
    return ClientInboxResponse(
        clientId=client_id,
        channels=channels,
        totalConversations=total_conversations,
        totalMessages=total_messages,
        offset=offset,
        limit=min(int(limit), 200),
        hasMore=(offset + len(convs)) < total_conversations,
    )


async def update_communication_lifecycle(
    db,
    user_id: str,
    communication_id: str,
    lifecycle_status: str,
) -> LifecycleUpdateResponse:
    if lifecycle_status not in LIFECYCLE_STATUSES:
        raise HTTPException(status_code=400, detail={"message": "Invalid lifecycle status."})

    doc = await db.communications.find_one(
        {"userId": user_id, "id": communication_id},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Communication not found."})

    current = str(doc.get("lifecycleStatus") or "new")
    if not can_transition(current, lifecycle_status):
        raise HTTPException(
            status_code=400,
            detail={"message": f"Cannot transition from {current} to {lifecycle_status}."},
        )

    now = datetime.now(timezone.utc).isoformat()
    await db.communications.update_one(
        {"userId": user_id, "id": communication_id},
        {"$set": {"lifecycleStatus": lifecycle_status, "updatedAt": now}},
    )

    conv_id = doc.get("conversationId")
    if conv_id:
        await refresh_conversation_aggregates(db, user_id, conv_id)

    return LifecycleUpdateResponse(
        id=communication_id,
        lifecycleStatus=lifecycle_status,
        conversationId=conv_id,
    )
