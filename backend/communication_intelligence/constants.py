"""Constants, intents, feature flags for Communication Intelligence."""

from __future__ import annotations

import os

ANALYSIS_VERSION = "1.0.0"
CREDIT_ACTION_KEY = "COMMUNICATION_ANALYSIS"

STATUS_PENDING = "pending"
STATUS_READY = "ready"
STATUS_ERROR = "error"
STATUS_SKIPPED = "skipped"

SUGGESTION_PENDING = "pending"
SUGGESTION_ACCEPTED = "accepted"
SUGGESTION_REJECTED = "rejected"
SUGGESTION_NONE = "none"

INTENTS = (
    "request_quote",
    "request_callback",
    "appointment_request",
    "question",
    "complaint",
    "payment_question",
    "document_sent",
    "quote_accepted",
    "quote_rejected",
    "invoice_paid_claim",
    "follow_up",
    "other",
)

URGENCIES = ("low", "normal", "high", "urgent")

ENTITY_KEYS = (
    "name",
    "company",
    "phone",
    "email",
    "date",
    "amount",
    "address",
    "workType",
    "quoteNumber",
    "invoiceNumber",
)


def ci_enabled() -> bool:
    return os.environ.get("COMMUNICATION_INTELLIGENCE_ENABLED", "false").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def ci_auto_on_ingest() -> bool:
    """Mass auto-analysis after sync — off by default (production guardrail)."""
    return os.environ.get("COMMUNICATION_INTELLIGENCE_AUTO_ON_INGEST", "false").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def ci_provider() -> str:
    return os.environ.get("COMMUNICATION_INTELLIGENCE_PROVIDER", "mock").strip().lower()


def ci_model() -> str:
    return os.environ.get(
        "COMMUNICATION_INTELLIGENCE_MODEL",
        os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
    ).strip()


def ci_timeout_seconds() -> float:
    try:
        return max(5.0, float(os.environ.get("COMMUNICATION_INTELLIGENCE_TIMEOUT", "30")))
    except ValueError:
        return 30.0


def ci_max_chars() -> int:
    try:
        return max(200, min(8000, int(os.environ.get("COMMUNICATION_INTELLIGENCE_MAX_CHARS", "2500"))))
    except ValueError:
        return 2500


def ci_daily_limit() -> int:
    """Technical daily cap per user (not billing)."""
    try:
        return max(1, int(os.environ.get("COMMUNICATION_INTELLIGENCE_DAILY_LIMIT", "40")))
    except ValueError:
        return 40
