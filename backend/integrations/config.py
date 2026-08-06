"""Integrations configuration from environment."""

from __future__ import annotations

import os
from typing import List

from integrations.constants import (
    GMAIL_AUTO_SYNC_DEFAULT_BATCH_SIZE,
    GMAIL_AUTO_SYNC_DEFAULT_INTERVAL_MINUTES,
    GMAIL_AUTO_SYNC_DEFAULT_TIMEOUT_SECONDS,
    GMAIL_AUTO_SYNC_MIN_INTERVAL_MINUTES,
)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return int(str(raw).strip())
    except ValueError:
        return default


def google_client_id() -> str:
    return os.environ.get("GOOGLE_CLIENT_ID", "").strip()


def google_client_secret() -> str:
    return os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()


def google_redirect_uri() -> str:
    return os.environ.get("GOOGLE_REDIRECT_URI", "").strip()


def google_gmail_redirect_uri() -> str:
    return os.environ.get("GOOGLE_GMAIL_REDIRECT_URI", "").strip()


def google_contacts_scopes() -> List[str]:
    raw = os.environ.get("GOOGLE_CONTACTS_SCOPES", "").strip()
    if not raw:
        from integrations.constants import DEFAULT_GOOGLE_CONTACTS_SCOPES

        raw = DEFAULT_GOOGLE_CONTACTS_SCOPES
    return [part for part in raw.replace(",", " ").split() if part]


def gmail_scopes() -> List[str]:
    raw = os.environ.get("GOOGLE_GMAIL_SCOPES", "").strip() or os.environ.get(
        "GMAIL_SCOPES", ""
    ).strip()
    if not raw:
        from integrations.constants import DEFAULT_GMAIL_SCOPES

        raw = DEFAULT_GMAIL_SCOPES
    return [part for part in raw.replace(",", " ").split() if part]


def google_contacts_configured() -> bool:
    return bool(google_client_id() and google_client_secret() and google_redirect_uri())


def gmail_configured() -> bool:
    """Gmail shares Google OAuth client; needs its own redirect URI (or fallback path)."""
    return bool(
        google_client_id()
        and google_client_secret()
        and (google_gmail_redirect_uri() or google_redirect_uri())
    )


def integrations_token_key() -> str:
    """Fernet key or fallback secret used to derive one in development."""
    return (
        os.environ.get("INTEGRATIONS_TOKEN_KEY", "").strip()
        or os.environ.get("JWT_SECRET", "").strip()
        or "dev-integrations-token-key-change-me"
    )


def contacts_provider_mode() -> str:
    """``google`` when credentials exist, else ``mock`` (tests / local without Google)."""
    explicit = os.environ.get("INTEGRATIONS_CONTACTS_PROVIDER", "").strip().lower()
    if explicit in {"google", "mock"}:
        return explicit
    return "google" if google_contacts_configured() else "mock"


def gmail_provider_mode() -> str:
    """``google`` when credentials exist, else ``mock``."""
    explicit = os.environ.get("INTEGRATIONS_GMAIL_PROVIDER", "").strip().lower()
    if explicit in {"google", "mock"}:
        return explicit
    return "google" if gmail_configured() else "mock"


def gmail_auto_sync_enabled() -> bool:
    """Scheduler Gmail auto-sync master switch (default: enabled)."""
    return _env_bool("GMAIL_AUTO_SYNC_ENABLED", True)


def gmail_auto_sync_interval_minutes() -> int:
    """Cadence between successful syncs. Never below 5 minutes."""
    value = _env_int(
        "GMAIL_AUTO_SYNC_INTERVAL_MINUTES",
        GMAIL_AUTO_SYNC_DEFAULT_INTERVAL_MINUTES,
    )
    return max(GMAIL_AUTO_SYNC_MIN_INTERVAL_MINUTES, value)


def gmail_auto_sync_batch_size() -> int:
    """Max Gmail accounts processed per scheduler tick."""
    value = _env_int(
        "GMAIL_AUTO_SYNC_BATCH_SIZE",
        GMAIL_AUTO_SYNC_DEFAULT_BATCH_SIZE,
    )
    return max(1, min(value, 200))


def gmail_auto_sync_timeout_seconds() -> int:
    """Per-account sync timeout (seconds)."""
    value = _env_int(
        "GMAIL_AUTO_SYNC_TIMEOUT_SECONDS",
        GMAIL_AUTO_SYNC_DEFAULT_TIMEOUT_SECONDS,
    )
    return max(10, min(value, 600))
