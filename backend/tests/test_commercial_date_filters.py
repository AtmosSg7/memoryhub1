"""Documents list from/to filters aligned with analytics KPI date rules."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from tests.conftest import create_client_record, login_user, register_user


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def test_quote_list_from_to_filters_by_quote_date(client):
    email, password = register_user(client, suffix=_uid("df-q"))
    login_user(client, email, password)
    c = create_client_record(client, "Filtre Devis")

    old = (datetime.now(timezone.utc) - timedelta(days=40)).date().isoformat()
    recent = datetime.now(timezone.utc).date().isoformat()

    res_old = client.post(
        "/api/quotes",
        json={
            "clientId": c["id"],
            "title": "Ancien",
            "amountHT": 10000,
            "vatRate": 20,
            "status": "accepted",
            "quoteDate": old,
        },
    )
    assert res_old.status_code in (200, 201)
    res_new = client.post(
        "/api/quotes",
        json={
            "clientId": c["id"],
            "title": "Récent",
            "amountHT": 20000,
            "vatRate": 20,
            "status": "accepted",
            "quoteDate": recent,
        },
    )
    assert res_new.status_code in (200, 201)

    from_d = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()
    to_d = datetime.now(timezone.utc).date().isoformat()
    listed = client.get(
        f"/api/quotes?status=accepted&from={from_d}&to={to_d}&timezone=Europe/Paris"
    )
    assert listed.status_code == 200, listed.text
    body = listed.json()
    titles = {item["title"] for item in body["items"]}
    assert "Récent" in titles
    assert "Ancien" not in titles
    assert body["total"] >= 1


def test_invoice_paid_filter_uses_paid_date(client):
    from zoneinfo import ZoneInfo

    email, password = register_user(client, suffix=_uid("df-i"))
    login_user(client, email, password)
    c = create_client_record(client, "Filtre Facture")

    inv = client.post(
        "/api/invoices",
        json={
            "clientId": c["id"],
            "title": "Payée récemment",
            "amountHT": 10000,
            "vatRate": 20,
            "status": "in_progress",
        },
    ).json()
    pay = client.post(
        f"/api/invoices/{inv['id']}/payments",
        json={"amount": inv["amountTTC"], "method": "transfer"},
    )
    assert pay.status_code in (200, 201)

    # from/to are calendar days in Europe/Paris (same as analytics), not UTC dates.
    today_paris = datetime.now(timezone.utc).astimezone(ZoneInfo("Europe/Paris")).date()
    from_d = (today_paris - timedelta(days=3)).isoformat()
    to_d = today_paris.isoformat()
    listed = client.get(
        f"/api/invoices?status=paid&from={from_d}&to={to_d}&timezone=Europe/Paris"
    )
    assert listed.status_code == 200, listed.text
    ids = {item["id"] for item in listed.json()["items"]}
    assert inv["id"] in ids


def test_invalid_date_params_ignored_and_inverted_rejected(client):
    email, password = register_user(client, suffix=_uid("df-bad"))
    login_user(client, email, password)
    create_client_record(client, "Client")

    ignored = client.get("/api/quotes?from=not-a-date&to=2026-07-01")
    assert ignored.status_code == 200

    inverted = client.get("/api/quotes?from=2026-07-31&to=2026-07-01")
    assert inverted.status_code == 422


def test_list_isolation_user_id(client):
    email_a, password_a = register_user(client, suffix=_uid("df-iso-a"))
    email_b, password_b = register_user(client, suffix=_uid("df-iso-b"))
    login_user(client, email_a, password_a)
    c = create_client_record(client, "Privé")
    client.post(
        "/api/quotes",
        json={
            "clientId": c["id"],
            "title": "Secret",
            "amountHT": 1000,
            "vatRate": 20,
            "status": "draft",
        },
    )

    login_user(client, email_b, password_b)
    listed = client.get("/api/quotes")
    assert listed.status_code == 200
    titles = {item["title"] for item in listed.json()["items"]}
    assert "Secret" not in titles
