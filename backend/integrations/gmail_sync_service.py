"""Gmail sync orchestration — full + incremental history.

Incremental sync uses Gmail ``users.history.list`` when a ``historyId`` cursor
exists on ``connected_accounts``. The cursor advances only after a successful
import. An expired cursor falls back to a capped full sync.

Manual route and scheduler both call :func:`run_gmail_sync_for_user` /
:func:`sync_gmail`. Per-account concurrency is guarded by a Mongo distributed
lock. Transient sync failures keep ``status=connected`` so auto-sync can retry.
"""

from __future__ import annotations

import os
import socket
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from observability import get_logger

from integrations import account_service
from integrations.config import gmail_auto_sync_interval_minutes, gmail_auto_sync_timeout_seconds
from integrations.constants import (
    ACCOUNT_STATUS_CONNECTED,
    GMAIL_HISTORY_MAX_MESSAGE_IDS,
    GMAIL_SYNC_MAX_MESSAGES,
    GMAIL_SYNC_STATE_ERROR,
    GMAIL_SYNC_STATE_IDLE,
    GMAIL_SYNC_STATE_RUNNING,
    PROVIDER_GMAIL,
)
from integrations.distributed_lock import acquire_lock, release_lock
from integrations.email_import_service import import_remote_emails
from integrations.gmail_errors import (
    GmailHistoryExpiredError,
    GmailSyncInProgressError,
    safe_error_message,
)
from integrations.gmail_sync_schedule import compute_next_sync_at, gmail_sync_lock_key
from integrations.models import (
    ClientEmailsResponse,
    GmailMailboxStats,
    GmailPreviewResponse,
    GmailStatusResponse,
    GmailSyncResponse,
    GmailSyncSummary,
    RemoteEmailMessage,
    SyncedEmailAttachmentPublic,
    SyncedEmailPublic,
    SyncSummary,
)
from integrations.registry import get_email_provider

logger = get_logger(__name__)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


async def _gmail_mailbox_stats(db, user_id: str) -> GmailMailboxStats:
    """Count Gmail communications currently stored for this user."""
    base = {"userId": user_id, "provider": PROVIDER_GMAIL, "type": "email"}
    total = int(await db.communications.count_documents(base))
    ignored = int(
        await db.communications.count_documents(
            {**base, "ignoredAt": {"$type": "string", "$ne": ""}}
        )
    )
    linked = int(
        await db.communications.count_documents(
            {
                **base,
                "clientId": {"$type": "string", "$ne": ""},
                "$or": [
                    {"ignoredAt": {"$exists": False}},
                    {"ignoredAt": None},
                    {"ignoredAt": ""},
                ],
            }
        )
    )
    return GmailMailboxStats(linked=linked, ignored=ignored, total=total)


async def get_gmail_status(db, user_id: str) -> GmailStatusResponse:
    from integrations.config import gmail_configured, gmail_provider_mode

    account = await account_service.get_account(db, user_id, PROVIDER_GMAIL)
    last_sync = None
    if account and account.get("lastSyncSummary"):
        raw = account["lastSyncSummary"]
        # Prefer explicit linked; do not fall back to "created" (new rows) — different metric.
        last_sync = SyncSummary(
            created=int(raw.get("linked") or 0),
            enriched=0,
            conflicts=0,
            skipped=int(raw.get("skipped") or 0) + int(raw.get("unmatched") or 0),
            total=int(raw.get("total") or 0),
            finishedAt=raw.get("finishedAt"),
        )
    connected = bool(account and account.get("status") == ACCOUNT_STATUS_CONNECTED)
    stats = (
        await _gmail_mailbox_stats(db, user_id) if connected else GmailMailboxStats()
    )
    return GmailStatusResponse(
        configured=gmail_configured() or gmail_provider_mode() == "mock",
        providerMode=gmail_provider_mode(),
        connected=connected,
        account=account_service.account_public(account) if account and connected else None,
        lastSync=last_sync,
        stats=stats,
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


async def _set_sync_state(db, user_id: str, state: str, *, error: Optional[str] = None) -> None:
    payload = {
        "syncState": state,
        "updatedAt": _utc_now_iso(),
    }
    if error is not None:
        payload["lastSyncError"] = (error or "")[:500]
        payload["lastError"] = (error or "")[:500]
    elif state == GMAIL_SYNC_STATE_IDLE:
        payload["lastSyncError"] = None
        payload["lastError"] = None
    await db.connected_accounts.update_one(
        {"userId": user_id, "provider": PROVIDER_GMAIL},
        {"$set": payload},
    )


async def _persist_success(
    db,
    user_id: str,
    summary: GmailSyncSummary,
    *,
    history_id: Optional[str],
    full_sync: bool,
) -> None:
    finished = summary.finishedAt or _utc_now_iso()
    summary.finishedAt = finished
    summary.cursorUpdated = bool(history_id)
    bridge = SyncSummary(
        created=summary.linked,
        enriched=0,
        conflicts=0,
        skipped=summary.skipped + summary.unmatched,
        total=summary.total,
        finishedAt=finished,
    )
    payload = {
        **bridge.model_dump(),
        "linked": summary.linked,
        "unmatched": summary.unmatched,
        "skipped": summary.skipped,
        "mode": summary.mode,
        "detected": summary.detected,
        "analyzed": summary.analyzed,
        "created": summary.created,
        "updated": summary.updated,
        "automatic": summary.automatic,
        "ignored": summary.ignored,
        "errors": summary.errors,
        "cursorUpdated": summary.cursorUpdated,
        "fallbackFromIncremental": summary.fallbackFromIncremental,
    }
    fields = {
        "lastSyncedAt": finished,
        "lastSuccessfulSyncAt": finished,
        "lastSyncAttemptAt": finished,
        "lastSyncSummary": payload,
        "updatedAt": finished,
        "lastError": None,
        "lastSyncError": None,
        "syncState": GMAIL_SYNC_STATE_IDLE,
        "consecutiveSyncErrors": 0,
        "nextSyncAt": compute_next_sync_at(
            consecutive_errors=0,
            interval_minutes=gmail_auto_sync_interval_minutes(),
        ),
        "status": ACCOUNT_STATUS_CONNECTED,
    }
    if history_id:
        fields["historyId"] = str(history_id)
    if full_sync:
        fields["lastFullSyncAt"] = finished
    await db.connected_accounts.update_one(
        {"userId": user_id, "provider": PROVIDER_GMAIL},
        {"$set": fields},
    )


async def _collect_incremental_messages(
    provider,
    *,
    access: str,
    account: dict,
) -> Tuple[List[RemoteEmailMessage], Optional[str], int]:
    """Return (messages, next_history_id, detected_count)."""
    start = str(account.get("historyId") or "").strip()
    history = await provider.list_history_message_ids(
        access_token=access,
        start_history_id=start,
        max_message_ids=GMAIL_HISTORY_MAX_MESSAGE_IDS,
    )
    detected = len(history.messageIds)
    messages = await provider.fetch_messages_by_ids(
        access_token=access,
        message_ids=history.messageIds,
        account_email=account.get("accountEmail"),
    )
    next_history = history.historyId
    if not next_history:
        profile = await provider.get_mailbox_profile(access_token=access)
        next_history = profile.historyId
    return messages, next_history, detected


async def _collect_full_messages(
    provider,
    *,
    access: str,
) -> Tuple[List[RemoteEmailMessage], Optional[str], int]:
    messages = await provider.list_messages(
        access_token=access,
        max_results=GMAIL_SYNC_MAX_MESSAGES,
    )
    profile = await provider.get_mailbox_profile(access_token=access)
    return messages, profile.historyId, len(messages)


async def sync_gmail(db, user_id: str) -> GmailSyncResponse:
    """Run one Gmail sync (incremental when possible, else capped full)."""
    account = await account_service.get_account(db, user_id, PROVIDER_GMAIL)
    if not account or account.get("status") != ACCOUNT_STATUS_CONNECTED:
        raise ValueError("Gmail is not connected.")

    account_id = account.get("id") or ""
    lock_key = gmail_sync_lock_key(account_id)
    lock_owner = f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:8]}"
    lock_ttl = gmail_auto_sync_timeout_seconds() + 30
    locked = await acquire_lock(db, lock_key, owner=lock_owner, ttl_seconds=lock_ttl)
    if not locked:
        raise GmailSyncInProgressError()

    provider = get_email_provider(PROVIDER_GMAIL)
    mode = "full"
    fallback = False
    cursor_candidate: Optional[str] = None
    detected = 0

    try:
        await _set_sync_state(db, user_id, GMAIL_SYNC_STATE_RUNNING)
        access = await account_service.ensure_fresh_access_token(db, user_id, provider, account)
        # Reload account after possible token refresh upsert
        account = await account_service.get_account(db, user_id, PROVIDER_GMAIL) or account

        if account.get("historyId"):
            try:
                messages, cursor_candidate, detected = await _collect_incremental_messages(
                    provider, access=access, account=account
                )
                mode = "incremental"
            except GmailHistoryExpiredError:
                logger.info(
                    "gmail_sync_history_expired user_id=%s falling_back=full",
                    user_id,
                )
                fallback = True
                messages, cursor_candidate, detected = await _collect_full_messages(
                    provider, access=access
                )
                mode = "full"
            except NotImplementedError:
                messages, cursor_candidate, detected = await _collect_full_messages(
                    provider, access=access
                )
                mode = "full"
        else:
            messages, cursor_candidate, detected = await _collect_full_messages(
                provider, access=access
            )
            mode = "full"

        summary = await import_remote_emails(
            db,
            user_id,
            messages,
            account_email=account.get("accountEmail"),
            connected_account_id=account.get("id"),
        )
        summary.mode = mode  # type: ignore[assignment]
        summary.detected = detected
        summary.analyzed = len(messages)
        summary.fallbackFromIncremental = fallback
        summary.total = detected if mode == "incremental" else len(messages)

        # Cursor advances only after successful import
        await _persist_success(
            db,
            user_id,
            summary,
            history_id=cursor_candidate,
            full_sync=(mode == "full"),
        )

        updated = await account_service.get_account(db, user_id, PROVIDER_GMAIL)
        logger.info(
            "gmail_sync_ok user_id=%s mode=%s detected=%s created=%s linked=%s unmatched=%s "
            "skipped=%s cursor_updated=%s fallback=%s",
            user_id,
            mode,
            summary.detected,
            summary.created,
            summary.linked,
            summary.unmatched,
            summary.skipped,
            summary.cursorUpdated,
            fallback,
        )
        return GmailSyncResponse(
            summary=summary,
            account=account_service.account_public(updated or account),
        )
    except GmailSyncInProgressError:
        raise
    except Exception as exc:
        err = safe_error_message(exc)
        # Soft failure: keep status=connected so scheduler/auto-sync can retry.
        await _set_sync_state(db, user_id, GMAIL_SYNC_STATE_ERROR, error=err)
        logger.exception("gmail_sync_failed user_id=%s", user_id)
        raise
    finally:
        await release_lock(db, lock_key, owner=lock_owner)


async def run_gmail_sync_for_user(db, user_id: str) -> GmailSyncResponse:
    """Scheduler entrypoint — same path as manual sync."""
    return await sync_gmail(db, user_id)


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
