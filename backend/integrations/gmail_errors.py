"""Gmail API error helpers — no secrets in messages."""

from __future__ import annotations

from typing import Any, Optional


class GmailHistoryExpiredError(Exception):
    """startHistoryId is no longer valid — caller must fall back to full sync."""

    def __init__(self, message: str = "Gmail history cursor expired."):
        super().__init__(message)


class GmailApiError(Exception):
    """Non-recoverable Gmail API failure during sync."""

    def __init__(self, message: str, *, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class GmailSyncInProgressError(Exception):
    """Another worker already holds the per-account sync lock."""

    def __init__(self, message: str = "Gmail sync already in progress."):
        super().__init__(message)


def _error_payload(response) -> dict:
    try:
        data = response.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def is_history_expired_response(response) -> bool:
    """Detect Google responses that mean the historyId cursor is invalid."""
    if response is None:
        return False
    status = getattr(response, "status_code", None)
    if status not in (404, 400):
        return False
    payload = _error_payload(response)
    err = payload.get("error") or {}
    if not isinstance(err, dict):
        return False
    reason = str(err.get("status") or "").upper()
    message = str(err.get("message") or "").lower()
    errors = err.get("errors") or []
    error_reasons = {
        str(item.get("reason") or "").lower()
        for item in errors
        if isinstance(item, dict)
    }
    if "historyid" in error_reasons or "notfound" in error_reasons:
        return True
    if "history" in message and ("not found" in message or "invalid" in message or "expired" in message):
        return True
    if reason in ("NOT_FOUND", "FAILED_PRECONDITION") and "history" in message:
        return True
    return status == 404 and ("history" in message or not message)


def safe_error_message(exc: BaseException, *, limit: int = 200) -> str:
    text = str(exc or "Gmail sync failed").replace("\n", " ").strip()
    # Never log bearer tokens if somehow present
    lowered = text.lower()
    if "bearer " in lowered or "ya29." in lowered:
        text = "Gmail sync failed (credentials redacted)."
    return text[:limit]
