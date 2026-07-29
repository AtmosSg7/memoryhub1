"""Commercial document lifecycle thresholds (env-overridable)."""

from __future__ import annotations

import os

QUOTE_VALIDITY_DAYS = max(1, int(os.environ.get("COMMERCIAL_QUOTE_VALIDITY_DAYS", "30")))
QUOTE_NO_RESPONSE_DAYS = max(1, int(os.environ.get("COMMERCIAL_QUOTE_NO_RESPONSE_DAYS", "7")))
QUOTE_VIEWED_NO_RESPONSE_DAYS = max(1, int(os.environ.get("COMMERCIAL_QUOTE_VIEWED_NO_RESPONSE_DAYS", "3")))
QUOTE_FOLLOW_UP_INTERVAL_DAYS = max(1, int(os.environ.get("COMMERCIAL_QUOTE_FOLLOW_UP_INTERVAL_DAYS", "7")))
INVOICE_PAYMENT_DAYS = max(1, int(os.environ.get("COMMERCIAL_INVOICE_PAYMENT_DAYS", "30")))
INVOICE_DUE_SOON_DAYS = max(1, int(os.environ.get("COMMERCIAL_INVOICE_DUE_SOON_DAYS", "7")))
INVOICE_FOLLOW_UP_INTERVAL_DAYS = max(1, int(os.environ.get("COMMERCIAL_INVOICE_FOLLOW_UP_INTERVAL_DAYS", "7")))

MAX_FOLLOW_UP_STAGE = 3
