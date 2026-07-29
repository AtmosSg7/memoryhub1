"""Release Candidate — end-to-end API critical paths."""

import io
import os
import uuid

import pytest
from pymongo import MongoClient

from admin_constants import USER_ROLE_ADMIN
from tests.conftest import create_client_record, create_quote_record, login_user, register_user


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def test_double_quote_conversion_rejected(client):
    register_user(client, suffix=uuid.uuid4().hex)
    owned_client = create_client_record(client)
    quote = create_quote_record(client, owned_client["id"])

    client.put(f"/api/quotes/{quote['id']}", json={"status": "accepted"})
    first = client.post(f"/api/quotes/{quote['id']}/convert-to-invoice")
    assert first.status_code == 201

    second = client.post(f"/api/quotes/{quote['id']}/convert-to-invoice")
    assert second.status_code == 409


def test_invoice_partial_then_full_payment(client):
    register_user(client, suffix=uuid.uuid4().hex)
    owned_client = create_client_record(client)
    quote = create_quote_record(client, owned_client["id"])
    client.put(f"/api/quotes/{quote['id']}", json={"status": "accepted"})
    invoice = client.post(f"/api/quotes/{quote['id']}/convert-to-invoice").json()

    partial = client.post(
        f"/api/invoices/{invoice['id']}/payments",
        json={"amount": 5000, "method": "transfer"},
    )
    assert partial.status_code in (200, 201)
    body = partial.json()
    assert body["status"] == "in_progress"
    assert body["amountPaid"] == 5000

    remainder = body["amountTTC"] - 5000
    full = client.post(
        f"/api/invoices/{invoice['id']}/payments",
        json={"amount": remainder, "method": "transfer"},
    )
    assert full.status_code in (200, 201)
    assert full.json()["status"] == "paid"


def test_invoice_overpayment_rejected(client):
    register_user(client, suffix=uuid.uuid4().hex)
    owned_client = create_client_record(client)
    invoice = client.post(
        "/api/invoices",
        json={
            "clientId": owned_client["id"],
            "title": "Facture RC",
            "amountHT": 10000,
            "vatRate": 20,
            "status": "sent",
        },
    ).json()

    over = client.post(
        f"/api/invoices/{invoice['id']}/payments",
        json={"amount": invoice["amountTTC"] + 1, "method": "transfer"},
    )
    assert over.status_code in (400, 422)


def test_suspended_account_cannot_login(client):
    email, password = register_user(client, suffix=uuid.uuid4().hex)
    user = _db().users.find_one({"email": email})
    _db().users.update_one({"id": user["id"]}, {"$set": {"accountStatus": "suspended"}})

    client.post("/api/auth/logout")
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 403


def test_verify_email_success(client):
    email, _ = register_user(client, suffix=uuid.uuid4().hex)
    user = _db().users.find_one({"email": email})
    token = user.get("emailVerificationToken")
    if not token:
        pytest.skip("Email verification disabled in test env")

    res = client.post("/api/auth/verify-email", json={"token": token})
    assert res.status_code == 200
    updated = _db().users.find_one({"email": email})
    assert updated.get("emailVerified") is True


def test_import_analyze_confirm_idempotent(client):
    register_user(client, suffix=uuid.uuid4().hex)
    client.post("/api/credits/dev/assign-plan", params={"planId": "solo"})

    pdf_bytes = b"%PDF-1.4 e2e devis import test\n"
    analyze = client.post(
        "/api/imports/analyze",
        files={"file": ("devis-rc.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert analyze.status_code == 201, analyze.text
    session = analyze.json()
    session_id = session["id"]
    normalized = session["analysis"]["normalized"]

    confirm_payload = {
        "targetKind": session["detectedKind"],
        "clientAction": "create_new",
        "clientData": {
            "name": normalized.get("clientName") or "Client Import RC",
            "company": normalized.get("company"),
            "email": normalized.get("email"),
        },
        "fields": normalized,
    }
    first = client.post(f"/api/imports/{session_id}/confirm", json=confirm_payload)
    assert first.status_code == 200

    second = client.post(f"/api/imports/{session_id}/confirm", json=confirm_payload)
    assert second.status_code == 200
    assert second.json()["created"]["entityId"] == first.json()["created"]["entityId"]


def test_standard_user_admin_forbidden(client):
    register_user(client, suffix=uuid.uuid4().hex)
    res = client.get("/api/admin/overview?period=30d")
    assert res.status_code == 403


def test_admin_user_can_access_overview(client):
    email, password = register_user(client, suffix=f"admin-{uuid.uuid4().hex[:8]}")
    _db().users.update_one({"email": email}, {"$set": {"role": USER_ROLE_ADMIN}})
    client.post("/api/auth/logout")
    login_user(client, email, password)

    res = client.get("/api/admin/overview?period=30d")
    assert res.status_code == 200
