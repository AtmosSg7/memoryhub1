"""Communication Hub V2 — shared constants (channel-agnostic)."""

from __future__ import annotations

# Product channels (canonical ``communications.type``).
CHANNEL_EMAIL = "email"
CHANNEL_PHONE = "phone"
CHANNEL_WHATSAPP = "whatsapp"
CHANNEL_SMS = "sms"
CHANNEL_CALENDAR = "calendar"
CHANNEL_INTERNAL_NOTE = "internal_note"
CHANNEL_AI_SUMMARY = "ai_summary"

HUB_CHANNELS: tuple[str, ...] = (
    CHANNEL_EMAIL,
    CHANNEL_PHONE,
    CHANNEL_WHATSAPP,
    CHANNEL_SMS,
    CHANNEL_CALENDAR,
    CHANNEL_INTERNAL_NOTE,
    CHANNEL_AI_SUMMARY,
)

# Provider ids (wire format). Reserved providers stay stubs until wired.
PROVIDER_GMAIL = "gmail"
PROVIDER_OUTLOOK = "outlook"
PROVIDER_PHONE = "phone"
PROVIDER_WHATSAPP = "whatsapp"
PROVIDER_SMS = "sms"
PROVIDER_GOOGLE_CALENDAR = "google_calendar"
PROVIDER_INTERNAL = "internal"

# Lifecycle status — independent from association status (linked/unlinked/ignored).
LIFECYCLE_NEW = "new"
LIFECYCLE_TO_READ = "to_read"
LIFECYCLE_READ = "read"
LIFECYCLE_REPLIED = "replied"
LIFECYCLE_WAITING = "waiting"
LIFECYCLE_ARCHIVED = "archived"
LIFECYCLE_IGNORED = "ignored"

LIFECYCLE_STATUSES: tuple[str, ...] = (
    LIFECYCLE_NEW,
    LIFECYCLE_TO_READ,
    LIFECYCLE_READ,
    LIFECYCLE_REPLIED,
    LIFECYCLE_WAITING,
    LIFECYCLE_ARCHIVED,
    LIFECYCLE_IGNORED,
)

# Allowed transitions (from → frozenset(to)). Open graph: most statuses can move freely.
_LIFECYCLE_OPEN = frozenset(LIFECYCLE_STATUSES)
LIFECYCLE_TRANSITIONS: dict[str, frozenset[str]] = {
    status: _LIFECYCLE_OPEN - {status} for status in LIFECYCLE_STATUSES
}

# Association status (existing Gmail / prospects semantics — unchanged).
ASSOCIATION_LINKED = "linked"
ASSOCIATION_UNLINKED = "unlinked"
ASSOCIATION_IGNORED = "ignored"

# Attachment kinds
ATTACHMENT_KIND_IMAGE = "image"
ATTACHMENT_KIND_PDF = "pdf"
ATTACHMENT_KIND_DOCUMENT = "document"
ATTACHMENT_KIND_QUOTE = "quote"
ATTACHMENT_KIND_INVOICE = "invoice"
ATTACHMENT_KIND_PHOTO = "photo"
ATTACHMENT_KIND_OTHER = "other"

ATTACHMENT_KINDS: tuple[str, ...] = (
    ATTACHMENT_KIND_IMAGE,
    ATTACHMENT_KIND_PDF,
    ATTACHMENT_KIND_DOCUMENT,
    ATTACHMENT_KIND_QUOTE,
    ATTACHMENT_KIND_INVOICE,
    ATTACHMENT_KIND_PHOTO,
    ATTACHMENT_KIND_OTHER,
)

PRIORITY_LOW = "low"
PRIORITY_NORMAL = "normal"
PRIORITY_HIGH = "high"
PRIORITY_URGENT = "urgent"
PRIORITIES: tuple[str, ...] = (PRIORITY_LOW, PRIORITY_NORMAL, PRIORITY_HIGH, PRIORITY_URGENT)
