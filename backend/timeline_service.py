"""Universal client timeline — merges events ledger + Communication Center."""

from __future__ import annotations

from typing import Dict, List, Optional, Set

from events import EventListResponse, EventPublic, event_public


def _comm_to_event(doc: dict, *, synthetic: bool = False, message_count: int = 1) -> EventPublic:
    """Map a Communication Center row to an EventPublic for the Timeline UI."""
    ctype = doc.get("type") or "email"
    direction = doc.get("direction") or "inbound"
    if ctype == "email":
        event_type = "email_sent" if direction == "outbound" else "email_received"
        entity_type = "email"
    elif ctype == "whatsapp":
        event_type = "whatsapp_message"
        entity_type = "whatsapp"
    elif ctype == "phone":
        event_type = "call_logged"
        entity_type = "call"
    elif ctype == "calendar":
        event_type = "calendar_event_synced"
        entity_type = "calendar"
    elif ctype in ("internal_note", "ai_summary"):
        event_type = "note_created"
        entity_type = "note"
    else:
        event_type = "email_received"
        entity_type = "email"

    metadata = dict(doc.get("metadata") or {})
    metadata.setdefault("subject", doc.get("subject"))
    metadata.setdefault("excerpt", doc.get("preview"))
    metadata.setdefault(
        "channel", ctype if ctype in ("email", "whatsapp") else metadata.get("channel")
    )
    metadata.setdefault("provider", doc.get("provider"))
    metadata.setdefault("gmailUrl", doc.get("externalUrl"))
    metadata.setdefault("attachmentsCount", doc.get("attachmentsCount") or 0)
    metadata["communicationId"] = doc.get("id")
    metadata["communicationType"] = ctype
    if doc.get("conversationId"):
        metadata["conversationId"] = doc["conversationId"]
    if doc.get("lifecycleStatus"):
        metadata["lifecycleStatus"] = doc["lifecycleStatus"]
    if doc.get("priority"):
        metadata["priority"] = doc["priority"]
    if synthetic:
        metadata["syntheticConversation"] = True
        metadata["messageCount"] = message_count
        if message_count > 1:
            # Timeline = conversational summary; Inbox = individual messages.
            if event_type == "email_received":
                metadata["timelineTitleHint"] = f"Conversation e-mail ({message_count} messages)"
            elif event_type == "email_sent":
                metadata["timelineTitleHint"] = f"Conversation e-mail ({message_count} messages)"
            else:
                metadata["timelineTitleHint"] = f"Conversation ({message_count} messages)"

    event_id = (
        f"comm-conv-{doc['conversationId']}"
        if synthetic and doc.get("conversationId")
        else f"comm-{doc['id']}"
    )
    entity_id = str(doc.get("conversationId") or doc.get("id") or "")

    return EventPublic(
        id=event_id,
        type=event_type,
        entityType=entity_type,
        entityId=entity_id,
        clientId=doc.get("clientId"),
        metadata=metadata,
        createdAt=doc.get("createdAt") or "",
    )


def _collapse_communications_by_conversation(comm_docs: List[dict]) -> List[EventPublic]:
    """One timeline card per Hub conversation (latest message), else per message."""
    by_conv: Dict[str, List[dict]] = {}
    orphans: List[dict] = []
    for doc in comm_docs:
        conv_id = (doc.get("conversationId") or "").strip()
        if conv_id:
            by_conv.setdefault(conv_id, []).append(doc)
        else:
            orphans.append(doc)

    events: List[EventPublic] = []
    for conv_id, docs in by_conv.items():
        docs_sorted = sorted(docs, key=lambda d: d.get("createdAt") or "")
        latest = docs_sorted[-1]
        events.append(
            _comm_to_event(latest, synthetic=True, message_count=len(docs_sorted))
        )
    for doc in orphans:
        events.append(_comm_to_event(doc, synthetic=False, message_count=1))
    return events


async def list_universal_client_timeline(
    db,
    user_id: str,
    client_id: str,
    *,
    limit: int = 50,
    offset: int = 0,
) -> EventListResponse:
    """Merge append-only events with Communication Center rows (deduped).

    Communication Center is the source of truth for email / future channels.
    Hub conversations are synthesized as a single timeline card per thread.
    Commercial, notes, documents stay on the events ledger.
    """
    window = max(limit + offset, limit) * 3

    comm_docs = [
        doc
        async for doc in db.communications.find(
            {"userId": user_id, "clientId": client_id}, {"_id": 0}
        )
        .sort("createdAt", -1)
        .limit(window)
    ]

    covered_email_message_ids: Set[str] = set()
    covered_provider_ids: Set[str] = set()
    for doc in comm_docs:
        mid = str((doc.get("metadata") or {}).get("emailMessageId") or "")
        pid = str(doc.get("providerId") or "")
        if mid:
            covered_email_message_ids.add(mid)
        if pid:
            covered_provider_ids.add(pid)

    merged: List[EventPublic] = _collapse_communications_by_conversation(comm_docs)

    async for doc in (
        db.events.find({"userId": user_id, "clientId": client_id}, {"_id": 0, "userId": 0})
        .sort("createdAt", -1)
        .limit(window)
    ):
        if doc.get("type") in ("email_sent", "email_received"):
            entity = str(doc.get("entityId") or "")
            meta = doc.get("metadata") or {}
            provider_msg = str(meta.get("providerMessageId") or "")
            email_msg = str(meta.get("emailMessageId") or entity)
            if (
                entity in covered_email_message_ids
                or email_msg in covered_email_message_ids
                or provider_msg in covered_provider_ids
            ):
                continue
        merged.append(event_public(doc))

    merged.sort(key=lambda e: e.createdAt or "", reverse=True)
    total = len(merged)
    page = merged[offset : offset + limit]
    return EventListResponse(items=page, total=total)
