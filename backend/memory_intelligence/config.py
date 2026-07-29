"""Memory Intelligence — configurable thresholds (env-overridable)."""

from __future__ import annotations

import os


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


# Activity / loyalty windows (days)
VERY_ACTIVE_MAX_DAYS = _int("MI_VERY_ACTIVE_MAX_DAYS", 7)
VERY_ACTIVE_MIN_EXCHANGES = _int("MI_VERY_ACTIVE_MIN_EXCHANGES", 5)
INACTIVE_DAYS = _int("MI_INACTIVE_DAYS", 60)
FOLLOW_UP_MIN_DAYS = _int("MI_FOLLOW_UP_MIN_DAYS", 14)
FOLLOW_UP_MAX_DAYS = _int("MI_FOLLOW_UP_MAX_DAYS", 59)
LOYAL_MIN_AGE_DAYS = _int("MI_LOYAL_MIN_AGE_DAYS", 180)
LOYAL_MIN_EXCHANGES = _int("MI_LOYAL_MIN_EXCHANGES", 10)
NEW_CLIENT_DAYS = _int("MI_NEW_CLIENT_DAYS", 30)

# Volume
MANY_EXCHANGES = _int("MI_MANY_EXCHANGES", 15)
MANY_DOCUMENTS = _int("MI_MANY_DOCUMENTS", 8)
EMAILS_ONLY_MIN_EXCHANGES = _int("MI_EMAILS_ONLY_MIN_EXCHANGES", 3)
NO_DOCUMENTS_MIN_AGE_DAYS = _int("MI_NO_DOCUMENTS_MIN_AGE_DAYS", 14)

# Revenue (cents)
HIGH_REVENUE_CENTS = _int("MI_HIGH_REVENUE_CENTS", 500000)  # 5 000 €
LOW_REVENUE_CENTS = _int("MI_LOW_REVENUE_CENTS", 50000)  # 500 €

# Cache / recompute
CACHE_TTL_SECONDS = _int("MI_CACHE_TTL_SECONDS", 300)
MAX_ACTIONS = _int("MI_MAX_ACTIONS", 40)
MAX_CLIENT_LIST = _int("MI_MAX_CLIENT_LIST", 12)
MAX_RECENT = _int("MI_MAX_RECENT", 8)

# Reserved future channels (architecture only — rules registered, never fire today)
ENABLE_PHONE_CHANNEL = os.environ.get("MI_ENABLE_PHONE_CHANNEL", "").lower() in ("1", "true", "yes")
ENABLE_WHATSAPP_CHANNEL = os.environ.get("MI_ENABLE_WHATSAPP_CHANNEL", "").lower() in ("1", "true", "yes")
ENABLE_CALENDAR_CHANNEL = os.environ.get("MI_ENABLE_CALENDAR_CHANNEL", "").lower() in ("1", "true", "yes")
