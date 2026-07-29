"""Constants for internal admin operations and analytics."""

from __future__ import annotations

import os

COLLECTION_AI_USAGE_EVENTS = "ai_usage_events"
COLLECTION_ADMIN_AUDIT_LOGS = "admin_audit_logs"

USER_ROLE_USER = "user"
USER_ROLE_ADMIN = "admin"
USER_ROLE_SUPPORT = "support"

ADMIN_PAGE_SIZE_DEFAULT = 25
ADMIN_PAGE_SIZE_MAX = 100
ADMIN_EXPORT_MAX_ROWS = 5000
ADMIN_MAX_PERIOD_DAYS = 366
ADMIN_OVERVIEW_CACHE_SECONDS = 60

# Estimated monthly plan prices (EUR) for MRR when Stripe amounts unavailable.
# Set via env to real catalog prices — never invent at runtime.
def _plan_price_env(key: str) -> float | None:
    raw = os.environ.get(key, "").strip()
    if not raw:
        return None
    try:
        value = float(raw)
        return value if value > 0 else None
    except ValueError:
        return None


PLAN_MONTHLY_PRICE_EUR = {
    "solo": _plan_price_env("ADMIN_MRR_SOLO_EUR"),
    "pro": _plan_price_env("ADMIN_MRR_PRO_EUR"),
    "team": _plan_price_env("ADMIN_MRR_TEAM_EUR"),
}

MRR_ELIGIBLE_STATUSES = frozenset({"trial", "active", "past_due"})

# Business actions counting toward "active user" in a period.
ACTIVE_USER_SOURCES = (
    "events",
    "import_sessions",
    "credit_transactions",
)
