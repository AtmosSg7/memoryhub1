"""Tests for scheduled and automatic transactional email triggers."""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient

from commercial_lifecycle import sync_overdue_invoices
from commercial_lifecycle_constants import INVOICE_DUE_SOON_DAYS, INVOICE_PAYMENT_DAYS
from fake_email_provider import FakeEmailProvider
from scheduled_email_service import run_scheduled_invoice_emails
from tests.conftest import create_client_record, create_quote_record, register_user

DECISION_BODY = {"signerName": "Jean Dupont", "comment": "Trop cher."}


def _motor_db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client, client[os.environ["DB_NAME"]]


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _portal_setup(client):
    email, _ = register_user(client)
    owned_client = create_client_record(client, name="Portal Client")
    quote = create_quote_record(client, owned_client["id"])
    portal = client.post(f"/api/clients/{owned_client['id']}/portal")
    assert portal.status_code in (200, 201)
    token = portal.json()["token"]
    return token, quote, owned_client, email


def _run(db, coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _create_invoice(client, client_id, *, invoice_date=None, status="in_progress"):
    payload = {
        "clientId": client_id,
        "title": "Facture test",
        "amountHT": 10000,
        "vatRate": 20,
        "status": status,
    }
    if invoice_date:
        payload["invoiceDate"] = invoice_date
    res = client.post("/api/invoices", json=payload)
    assert res.status_code == 201, res.text
    return res.json()


def test_portal_reject_sends_artisan_email(client):
    token, quote, _, artisan_email = _portal_setup(client)
    reject = client.post(
        f"/api/portal/{token}/quotes/{quote['id']}/reject",
        json=DECISION_BODY,
    )
    assert reject.status_code == 200

    provider = FakeEmailProvider.instance()
    artisan_messages = [msg for msg in provider.sent if msg.to == artisan_email]
    assert artisan_messages
    assert any("refusé" in msg.subject.lower() or "declined" in msg.subject.lower() for msg in artisan_messages)

    mongo = _mongo()
    event = mongo.email_events.find_one({"idempotencyKey": f"quote-rejected:{quote['id']}"})
    assert event is not None
    assert event["templateKey"] == "quote_rejected"


def test_dashboard_accept_sends_artisan_email(client):
    artisan_email, _ = register_user(client)
    owned = create_client_record(client)
    quote = create_quote_record(client, owned["id"])

    res = client.put(
        f"/api/quotes/{quote['id']}",
        json={"status": "accepted"},
    )
    assert res.status_code == 200

    provider = FakeEmailProvider.instance()
    artisan_messages = [msg for msg in provider.sent if msg.to == artisan_email]
    assert any("accepté" in msg.subject.lower() or "accepted" in msg.subject.lower() for msg in artisan_messages)

    mongo = _mongo()
    assert mongo.email_events.count_documents({"idempotencyKey": f"quote-accepted:{quote['id']}"}) == 1


def test_quote_decision_email_idempotent(client):
    token, quote, _, artisan_email = _portal_setup(client)
    accept = client.post(
        f"/api/portal/{token}/quotes/{quote['id']}/accept",
        json=DECISION_BODY,
    )
    assert accept.status_code == 200

    provider = FakeEmailProvider.instance()
    accepted_count = len([msg for msg in provider.sent if msg.to == artisan_email and "accept" in msg.subject.lower()])
    assert accepted_count == 1

    res = client.put(f"/api/quotes/{quote['id']}", json={"title": "Updated title"})
    assert res.status_code == 200

    provider = FakeEmailProvider.instance()
    accepted_count_after = len(
        [msg for msg in provider.sent if msg.to == artisan_email and "accept" in msg.subject.lower()]
    )
    assert accepted_count_after == 1


def test_scheduled_overdue_invoice_email(client):
    artisan_email, _ = register_user(client)
    user_id = _mongo().users.find_one({"email": artisan_email})["id"]
    owned = create_client_record(client)
    client.put(
        f"/api/clients/{owned['id']}",
        json={"email": "client-overdue@example.com"},
    )
    past_due = (datetime.now(timezone.utc) - timedelta(days=INVOICE_PAYMENT_DAYS + 2)).isoformat()
    invoice = _create_invoice(client, owned["id"], invoice_date=past_due)

    motor, db = _motor_db()
    try:
        _run(db, sync_overdue_invoices(db, user_id=user_id))
        result = _run(db, run_scheduled_invoice_emails(db, user_id=user_id))
    finally:
        motor.close()

    assert result["invoice_overdue"] >= 1

    provider = FakeEmailProvider.instance()
    client_messages = [msg for msg in provider.sent if msg.to == "client-overdue@example.com"]
    assert client_messages

    mongo = _mongo()
    assert mongo.email_events.find_one({"idempotencyKey": f"invoice-overdue:{invoice['id']}"})


def test_scheduled_due_soon_invoice_email(client):
    artisan_email, _ = register_user(client)
    user_id = _mongo().users.find_one({"email": artisan_email})["id"]
    owned = create_client_record(client)
    client.put(
        f"/api/clients/{owned['id']}",
        json={"email": "client-due-soon@example.com"},
    )
    days_before_due = max(1, INVOICE_DUE_SOON_DAYS - 1)
    invoice_date = (
        datetime.now(timezone.utc)
        - timedelta(days=INVOICE_PAYMENT_DAYS - days_before_due)
    ).isoformat()
    invoice = _create_invoice(client, owned["id"], invoice_date=invoice_date)

    motor, db = _motor_db()
    try:
        result = _run(db, run_scheduled_invoice_emails(db, user_id=user_id))
        duplicate = _run(db, run_scheduled_invoice_emails(db, user_id=user_id))
    finally:
        motor.close()

    assert result["invoice_due_soon"] >= 1

    provider = FakeEmailProvider.instance()
    client_messages = [msg for msg in provider.sent if msg.to == "client-due-soon@example.com"]
    assert client_messages

    mongo = _mongo()
    assert mongo.email_events.count_documents({"idempotencyKey": f"invoice-due-soon:{invoice['id']}"}) == 1
    assert duplicate["invoice_due_soon"] == 0
