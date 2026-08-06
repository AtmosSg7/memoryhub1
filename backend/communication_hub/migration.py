"""Progressive backfill — attach existing communications to Hub conversations."""

from __future__ import annotations

from communication_hub.conversation_engine import after_communication_upsert
from communication_hub.models import HubMigrateResponse


async def migrate_communications_to_hub(
    db,
    user_id: str | None = None,
    *,
    limit: int = 5000,
) -> HubMigrateResponse:
    """Backfill conversationId / lifecycle / attachments for existing rows.

    Safe to re-run (idempotent). Does not delete or rewrite association status.
    Requires ``user_id`` for production safety (all-users only for admin scripts).
    """
    if not user_id:
        raise ValueError("user_id is required for Hub migration")

    query = {
        "userId": user_id,
        "$or": [
            {"conversationId": {"$exists": False}},
            {"conversationId": None},
            {"conversationId": ""},
            {"lifecycleStatus": {"$exists": False}},
        ],
    }

    cursor = (
        db.communications.find(query, {"_id": 0})
        .sort("createdAt", 1)
        .limit(max(1, min(int(limit), 20_000)))
    )
    scanned = 0
    updated = 0
    attachments = 0
    conv_ids: set[str] = set()

    async for doc in cursor:
        scanned += 1
        before = doc.get("conversationId")
        result = await after_communication_upsert(db, doc)
        if result.get("conversationId"):
            conv_ids.add(result["conversationId"])
            if not before:
                updated += 1
            meta = result.get("metadata") or {}
            attachments += len(list(meta.get("attachments") or []))

    return HubMigrateResponse(
        scanned=scanned,
        conversationsUpserted=len(conv_ids),
        communicationsUpdated=updated,
        attachmentsUpserted=attachments,
    )
