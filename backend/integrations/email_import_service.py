"""Import / link Gmail messages to MemoryHub clients (metadata only)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from events import record_event
from integrations.constants import (
    PROVIDER_GMAIL,
)
from integrations.email_matching import find_client_for_email
from integrations.models import GmailSyncSummary, RemoteEmailMessage


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _client_display_name(client: dict) -> str:
    return (client.get("company") or client.get("name") or client.get("contactName") or "").strip()


def remote_to_email_doc(
    user_id: str,
    message: RemoteEmailMessage,
    *,
    client: Optional[dict] = None,
    matched_by: Optional[str] = None,
    account_email: Optional[str] = None,
    connected_account_id: Optional[str] = None,
) -> dict:
    now = _utc_now_iso()
    to_emails = list(message.toEmails or [])
    primary_to = to_emails[0] if to_emails else None
    attachments = [
        {
            "filename": a.filename,
            "mimeType": a.mimeType,
            "size": a.size,
        }
        for a in (message.attachments or [])
    ]
    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "clientId": client["id"] if client else None,
        "clientName": _client_display_name(client) if client else None,
        "provider": PROVIDER_GMAIL,
        "providerMessageId": message.sourceId,
        "threadId": message.threadId,
        "direction": message.direction,
        "subject": message.subject,
        "preview": message.snippet,
        "fromEmail": message.fromEmail,
        "fromName": message.fromName,
        "toEmail": primary_to,
        "toEmails": to_emails,
        "ccEmails": list(message.ccEmails or []),
        "attachments": attachments,
        "attachmentCount": len(attachments),
        "gmailUrl": message.webLink,
        "sentAt": message.sentAt or now,
        "status": "synced",
        "matchedBy": matched_by,
        "accountEmail": account_email,
        "createdAt": now,
        "updatedAt": now,
    }
    if connected_account_id:
        doc["connectedAccountId"] = connected_account_id
    return doc


def _is_automatic_message(message: RemoteEmailMessage) -> bool:
    try:
        from prospects.identity import classify_email_noise

        if message.direction != "inbound":
            return False
        return (
            classify_email_noise(
                email=message.fromEmail,
                from_name=message.fromName,
                subject=message.subject,
            )
            is not None
        )
    except Exception:
        return False


async def import_remote_emails(
    db,
    user_id: str,
    messages: List[RemoteEmailMessage],
    *,
    account_email: Optional[str] = None,
    connected_account_id: Optional[str] = None,
) -> GmailSyncSummary:
    """Import Gmail messages into ``email_messages`` and upsert ``communications``.

    - New messages: insert email_messages + upsert communications + optional event.
    - Already-imported messages: skip email_messages / events; still upsert
      ``communications`` so the Communication Center stays complete and idempotent.
    """
    from communication_center import upsert_from_gmail_email_doc

    cursor = db.clients.find({"userId": user_id}, {"_id": 0})
    clients = [doc async for doc in cursor]

    summary = GmailSyncSummary(
        total=len(messages),
        detected=len(messages),
        analyzed=len(messages),
    )
    seen_ids = set()

    for message in messages:
        if not message.sourceId or message.sourceId in seen_ids:
            summary.skipped += 1
            continue
        seen_ids.add(message.sourceId)

        existing = await db.email_messages.find_one(
            {
                "userId": user_id,
                "provider": PROVIDER_GMAIL,
                "providerMessageId": message.sourceId,
            },
            {"_id": 0},
        )
        if existing:
            # Refresh Communication Center representation without duplicating rows/events.
            account_id = connected_account_id or existing.get("connectedAccountId")
            if connected_account_id and not existing.get("connectedAccountId"):
                await db.email_messages.update_one(
                    {"userId": user_id, "id": existing["id"]},
                    {
                        "$set": {
                            "connectedAccountId": connected_account_id,
                            "updatedAt": _utc_now_iso(),
                        }
                    },
                )
                existing = {**existing, "connectedAccountId": connected_account_id}
            await upsert_from_gmail_email_doc(
                db,
                existing,
                connected_account_id=account_id,
            )
            summary.skipped += 1
            summary.updated += 1
            # Count already-ignored communications separately (not lost, just classified)
            comm = await db.communications.find_one(
                {
                    "userId": user_id,
                    "provider": PROVIDER_GMAIL,
                    "providerId": message.sourceId,
                },
                {"_id": 0, "ignoredAt": 1},
            )
            if comm and comm.get("ignoredAt"):
                summary.ignored += 1
            continue

        match, reason = find_client_for_email(
            clients, message, account_email=account_email
        )
        doc = remote_to_email_doc(
            user_id,
            message,
            client=match,
            matched_by=reason or None,
            account_email=account_email,
            connected_account_id=connected_account_id,
        )
        await db.email_messages.insert_one(doc)
        summary.created += 1

        await upsert_from_gmail_email_doc(
            db,
            doc,
            connected_account_id=connected_account_id,
        )

        if match:
            summary.linked += 1
            event_type = "email_sent" if message.direction == "outbound" else "email_received"
            await record_event(
                db,
                user_id,
                event_type,
                "email",
                doc["id"],
                client_id=match["id"],
                metadata={
                    "subject": message.subject,
                    "excerpt": message.snippet,
                    "clientName": doc.get("clientName"),
                    "fromEmail": message.fromEmail,
                    "toEmail": doc.get("toEmail"),
                    "direction": message.direction,
                    "threadId": message.threadId,
                    "provider": PROVIDER_GMAIL,
                    "providerMessageId": message.sourceId,
                    "emailMessageId": doc["id"],
                    "channel": "email",
                    "gmailUrl": message.webLink,
                    "attachmentCount": doc.get("attachmentCount") or 0,
                    "connectedAccountId": connected_account_id,
                },
            )
            if message.threadId:
                await db.clients.update_one(
                    {"userId": user_id, "id": match["id"]},
                    {
                        "$set": {
                            "integrations.gmailThreadHint": message.threadId,
                            "updatedAt": _utc_now_iso(),
                        }
                    },
                )
        else:
            summary.unmatched += 1
            if _is_automatic_message(message):
                summary.automatic += 1

    summary.finishedAt = _utc_now_iso()
    return summary
