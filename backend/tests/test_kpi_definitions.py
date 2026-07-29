"""Unit tests for shared KPI definitions and document period filters."""

from datetime import datetime, timezone

import pytest

from kpi_definitions import (
    day_bounds_utc,
    document_list_date_mode,
    normalize_invoice_status,
    quote_accepted_at,
    sum_client_collected_revenue,
)


def test_normalize_invoice_status_legacy():
    assert normalize_invoice_status("draft") == "in_progress"
    assert normalize_invoice_status("sent") == "in_progress"
    assert normalize_invoice_status("paid") == "paid"
    assert normalize_invoice_status(None) == "in_progress"


def test_day_bounds_utc_inclusive_end_of_day_paris():
    start, end = day_bounds_utc("2026-07-01", "2026-07-31", timezone_name="Europe/Paris")
    assert start == datetime(2026, 6, 30, 22, 0, tzinfo=timezone.utc)
    assert end == datetime(2026, 7, 31, 22, 0, tzinfo=timezone.utc)


def test_day_bounds_rejects_inverted_range():
    with pytest.raises(ValueError, match="invalid_range"):
        day_bounds_utc("2026-07-31", "2026-07-01", timezone_name="Europe/Paris")


def test_document_list_date_mode_paid_uses_paid_date():
    assert document_list_date_mode(kind="invoice", status="paid") == "paid"
    assert document_list_date_mode(kind="invoice", status="in_progress") == "event"
    assert document_list_date_mode(kind="quote", status="accepted") == "event"


def test_sum_client_collected_includes_partial_progress():
    invoices = [
        {"status": "in_progress", "amountTTC": 10000, "amountPaid": 4000},
        {"status": "paid", "amountTTC": 20000, "amountPaid": 20000},
        {"status": "cancelled", "amountTTC": 5000, "amountPaid": 5000},
    ]
    assert sum_client_collected_revenue(invoices) == 24000


def test_quote_accepted_at_prefers_portal_field():
    dt = quote_accepted_at(
        {
            "portalAcceptedAt": "2026-07-10T10:00:00+00:00",
            "updatedAt": "2026-07-11T10:00:00+00:00",
        }
    )
    assert dt is not None
    assert dt.day == 10
