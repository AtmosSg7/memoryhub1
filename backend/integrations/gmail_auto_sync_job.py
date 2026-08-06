"""Scheduled Gmail auto-sync job (incremental via historyId).

Wired from ``scripts/run_scheduled_tasks.py``. Safe for multiple scheduler
instances thanks to Mongo ``distributed_locks`` inside ``sync_gmail``.
Never raises out of ``run_gmail_auto_sync`` — failures are counted per account.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence

from observability import get_logger

from integrations.config import (
    gmail_auto_sync_batch_size,
    gmail_auto_sync_enabled,
    gmail_auto_sync_interval_minutes,
    gmail_auto_sync_timeout_seconds,
)
from integrations.constants import (
    ACCOUNT_STATUS_CONNECTED,
    GMAIL_SYNC_STATE_ERROR,
    GMAIL_SYNC_STATE_IDLE,
    PROVIDER_GMAIL,
)
from integrations.gmail_errors import GmailSyncInProgressError, safe_error_message
from integrations.gmail_sync_schedule import compute_next_sync_at, mask_user_id

logger = get_logger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_now_iso() -> str:
    return _utc_now().isoformat()


async def list_eligible_gmail_accounts(
    db,
    *,
    limit: int,
    user_ids: Optional[Sequence[str]] = None,
) -> List[dict]:
    """Connected Gmail accounts whose ``nextSyncAt`` is due (or unset)."""
    now_iso = _utc_now_iso()
    query: Dict[str, Any] = {
        "provider": PROVIDER_GMAIL,
        "status": ACCOUNT_STATUS_CONNECTED,
        "$or": [
            {"nextSyncAt": {"$exists": False}},
            {"nextSyncAt": None},
            {"nextSyncAt": {"$lte": now_iso}},
        ],
    }
    if user_ids:
        query["userId"] = {"$in": list(user_ids)}
    cursor = (
        db.connected_accounts.find(query, {"_id": 0})
        .sort([("nextSyncAt", 1), ("lastSuccessfulSyncAt", 1)])
        .limit(max(1, int(limit)))
    )
    return [doc async for doc in cursor]


async def _record_attempt(db, account: dict) -> None:
    await db.connected_accounts.update_one(
        {"id": account["id"], "provider": PROVIDER_GMAIL},
        {"$set": {"lastSyncAttemptAt": _utc_now_iso(), "updatedAt": _utc_now_iso()}},
    )


async def _record_success_schedule(db, account: dict) -> None:
    now = _utc_now()
    await db.connected_accounts.update_one(
        {"id": account["id"], "provider": PROVIDER_GMAIL},
        {
            "$set": {
                "consecutiveSyncErrors": 0,
                "nextSyncAt": compute_next_sync_at(consecutive_errors=0, now=now),
                "syncState": GMAIL_SYNC_STATE_IDLE,
                "lastSyncError": None,
                "updatedAt": now.isoformat(),
            }
        },
    )


async def _record_failure_schedule(db, account: dict, error: str) -> int:
    prev = int(account.get("consecutiveSyncErrors") or 0)
    consecutive = prev + 1
    now = _utc_now()
    next_at = compute_next_sync_at(consecutive_errors=consecutive, now=now)
    await db.connected_accounts.update_one(
        {"id": account["id"], "provider": PROVIDER_GMAIL},
        {
            "$set": {
                "consecutiveSyncErrors": consecutive,
                "nextSyncAt": next_at,
                "syncState": GMAIL_SYNC_STATE_ERROR,
                "lastSyncError": (error or "")[:500],
                "lastError": (error or "")[:500],
                # Keep OAuth status connected so auto-sync can retry after backoff.
                "status": ACCOUNT_STATUS_CONNECTED,
                "updatedAt": now.isoformat(),
            }
        },
    )
    return consecutive


async def _sync_one_account(
    db,
    account: dict,
    *,
    timeout_seconds: int,
) -> Dict[str, Any]:
    from integrations.gmail_sync_service import run_gmail_sync_for_user

    account_id = account.get("id") or ""
    user_id = account.get("userId") or ""
    started = time.monotonic()

    try:
        await _record_attempt(db, account)
        response = await asyncio.wait_for(
            run_gmail_sync_for_user(db, user_id),
            timeout=timeout_seconds,
        )
        await _record_success_schedule(db, account)
        summary = response.summary
        duration_ms = int((time.monotonic() - started) * 1000)
        logger.info(
            "gmail_auto_sync_account_ok account_id=%s user=%s mode=%s detected=%s "
            "created=%s updated=%s linked=%s unmatched=%s errors=%s duration_ms=%s",
            account_id,
            mask_user_id(user_id),
            getattr(summary, "mode", None),
            getattr(summary, "detected", 0),
            getattr(summary, "created", 0),
            getattr(summary, "updated", 0),
            getattr(summary, "linked", 0),
            getattr(summary, "unmatched", 0),
            getattr(summary, "errors", 0),
            duration_ms,
        )
        return {
            "outcome": "success",
            "accountId": account_id,
            "userIdMasked": mask_user_id(user_id),
            "mode": getattr(summary, "mode", None),
            "detected": getattr(summary, "detected", 0),
            "created": getattr(summary, "created", 0),
            "updated": getattr(summary, "updated", 0),
            "linked": getattr(summary, "linked", 0),
            "unmatched": getattr(summary, "unmatched", 0),
            "durationMs": duration_ms,
        }
    except GmailSyncInProgressError:
        return {
            "outcome": "locked",
            "accountId": account_id,
            "userIdMasked": mask_user_id(user_id),
            "durationMs": int((time.monotonic() - started) * 1000),
        }
    except Exception as exc:
        err = safe_error_message(exc)
        if isinstance(exc, asyncio.TimeoutError):
            err = f"Gmail sync timed out after {timeout_seconds}s"
        consecutive = await _record_failure_schedule(db, account, err)
        duration_ms = int((time.monotonic() - started) * 1000)
        logger.warning(
            "gmail_auto_sync_account_fail account_id=%s user=%s consecutive=%s "
            "error=%s duration_ms=%s",
            account_id,
            mask_user_id(user_id),
            consecutive,
            err,
            duration_ms,
        )
        return {
            "outcome": "error",
            "accountId": account_id,
            "userIdMasked": mask_user_id(user_id),
            "error": err,
            "consecutiveSyncErrors": consecutive,
            "durationMs": duration_ms,
        }


async def run_gmail_auto_sync(
    db,
    *,
    user_ids: Optional[Sequence[str]] = None,
) -> Dict[str, Any]:
    """Process a batch of due Gmail accounts. Never raises.

    ``user_ids`` optionally restricts the tick (useful for tests / ops).
    """
    started = time.monotonic()
    if not gmail_auto_sync_enabled():
        logger.info("gmail_auto_sync_skipped reason=disabled")
        return {
            "enabled": False,
            "eligible": 0,
            "processed": 0,
            "success": 0,
            "failed": 0,
            "locked": 0,
            "durationMs": int((time.monotonic() - started) * 1000),
        }

    batch_size = gmail_auto_sync_batch_size()
    timeout_seconds = gmail_auto_sync_timeout_seconds()
    interval = gmail_auto_sync_interval_minutes()

    try:
        accounts = await list_eligible_gmail_accounts(
            db, limit=batch_size, user_ids=user_ids
        )
    except Exception:
        logger.exception("gmail_auto_sync_list_failed")
        return {
            "enabled": True,
            "eligible": 0,
            "processed": 0,
            "success": 0,
            "failed": 0,
            "locked": 0,
            "durationMs": int((time.monotonic() - started) * 1000),
            "error": "list_failed",
        }

    success = 0
    failed = 0
    locked = 0
    for account in accounts:
        try:
            result = await _sync_one_account(
                db,
                account,
                timeout_seconds=timeout_seconds,
            )
        except Exception:
            logger.exception(
                "gmail_auto_sync_account_unexpected account_id=%s",
                account.get("id"),
            )
            failed += 1
            continue
        outcome = result.get("outcome")
        if outcome == "success":
            success += 1
        elif outcome == "locked":
            locked += 1
        else:
            failed += 1

    duration_ms = int((time.monotonic() - started) * 1000)
    summary = {
        "enabled": True,
        "eligible": len(accounts),
        "processed": success + failed,
        "success": success,
        "failed": failed,
        "locked": locked,
        "batchSize": batch_size,
        "intervalMinutes": interval,
        "timeoutSeconds": timeout_seconds,
        "durationMs": duration_ms,
    }
    logger.info(
        "gmail_auto_sync_tick eligible=%s processed=%s success=%s failed=%s "
        "locked=%s duration_ms=%s",
        summary["eligible"],
        summary["processed"],
        summary["success"],
        summary["failed"],
        summary["locked"],
        duration_ms,
    )
    return summary
