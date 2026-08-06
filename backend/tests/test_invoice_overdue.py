"""Automatic overdue invoice status engine tests."""

import asyncio
import os
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient

from commercial_lifecycle import is_invoice_past_due, sync_overdue_invoices
from commercial_lifecycle_constants import INVOICE_PAYMENT_DAYS
from tests.conftest import create_client_record, register_user


_LOOP = None


def _loop():
    global _LOOP
    if _LOOP is None or _LOOP.is_closed():
        _LOOP = asyncio.new_event_loop()
        asyncio.set_event_loop(_LOOP)
    return _LOOP


def _run_sync(db):
    return _loop().run_until_complete(sync_overdue_invoices(db))


def _motor_db():
    _loop()
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client, client[os.environ["DB_NAME"]]


def _mongo_collection():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


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


def _past_due_date():
    return (datetime.now(timezone.utc) - timedelta(days=INVOICE_PAYMENT_DAYS + 2)).isoformat()


def _recent_date():
    return datetime.now(timezone.utc).isoformat()


def test_invoice_becomes_overdue(client):
    register_user(client)
    owned = create_client_record(client)
    invoice = _create_invoice(client, owned["id"], invoice_date=_past_due_date())

    motor, db = _motor_db()
    try:
        marked = _run_sync(db)
    finally:
        motor.close()

    assert marked >= 1

    mongo = _mongo_collection()
    doc = mongo.invoices.find_one({"id": invoice["id"]})
    assert doc["status"] == "overdue"
    assert doc.get("overdueAt")

    updated = client.get(f"/api/invoices/{invoice['id']}")
    assert updated.status_code == 200
    assert updated.json()["status"] == "overdue"
    assert updated.json()["displayStatus"] == "overdue"

    event = mongo.events.find_one({"entityId": invoice["id"], "type": "invoice_overdue"})
    assert event is not None
    assert invoice["number"] in (event.get("metadata") or {}).get("message", "")


def test_invoice_paid_before_due_stays_in_progress(client):
    register_user(client)
    owned = create_client_record(client)
    invoice = _create_invoice(client, owned["id"], invoice_date=_recent_date())

    motor, db = _motor_db()
    try:
        marked = _run_sync(db)
    finally:
        motor.close()

    mongo = _mongo_collection()
    doc = mongo.invoices.find_one({"id": invoice["id"]})
    assert doc["status"] == "in_progress"
    assert not doc.get("overdueAt")

    event = mongo.events.find_one({"entityId": invoice["id"], "type": "invoice_overdue"})
    assert event is None


def test_invoice_paid_after_due_becomes_paid(client):
    register_user(client)
    owned = create_client_record(client)
    invoice = _create_invoice(client, owned["id"], invoice_date=_past_due_date())

    motor, db = _motor_db()
    try:
        _run_sync(db)
    finally:
        motor.close()

    mongo = _mongo_collection()
    assert mongo.invoices.find_one({"id": invoice["id"]})["status"] == "overdue"

    payment = client.post(
        f"/api/invoices/{invoice['id']}/payments",
        json={"amount": invoice["amountTTC"], "method": "transfer"},
    )
    assert payment.status_code in (200, 201)
    body = payment.json()
    assert body["status"] == "paid"
    assert body["displayStatus"] == "paid"

    doc = mongo.invoices.find_one({"id": invoice["id"]})
    assert doc["status"] == "paid"


def test_already_paid_invoice_not_marked_overdue(client):
    register_user(client)
    owned = create_client_record(client)
    invoice = _create_invoice(client, owned["id"], invoice_date=_past_due_date())

    paid = client.post(f"/api/invoices/{invoice['id']}/mark-paid")
    assert paid.status_code == 200
    assert paid.json()["status"] == "paid"

    motor, db = _motor_db()
    try:
        _run_sync(db)
    finally:
        motor.close()

    mongo = _mongo_collection()
    doc = mongo.invoices.find_one({"id": invoice["id"]})
    assert doc["status"] == "paid"

    event = mongo.events.find_one({"entityId": invoice["id"], "type": "invoice_overdue"})
    assert event is None


def test_sync_overdue_invoices_idempotent(client):
    register_user(client)
    owned = create_client_record(client)
    invoice = _create_invoice(client, owned["id"], invoice_date=_past_due_date())

    motor, db = _motor_db()
    try:
        first = _loop().run_until_complete(sync_overdue_invoices(db))
        second = _loop().run_until_complete(sync_overdue_invoices(db))
    finally:
        motor.close()

    assert first >= 1
    assert second == 0

    mongo = _mongo_collection()
    events = list(mongo.events.find({"entityId": invoice["id"], "type": "invoice_overdue"}))
    assert len(events) == 1


def test_reminders_include_overdue_invoice(client):
    register_user(client)
    owned = create_client_record(client)
    invoice = _create_invoice(client, owned["id"], invoice_date=_past_due_date())

    motor, db = _motor_db()
    try:
        _run_sync(db)
    finally:
        motor.close()

    reminders = client.get("/api/reminders")
    assert reminders.status_code == 200
    types = [item["type"] for item in reminders.json()["items"]]
    assert "invoice_overdue" in types
    overdue_ids = [
        item["id"]
        for item in reminders.json()["items"]
        if item["type"] == "invoice_overdue"
    ]
    assert f"invoice_overdue:{invoice['id']}" in overdue_ids


def test_is_invoice_past_due_boundary():
    invoice_date = datetime(2026, 1, 1, tzinfo=timezone.utc)
    doc = {"invoiceDate": invoice_date.isoformat(), "amountTTC": 10000}

    due_day = invoice_date + timedelta(days=INVOICE_PAYMENT_DAYS)
    assert is_invoice_past_due(doc, now=due_day) is False

    day_after = due_day + timedelta(days=1)
    assert is_invoice_past_due(doc, now=day_after) is True


def test_dashboard_unpaid_invoices_counts_overdue(client):
    register_user(client)
    owned = create_client_record(client)
    _create_invoice(client, owned["id"], invoice_date=_past_due_date())

    motor, db = _motor_db()
    try:
        _run_sync(db)
    finally:
        motor.close()

    stats = client.get("/api/dashboard/stats")
    assert stats.status_code == 200
    assert stats.json()["kpis"]["unpaidInvoices"] >= 1

    overdue_list = client.get("/api/invoices?status=overdue")
    assert overdue_list.status_code == 200
    assert overdue_list.json()["total"] >= 1
