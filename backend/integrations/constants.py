"""Integrations constants."""

from __future__ import annotations

PROVIDER_GOOGLE_CONTACTS = "google_contacts"
PROVIDER_GMAIL = "gmail"

ACCOUNT_STATUS_CONNECTED = "connected"
ACCOUNT_STATUS_DISCONNECTED = "disconnected"
ACCOUNT_STATUS_ERROR = "error"

IMPORT_RESULT_CREATED = "created"
IMPORT_RESULT_ENRICHED = "enriched"
IMPORT_RESULT_CONFLICT = "conflict"
IMPORT_RESULT_SKIPPED = "skipped"

EMAIL_RESULT_LINKED = "linked"
EMAIL_RESULT_UNMATCHED = "unmatched"
EMAIL_RESULT_SKIPPED = "skipped"

DEFAULT_GOOGLE_CONTACTS_SCOPES = (
    "https://www.googleapis.com/auth/contacts.readonly "
    "openid email profile"
)

DEFAULT_GMAIL_SCOPES = (
    "https://www.googleapis.com/auth/gmail.readonly "
    "openid email profile"
)

# Soft cap for a single manual sync (read-only metadata).
GMAIL_SYNC_MAX_MESSAGES = 100

# Incremental history sync bounds.
GMAIL_HISTORY_PAGE_SIZE = 100
GMAIL_HISTORY_MAX_PAGES = 20
GMAIL_HISTORY_MAX_MESSAGE_IDS = 200

GMAIL_SYNC_STATE_IDLE = "idle"
GMAIL_SYNC_STATE_RUNNING = "running"
GMAIL_SYNC_STATE_ERROR = "error"

# Auto-sync defaults (overridable via env — see integrations.config).
GMAIL_AUTO_SYNC_DEFAULT_INTERVAL_MINUTES = 10
GMAIL_AUTO_SYNC_MIN_INTERVAL_MINUTES = 5
GMAIL_AUTO_SYNC_DEFAULT_BATCH_SIZE = 25
GMAIL_AUTO_SYNC_DEFAULT_TIMEOUT_SECONDS = 60
GMAIL_AUTO_SYNC_BACKOFF_MINUTES = {
    1: None,  # use normal interval
    2: 30,
    3: 60,
}
GMAIL_AUTO_SYNC_BACKOFF_MAX_MINUTES = 360  # 6h for 4+ consecutive errors

OAUTH_STATE_TTL_SECONDS = 600
TOKEN_REFRESH_SKEW_SECONDS = 120
