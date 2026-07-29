"""Backend tests for CRM analytics overview."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from analytics.cache import clear_all_for_tests
from analytics.periods import resolve_period
from tests.conftest import create_client_record, login_user, register_user


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def test_resolve_period_custom_and_comparison():
    now = datetime(2026, 7, 28, 12, 0, tzinfo=timezone.utc)
    window = resolve_period("30d", timezone_name="Europe/Paris", now=now)
    assert window.key == "30d"
    assert window.granularity == "day"
    assert (window.end - window.start).days == 30
    assert (window.comparison_end - window.comparison_start).days == 30

    custom = resolve_period(
        "custom",
        from_date="2026-01-01",
        to_date="2026-01-31",
        timezone_name="Europe/Paris",
        now=now,
    )
    assert custom.label_start == "2026-01-01"
    assert custom.label_end == "2026-01-31"
    assert custom.granularity == "day"


def test_analytics_overview_isolation_and_empty(client):
    clear_all_for_tests()
    email_a, password_a = register_user(client, suffix=_uid("an-a"))
    email_b, password_b = register_user(client, suffix=_uid("an-b"))

    login_user(client, email_a, password_a)
    c = create_client_record(client, "Alpha")
    res = client.post(
        "/api/quotes",
        json={
            "clientId": c["id"],
            "title": "Devis A",
            "amountHT": 10000,
            "vatRate": 20,
            "status": "accepted",
        },
    )
    assert res.status_code in (200, 201)

    overview_a = client.get("/api/analytics/overview?period=30d&timezone=Europe/Paris")
    assert overview_a.status_code == 200, overview_a.text
    data_a = overview_a.json()
    assert data_a["kpis"]["quotesCreated"]["value"] >= 1
    assert data_a["empty"] is False

    login_user(client, email_b, password_b)
    overview_b = client.get("/api/analytics/overview?period=30d")
    assert overview_b.status_code == 200
    data_b = overview_b.json()
    assert data_b["kpis"]["quotesCreated"]["value"] == 0
    assert data_b["empty"] is True


def test_analytics_collected_billed_acceptance_and_filters(client):
    clear_all_for_tests()
    email, password = register_user(client, suffix=_uid("an-kpi"))
    login_user(client, email, password)
    c = create_client_record(client, "Beta SARL")

    quote_acc = client.post(
        "/api/quotes",
        json={
            "clientId": c["id"],
            "title": "Accepté",
            "amountHT": 10000,
            "vatRate": 20,
            "status": "accepted",
        },
    ).json()
    client.post(
        "/api/quotes",
        json={
            "clientId": c["id"],
            "title": "Refusé",
            "amountHT": 5000,
            "vatRate": 20,
            "status": "rejected",
        },
    )
    inv = client.post(
        "/api/invoices",
        json={
            "clientId": c["id"],
            "title": "Facture",
            "amountHT": 10000,
            "vatRate": 20,
            "status": "in_progress",
        },
    ).json()

    paid = client.post(f"/api/invoices/{inv['id']}/mark-paid")
    assert paid.status_code == 200, paid.text

    res = client.get("/api/analytics/overview?period=30d&timezone=Europe/Paris")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["kpis"]["billedRevenue"]["value"] > 0
    assert data["kpis"]["collectedRevenue"]["value"] > 0
    assert data["kpis"]["paidInvoices"]["value"] >= 1
    assert data["quotePipeline"]["accepted"] >= 1
    assert data["quotePipeline"]["rejected"] >= 1
    # acceptance = accepted / (accepted+rejected+expired)
    assert data["kpis"]["quoteAcceptanceRate"]["value"] is not None
    assert 0 < data["kpis"]["quoteAcceptanceRate"]["value"] <= 1
    assert len(data["financialSeries"]) > 0
    assert len(data["topClients"]) >= 1
    assert data["topClients"][0]["clientId"] == c["id"]
    assert quote_acc["id"]


def test_analytics_invalid_period_and_custom(client):
    clear_all_for_tests()
    email, password = register_user(client, suffix=_uid("an-val"))
    login_user(client, email, password)

    bad = client.get("/api/analytics/overview?period=nope")
    assert bad.status_code == 400

    missing = client.get("/api/analytics/overview?period=custom")
    assert missing.status_code == 400

    ok = client.get(
        "/api/analytics/overview?period=custom&from=2026-01-01&to=2026-03-31&timezone=Europe/Paris"
    )
    assert ok.status_code == 200
    body = ok.json()
    assert body["period"]["key"] == "custom"
    assert body["period"]["fromDate"] == "2026-01-01"
    assert body["period"]["toDate"] == "2026-03-31"


def test_analytics_cache_invalidation_on_invoice_pay(client):
    clear_all_for_tests()
    email, password = register_user(client, suffix=_uid("an-cache"))
    login_user(client, email, password)
    c = create_client_record(client, "Cache Client")
    inv = client.post(
        "/api/invoices",
        json={
            "clientId": c["id"],
            "title": "Cache inv",
            "amountHT": 8000,
            "vatRate": 20,
            "status": "in_progress",
        },
    ).json()

    first = client.get("/api/analytics/overview?period=30d").json()
    assert first["fromCache"] is False
    second = client.get("/api/analytics/overview?period=30d").json()
    assert second["fromCache"] is True

    client.post(f"/api/invoices/{inv['id']}/mark-paid")
    third = client.get("/api/analytics/overview?period=30d").json()
    assert third["fromCache"] is False
    assert third["kpis"]["collectedRevenue"]["value"] > first["kpis"]["collectedRevenue"]["value"]


def test_change_percent_zero_previous_is_null():
    from analytics.aggregations import change_percent

    assert change_percent(100, 0) is None
    assert change_percent(0, 0) is None
    assert change_percent(150, 100) == 50.0


def test_dashboard_and_analytics_collected_aligned(client):
    """Dashboard home KPIs and analytics overview share collected definition."""
    clear_all_for_tests()
    email, password = register_user(client, suffix=_uid("an-align"))
    login_user(client, email, password)
    c = create_client_record(client, "Align Co")
    inv = client.post(
        "/api/invoices",
        json={
            "clientId": c["id"],
            "title": "Align inv",
            "amountHT": 12500,
            "vatRate": 20,
            "status": "in_progress",
        },
    ).json()
    client.post(f"/api/invoices/{inv['id']}/mark-paid")

    analytics = client.get("/api/analytics/overview?period=30d&timezone=Europe/Paris").json()
    dashboard = client.get("/api/dashboard/stats").json()

    assert analytics["kpis"]["collectedRevenue"]["value"] == inv["amountTTC"]
    assert dashboard["kpis"]["monthlyRevenue"]["total"] == inv["amountTTC"]
    assert analytics["invoicePipeline"]["paid"] >= 1
    assert dashboard["kpis"]["unpaidInvoices"] == 0
