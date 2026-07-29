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

OAUTH_STATE_TTL_SECONDS = 600
TOKEN_REFRESH_SKEW_SECONDS = 120
