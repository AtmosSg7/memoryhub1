"""Commercial lifecycle workflow tests."""

import os
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient

from commercial_lifecycle import (
    derive_invoice_display_status,
    derive_quote_display_status,
    expire_stale_quotes,
)
from tests.conftest import create_client_record, create_quote_record, register_user


def test_quote_display_status_lifecycle():
    assert derive_quote_display_status({"status": "draft"}) == "draft"
    assert derive_quote_display_status({"status": "sent", "sentAt": "2026-01-01"}) == "sent"
    assert (
        derive_quote_display_status(
            {"status": "sent", "portalFirstViewedAt": "2026-01-02"}
        )
        == "viewed"
    )
    assert derive_quote_display_status({"status": "accepted"}) == "accepted"
    assert derive_quote_display_status({"status": "accepted", "invoiceId": "inv-1"}) == "converted"
    assert derive_quote_display_status({"status": "sent", "isArchived": True}) == "archived"


def test_invoice_display_status_lifecycle():
    assert derive_invoice_display_status({"status": "in_progress"}) == "issued"
    assert (
        derive_invoice_display_status(
            {"status": "in_progress", "portalFirstViewedAt": "2026-01-01"}
        )
        == "viewed"
    )
    assert (
        derive_invoice_display_status(
            {"status": "in_progress", "amountTTC": 10000, "amountPaid": 5000, "payments": [{"amount": 5000}]}
        )
        == "partial"
    )
    assert (
        derive_invoice_display_status(
            {"status": "paid", "amountTTC": 10000, "amountPaid": 10000, "payments": [{"amount": 10000}]}
        )
        == "paid"
    )
    assert derive_invoice_display_status({"status": "cancelled"}) == "cancelled"
    assert derive_invoice_display_status({"status": "overdue"}) == "overdue"
    assert derive_invoice_display_status({"status": "paid", "isArchived": True}) == "archived"


def test_portal_view_records_timeline_event(client):
    register_user(client)
    owned = create_client_record(client)
    quote = create_quote_record(client, owned["id"])
    portal = client.post(f"/api/clients/{owned['id']}/portal")
    token = portal.json()["token"]

    overview = client.get(f"/api/portal/{token}")
    assert overview.status_code == 200

    before = client.get(f"/api/quotes/{quote['id']}")
    assert before.status_code == 200
    assert not before.json().get("portalFirstViewedAt")

    pdf = client.get(f"/api/portal/{token}/quotes/{quote['id']}/pdf")
    assert pdf.status_code == 200

    updated = client.get(f"/api/quotes/{quote['id']}")
    assert updated.status_code == 200
    body = updated.json()
    assert body["portalFirstViewedAt"]
    assert body["displayStatus"] == "viewed"

    mongo = MongoClient(os.environ["MONGO_URL"])
    event = mongo[os.environ["DB_NAME"]].events.find_one(
        {"entityId": quote["id"], "type": "quote_viewed"}
    )
    assert event is not None


def test_quote_sent_on_manual_status_change(client):
    register_user(client)
    owned = create_client_record(client)
    created = client.post(
        "/api/quotes",
        json={"clientId": owned["id"], "title": "Draft", "amountHT": 10000, "vatRate": 20, "status": "draft"},
    )
    quote_id = created.json()["id"]
    sent = client.put(f"/api/quotes/{quote_id}", json={"status": "sent"})
    assert sent.status_code == 200
    assert sent.json()["sentAt"]
    assert sent.json()["displayStatus"] == "sent"

    mongo = MongoClient(os.environ["MONGO_URL"])
    event = mongo[os.environ["DB_NAME"]].events.find_one(
        {"entityId": quote_id, "type": "quote_sent"}
    )
    assert event is not None


def test_archive_quote_and_invoice(client):
    register_user(client)
    owned = create_client_record(client)
    quote = create_quote_record(client, owned["id"])
    client.put(f"/api/quotes/{quote['id']}", json={"status": "accepted"})

    convert = client.post(f"/api/quotes/{quote['id']}/convert-to-invoice")
    invoice_id = convert.json()["id"]

    archive_quote = client.post(f"/api/quotes/{quote['id']}/archive")
    assert archive_quote.status_code == 200
    assert archive_quote.json()["isArchived"] is True
    assert archive_quote.json()["displayStatus"] == "archived"

    payment = client.post(
        f"/api/invoices/{invoice_id}/payments",
        json={"amount": convert.json()["amountTTC"], "method": "transfer"},
    )
    assert payment.status_code in (200, 201)

    archive_invoice = client.post(f"/api/invoices/{invoice_id}/archive")
    assert archive_invoice.status_code == 200
    assert archive_invoice.json()["isArchived"] is True
    assert archive_invoice.json()["displayStatus"] == "archived"


def test_expire_stale_quotes(client):
    import asyncio

    from motor.motor_asyncio import AsyncIOMotorClient

    register_user(client)
    owned = create_client_record(client)
    quote = create_quote_record(client, owned["id"])

    mongo = MongoClient(os.environ["MONGO_URL"])
    old_date = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    mongo[os.environ["DB_NAME"]].quotes.update_one(
        {"id": quote["id"]},
        {"$set": {"quoteDate": old_date, "status": "sent"}},
    )

    async def _run():
        motor = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = motor[os.environ["DB_NAME"]]
        try:
            return await expire_stale_quotes(db)
        finally:
            motor.close()

    expired = asyncio.get_event_loop().run_until_complete(_run())
    assert expired >= 1

    doc = mongo[os.environ["DB_NAME"]].quotes.find_one({"id": quote["id"]})
    assert doc["status"] == "expired"

    event = mongo[os.environ["DB_NAME"]].events.find_one(
        {"entityId": quote["id"], "type": "quote_expired"}
    )
    assert event is not None


def test_archived_quotes_hidden_from_list(client):
    register_user(client)
    owned = create_client_record(client)
    quote = create_quote_record(client, owned["id"])
    client.post(f"/api/quotes/{quote['id']}/archive")

    listed = client.get("/api/quotes")
    ids = [item["id"] for item in listed.json()["items"]]
    assert quote["id"] not in ids
