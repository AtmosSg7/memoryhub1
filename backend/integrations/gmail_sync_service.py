"""Gmail sync orchestration (Gmail → MemoryHub metadata only)."""

from __future__ import annotations

from typing import List, Optional

from integrations import account_service
from integrations.constants import (
    ACCOUNT_STATUS_CONNECTED,
    GMAIL_SYNC_MAX_MESSAGES,
    PROVIDER_GMAIL,
)
from integrations.email_import_service import import_remote_emails
from integrations.models import (
    ClientEmailsResponse,
    GmailPreviewResponse,
    GmailStatusResponse,
    GmailSyncResponse,
    GmailSyncSummary,
    SyncedEmailAttachmentPublic,
    SyncedEmailPublic,
    SyncSummary,
)
from integrations.registry import get_email_provider


def _email_public(doc: dict) -> SyncedEmailPublic:
    attachments = [
        SyncedEmailAttachmentPublic(**a) if isinstance(a, dict) else a
        for a in (doc.get("attachments") or [])
    ]
    return SyncedEmailPublic(
        id=doc["id"],
        clientId=doc.get("clientId"),
        provider=doc.get("provider") or PROVIDER_GMAIL,
        providerMessageId=doc.get("providerMessageId") or "",
        threadId=doc.get("threadId"),
        direction=doc.get("direction") or "inbound",
        subject=doc.get("subject"),
        preview=doc.get("preview"),
        fromEmail=doc.get("fromEmail"),
        fromName=doc.get("fromName"),
        toEmail=doc.get("toEmail"),
        toEmails=list(doc.get("toEmails") or []),
        attachments=attachments,
        attachmentCount=int(doc.get("attachmentCount") or len(attachments)),
        gmailUrl=doc.get("gmailUrl"),
        sentAt=doc.get("sentAt"),
        matchedBy=doc.get("matchedBy"),
    )


async def get_gmail_status(db, user_id: str) -> GmailStatusResponse:
    from integrations.config import gmail_configured, gmail_provider_mode

    account = await account_service.get_account(db, user_id, PROVIDER_GMAIL)
    last_sync = None
    if account and account.get("lastSyncSummary"):
        raw = account["lastSyncSummary"]
        # Support both SyncSummary-shaped and GmailSyncSummary-shaped docs
        last_sync = SyncSummary(
            created=int(raw.get("linked") or raw.get("created") or 0),
            enriched=0,
            conflicts=0,
            skipped=int(raw.get("skipped") or raw.get("unmatched") or 0),
            total=int(raw.get("total") or 0),
            finishedAt=raw.get("finishedAt"),
        )
    connected = bool(account and account.get("status") == ACCOUNT_STATUS_CONNECTED)
    return GmailStatusResponse(
        configured=gmail_configured() or gmail_provider_mode() == "mock",
        providerMode=gmail_provider_mode(),
        connected=connected,
        account=account_service.account_public(account) if account and connected else None,
        lastSync=last_sync,
    )


async def preview_gmail(db, user_id: str) -> GmailPreviewResponse:
    account = await account_service.get_account(db, user_id, PROVIDER_GMAIL)
    if not account or account.get("status") != ACCOUNT_STATUS_CONNECTED:
        return GmailPreviewResponse(connected=False, messageCount=0)

    provider = get_email_provider(PROVIDER_GMAIL)
    access = await account_service.ensure_fresh_access_token(db, user_id, provider, account)
    count = await provider.count_messages(access_token=access)
    return GmailPreviewResponse(
        connected=True,
        messageCount=count,
        accountEmail=account.get("accountEmail"),
    )


async def sync_gmail(db, user_id: str) -> GmailSyncResponse:
    account = await account_service.get_account(db, user_id, PROVIDER_GMAIL)
    if not account or account.get("status") != ACCOUNT_STATUS_CONNECTED:
        raise ValueError("Gmail is not connected.")

    provider = get_email_provider(PROVIDER_GMAIL)
    try:
        access = await account_service.ensure_fresh_access_token(db, user_id, provider, account)
        messages = await provider.list_messages(
            access_token=access,
            max_results=GMAIL_SYNC_MAX_MESSAGES,
        )
        summary = await import_remote_emails(
            db,
            user_id,
            messages,
            account_email=account.get("accountEmail"),
        )
        # Persist summary in a shape compatible with account_service.save_sync_summary
        bridge = SyncSummary(
            created=summary.linked,
            enriched=0,
            conflicts=0,
            skipped=summary.skipped + summary.unmatched,
            total=summary.total,
            finishedAt=summary.finishedAt,
        )
        # Also store gmail-specific keys
        payload = {
            **bridge.model_dump(),
            "linked": summary.linked,
            "unmatched": summary.unmatched,
            "skipped": summary.skipped,
        }
        await db.connected_accounts.update_one(
            {"userId": user_id, "provider": PROVIDER_GMAIL},
            {
                "$set": {
                    "lastSyncedAt": summary.finishedAt,
                    "lastSyncSummary": payload,
                    "updatedAt": summary.finishedAt,
                    "lastError": None,
                }
            },
        )
        updated = await account_service.get_account(db, user_id, PROVIDER_GMAIL)
        return GmailSyncResponse(
            summary=summary,
            account=account_service.account_public(updated or account),
        )
    except Exception as exc:
        await account_service.mark_account_error(db, user_id, PROVIDER_GMAIL, str(exc))
        raise


async def list_client_emails(
    db,
    user_id: str,
    client_id: str,
    *,
    limit: int = 50,
) -> ClientEmailsResponse:
    query = {"userId": user_id, "clientId": client_id, "provider": PROVIDER_GMAIL}
    total = await db.email_messages.count_documents(query)
    cursor = (
        db.email_messages.find(query, {"_id": 0})
        .sort("sentAt", -1)
        .limit(max(1, min(limit, 200)))
    )
    items = [_email_public(doc) async for doc in cursor]
    return ClientEmailsResponse(items=items, total=total)
