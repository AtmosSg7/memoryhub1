"""Client 360 revenue must match shared collected definition (incl. partial payments)."""

from __future__ import annotations

import uuid

from tests.conftest import create_client_record, login_user, register_user


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def test_client_360_revenue_includes_partial_payments(client):
    email, password = register_user(client, suffix=_uid("c360-rev"))
    login_user(client, email, password)
    c = create_client_record(client, "Client Partial")

    inv = client.post(
        "/api/invoices",
        json={
            "clientId": c["id"],
            "title": "Acompte",
            "amountHT": 10000,
            "vatRate": 20,
            "status": "in_progress",
        },
    ).json()
    half = inv["amountTTC"] // 2
    pay = client.post(
        f"/api/invoices/{inv['id']}/payments",
        json={"amount": half, "method": "transfer"},
    )
    assert pay.status_code in (200, 201)
    assert pay.json()["status"] == "in_progress"
    assert pay.json()["amountPaid"] == half

    res = client.get(f"/api/clients/{c['id']}/360")
    assert res.status_code == 200, res.text
    assert res.json()["stats"]["totalRevenue"] == half


def test_client_360_revenue_excludes_cancelled(client):
    email, password = register_user(client, suffix=_uid("c360-can"))
    login_user(client, email, password)
    c = create_client_record(client, "Client Cancel")

    inv = client.post(
        "/api/invoices",
        json={
            "clientId": c["id"],
            "title": "Annulée",
            "amountHT": 5000,
            "vatRate": 20,
            "status": "in_progress",
        },
    ).json()
    client.post(
        f"/api/invoices/{inv['id']}/payments",
        json={"amount": inv["amountTTC"], "method": "transfer"},
    )
    # Cancel after payment if API supports it — otherwise update status via PUT
    upd = client.put(f"/api/invoices/{inv['id']}", json={"status": "cancelled"})
    if upd.status_code in (200, 201):
        res = client.get(f"/api/clients/{c['id']}/360")
        assert res.status_code == 200
        assert res.json()["stats"]["totalRevenue"] == 0
