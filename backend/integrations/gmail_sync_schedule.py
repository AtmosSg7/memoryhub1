"""Gmail sync scheduling helpers (backoff, lock keys, cadence)."""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

from integrations.config import gmail_auto_sync_interval_minutes
from integrations.constants import (
    GMAIL_AUTO_SYNC_BACKOFF_MAX_MINUTES,
    GMAIL_AUTO_SYNC_BACKOFF_MINUTES,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def mask_user_id(user_id: str) -> str:
    digest = hashlib.sha256((user_id or "").encode("utf-8")).hexdigest()[:12]
    return f"u_{digest}"


def gmail_sync_lock_key(account_id: str) -> str:
    return f"gmail-sync:{account_id}"


def backoff_delay_minutes(consecutive_errors: int, *, interval_minutes: int) -> int:
    """Return delay until next attempt after ``consecutive_errors`` failures."""
    errors = max(0, int(consecutive_errors))
    if errors <= 1:
        return interval_minutes
    if errors in GMAIL_AUTO_SYNC_BACKOFF_MINUTES:
        mapped = GMAIL_AUTO_SYNC_BACKOFF_MINUTES[errors]
        return interval_minutes if mapped is None else mapped
    return GMAIL_AUTO_SYNC_BACKOFF_MAX_MINUTES


def compute_next_sync_at(
    *,
    consecutive_errors: int = 0,
    interval_minutes: Optional[int] = None,
    now: Optional[datetime] = None,
) -> str:
    interval = (
        interval_minutes
        if interval_minutes is not None
        else gmail_auto_sync_interval_minutes()
    )
    delay = backoff_delay_minutes(consecutive_errors, interval_minutes=interval)
    base = now or _utc_now()
    return (base + timedelta(minutes=delay)).isoformat()
