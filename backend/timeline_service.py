"""Universal client timeline — merges events ledger + Communication Center."""

from __future__ import annotations

from typing import List, Set

from events import EventListResponse, EventPublic, event_public


def _comm_to_event(doc: dict) -> EventPublic:
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

    return EventPublic(
        id=f"comm-{doc['id']}",
        type=event_type,
        entityType=entity_type,
        entityId=str(doc.get("id") or ""),
        clientId=doc.get("clientId"),
        metadata=metadata,
        createdAt=doc.get("createdAt") or "",
    )


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

    merged: List[EventPublic] = [_comm_to_event(doc) for doc in comm_docs]

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
