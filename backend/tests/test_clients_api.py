"""API tests for Client-centric model (backward compatible)."""

import io
import os
import uuid
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient

from tests.conftest import create_client_record, create_quote_record, login_user, register_user


def test_create_client_returns_nested_contacts_and_flat_scalars(client):
    email, password = register_user(client, suffix=f"cmc-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)

    res = client.post(
        "/api/clients",
        json={
            "name": "Jean Artisan",
            "email": "jean@example.com",
            "phone": "0601020304",
            "address": "10 rue du Port",
            "city": "Bordeaux",
            "company": "Artisan Jean",
            "tags": ["plomberie", "fidèle"],
            "isFavorite": True,
            "status": "active",
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["email"] == "jean@example.com"
    assert body["phone"] == "0601020304"
    assert body["isFavorite"] is True
    assert body["tags"] == ["plomberie", "fidèle"]
    assert len(body["emails"]) == 1
    assert body["emails"][0]["value"] == "jean@example.com"
    assert body["emails"][0]["isPrimary"] is True
    assert body["phones"][0]["value"] == "0601020304"
    assert body["addresses"][0]["city"] == "Bordeaux"
    assert body["companyInfo"]["tradeName"] == "Artisan Jean"
    assert body["schemaVersion"] >= 2


def test_legacy_client_without_nested_fields_still_readable(client):
    """Simulate pre-v2 Mongo doc: no emails/phones arrays."""
    email, password = register_user(client, suffix=f"cml-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)
    created = create_client_record(client, name="Legacy Client")

    mongo = MongoClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]
    db.clients.update_one(
        {"id": created["id"]},
        {
            "$unset": {
                "emails": "",
                "phones": "",
                "addresses": "",
                "tags": "",
                "isFavorite": "",
                "companyInfo": "",
                "integrations": "",
                "schemaVersion": "",
            },
            "$set": {
                "email": "legacy@example.com",
                "phone": "0699999999",
                "address": "1 rue legacy",
                "city": "Lille",
            },
        },
    )

    res = client.get(f"/api/clients/{created['id']}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["email"] == "legacy@example.com"
    assert body["phone"] == "0699999999"
    assert len(body["emails"]) == 1
    assert body["emails"][0]["value"] == "legacy@example.com"
    assert body["isFavorite"] is False
    assert body["tags"] == []


def test_update_email_keeps_nested_primary_in_sync(client):
    email, password = register_user(client, suffix=f"cmu-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)
    created = create_client_record(client, name="Sync Client")

    res = client.put(
        f"/api/clients/{created['id']}",
        json={"email": "sync@example.com", "isFavorite": True, "tags": ["prioritaire"]},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["email"] == "sync@example.com"
    assert body["emails"][0]["value"] == "sync@example.com"
    assert body["isFavorite"] is True
    assert body["tags"] == ["prioritaire"]


def test_list_clients_documents_count_includes_quote_invoice_and_file(client):
    email, password = register_user(client, suffix=f"cld-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)
    created = create_client_record(client, name="Docs Client")
    create_quote_record(client, created["id"])

    inv_res = client.post(
        "/api/invoices",
        json={
            "clientId": created["id"],
            "title": "Facture test",
            "amountHT": 10000,
            "vatRate": 20,
            "status": "paid",
        },
    )
    assert inv_res.status_code in (200, 201), inv_res.text

    upload = client.post(
        "/api/documents/upload",
        data={"clientId": created["id"]},
        files={"file": ("plan.pdf", io.BytesIO(b"%PDF-1.4 linked file"), "application/pdf")},
    )
    assert upload.status_code in (200, 201), upload.text

    note_res = client.post(
        "/api/notes",
        json={"clientId": created["id"], "content": "Appel de suivi"},
    )
    assert note_res.status_code in (200, 201), note_res.text

    res = client.get("/api/clients")
    assert res.status_code == 200, res.text
    item = next(c for c in res.json()["items"] if c["id"] == created["id"])
    assert item["documentsCount"] == 3  # quote + invoice + uploaded file
    assert item["notesCount"] >= 1
    assert item["totalRevenue"] >= int(inv_res.json().get("amountTTC") or 0)
    assert item.get("lastActivityAt")


def test_list_clients_last_activity_uses_most_recent_resource(client):
    email, password = register_user(client, suffix=f"cla-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)
    created = create_client_record(client, name="Activity Client")

    mongo = MongoClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]
    old = (datetime.now(timezone.utc) - timedelta(days=120)).isoformat()
    recent = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()

    db.clients.update_one(
        {"id": created["id"]},
        {"$set": {"updatedAt": old, "createdAt": old}},
    )
    create_quote_record(client, created["id"])
    # Force note to be the newest activity signal
    note_res = client.post(
        "/api/notes",
        json={"clientId": created["id"], "content": "Relance récente"},
    )
    assert note_res.status_code in (200, 201), note_res.text
    db.notes.update_one(
        {"id": note_res.json()["id"]},
        {"$set": {"updatedAt": recent, "createdAt": recent, "noteDate": recent[:10]}},
    )
    db.quotes.update_many(
        {"clientId": created["id"]},
        {"$set": {"updatedAt": old, "createdAt": old, "quoteDate": old[:10]}},
    )

    res = client.get("/api/clients")
    assert res.status_code == 200, res.text
    item = next(c for c in res.json()["items"] if c["id"] == created["id"])
    assert item["lastActivityAt"] >= recent[:19]
    assert item["lastActivityAt"] > item["updatedAt"]


def test_list_clients_hydrates_schema_v1_and_keeps_isolation(client):
    suffix_a = f"iso-a-{uuid.uuid4().hex[:8]}"
    suffix_b = f"iso-b-{uuid.uuid4().hex[:8]}"
    email_a, password_a = register_user(client, suffix=suffix_a)
    login_user(client, email_a, password_a)
    owned = create_client_record(client, name="Owner Client")
    create_quote_record(client, owned["id"])

    mongo = MongoClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]
    db.clients.update_one(
        {"id": owned["id"]},
        {
            "$unset": {
                "emails": "",
                "phones": "",
                "addresses": "",
                "tags": "",
                "isFavorite": "",
                "companyInfo": "",
                "integrations": "",
                "schemaVersion": "",
            },
            "$set": {"phone": "0611223344", "email": "owner@example.com"},
        },
    )

    list_a = client.get("/api/clients")
    assert list_a.status_code == 200
    item_a = next(c for c in list_a.json()["items"] if c["id"] == owned["id"])
    assert item_a["documentsCount"] >= 1
    assert item_a["phone"] == "0611223344"
    assert item_a["schemaVersion"] >= 2  # hydrated on read
    assert item_a.get("lastActivityAt")

    client.post("/api/auth/logout")
    register_user(client, suffix=suffix_b)

    list_b = client.get("/api/clients")
    assert list_b.status_code == 200
    assert all(c["id"] != owned["id"] for c in list_b.json()["items"])
    assert list_b.json()["total"] == 0 or owned["id"] not in {c["id"] for c in list_b.json()["items"]}
