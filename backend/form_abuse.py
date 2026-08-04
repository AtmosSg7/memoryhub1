"""Lightweight anti-bot checks for public/sensitive forms (honeypot + min submit time)."""

from __future__ import annotations

import os
import time
from typing import Optional

from fastapi import HTTPException

# Field name: looks like a real "website" to bots; humans never see it.
HONEYPOT_FIELD = "website"
FORM_STARTED_FIELD = "formStartedAt"

_DEFAULT_MIN_SECONDS = 1.2


def _log_abuse(action: str, *, route: str, error: Optional[str] = None) -> None:
    # Lazy import — avoids auth ↔ observability circular import at startup.
    try:
        from observability import log_event

        log_event(action, result="blocked", route=route, error=error)
    except Exception:
        pass


def _abuse_checks_disabled() -> bool:
    # Tests can force checks even when E2E_DISABLE_RATE_LIMIT=1.
    if os.environ.get("FORM_ABUSE_FORCE", "").lower() in {"1", "true", "yes"}:
        return False
    if os.environ.get("E2E_DISABLE_RATE_LIMIT", "").lower() in {"1", "true", "yes"}:
        return True
    if os.environ.get("FORM_ABUSE_DISABLED", "").lower() in {"1", "true", "yes"}:
        return True
    return False


def min_submit_seconds() -> float:
    raw = os.environ.get("FORM_MIN_SUBMIT_SECONDS", "").strip()
    if raw:
        try:
            return max(0.0, float(raw))
        except ValueError:
            pass
    return _DEFAULT_MIN_SECONDS


def assert_human_submission(
    *,
    website: Optional[str] = None,
    form_started_at: Optional[float] = None,
    route: str = "form",
) -> None:
    """
    Reject obvious bots.

    - Honeypot filled → controlled 400 (no enumeration tip).
    - formStartedAt present and younger than min → 400.
    - formStartedAt omitted → allowed (API / pytest backward compatible);
      real UIs always send it.
    """
    if _abuse_checks_disabled():
        return

    if website is not None and str(website).strip():
        _log_abuse("abuse.honeypot", route=route)
        raise HTTPException(
            status_code=400,
            detail={"message": "Unable to process request."},
        )

    if form_started_at is None:
        return

    try:
        started = float(form_started_at)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail={"message": "Unable to process request."},
        ) from None

    # Reject absurd future timestamps / epoch-0 spam.
    now = time.time()
    if started > now + 30 or started < now - 86400:
        _log_abuse("abuse.form_timing", route=route, error="out_of_range")
        raise HTTPException(
            status_code=400,
            detail={"message": "Unable to process request."},
        )

    elapsed = now - started
    minimum = min_submit_seconds()
    if elapsed < minimum:
        _log_abuse("abuse.form_timing", route=route, error="too_fast")
        raise HTTPException(
            status_code=400,
            detail={"message": "Unable to process request."},
        )
