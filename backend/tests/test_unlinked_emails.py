"""Backend tests — unlinked email inbox (associate / ignore / suggest / create)."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from pymongo import MongoClient

from tests.conftest import create_client_record, login_user, register_user


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _insert_unlinked_email(db, user_id: str, **kwargs):
    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "clientId": None,
        "type": "email",
        "direction": kwargs.get("direction", "inbound"),
        "provider": "gmail",
        "providerId": kwargs.get("provider_id", str(uuid.uuid4())),
        "subject": kwargs.get("subject", "Sujet test"),
        "preview": kwargs.get("preview", "Aperçu"),
        "createdAt": kwargs.get("created_at", _now()),
        "attachmentsCount": 0,
        "externalUrl": kwargs.get("external_url", "https://mail.google.com/mail/u/0/#inbox/abc"),
        "metadata": {
            "fromEmail": kwargs.get("from_email", "inconnu@exemple.fr"),
            "fromName": kwargs.get("from_name", "Inconnu"),
            "toEmails": kwargs.get("to_emails", ["artisan@gmail.com"]),
            "toEmail": "artisan@gmail.com",
            "accountEmail": kwargs.get("account_email", "artisan@gmail.com"),
            "emailMessageId": kwargs.get("email_message_id", str(uuid.uuid4())),
            "channel": "email",
            "source": "gmail",
        },
        "updatedAt": _now(),
    }
    if kwargs.get("ignored_at"):
        doc["ignoredAt"] = kwargs["ignored_at"]
        doc["status"] = "ignored"
    db.communications.insert_one(doc)
    # Mirror email_messages foundation row
    db.email_messages.insert_one(
        {
            "id": doc["metadata"]["emailMessageId"],
            "userId": user_id,
            "clientId": None,
            "provider": "gmail",
            "providerMessageId": doc["providerId"],
            "subject": doc["subject"],
            "preview": doc["preview"],
            "fromEmail": doc["metadata"]["fromEmail"],
            "fromName": doc["metadata"]["fromName"],
            "toEmails": doc["metadata"]["toEmails"],
            "direction": doc["direction"],
            "gmailUrl": doc["externalUrl"],
            "sentAt": doc["createdAt"],
            "createdAt": doc["createdAt"],
            "updatedAt": doc["updatedAt"],
        }
    )
    return doc


def test_unlinked_list_isolated_and_paginated(client):
    email_a, password_a = register_user(client, suffix=_uid("ul-a"))
    email_b, password_b = register_user(client, suffix=_uid("ul-b"))

    login_user(client, email_a, password_a)
    db = _mongo()
    user_a = db.users.find_one({"email": email_a.lower()})
    for i in range(3):
        _insert_unlinked_email(db, user_a["id"], subject=f"Mail A {i}", from_email=f"a{i}@x.fr")

    page1 = client.get("/api/communications/unlinked", params={"limit": 2, "offset": 0})
    assert page1.status_code == 200, page1.text
    body1 = page1.json()
    assert body1["total"] == 3
    assert len(body1["items"]) == 2

    page2 = client.get("/api/communications/unlinked", params={"limit": 2, "offset": 2})
    assert page2.status_code == 200
    assert len(page2.json()["items"]) == 1

    count = client.get("/api/communications/unlinked/count")
    assert count.status_code == 200
    assert count.json()["total"] == 3

    client.post("/api/auth/logout")
    login_user(client, email_b, password_b)
    other = client.get("/api/communications/unlinked")
    assert other.status_code == 200
    assert other.json()["total"] == 0


def test_associate_syncs_center_email_messages_timeline_360_idempotent(client):
    email, password = register_user(client, suffix=_uid("ul-as"))
    login_user(client, email, password)
    created = create_client_record(client, name="Atelier Martin")
    client_id = created["id"]

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    doc = _insert_unlinked_email(
        db,
        user["id"],
        subject="Devis cuisine",
        from_email="prospect@exemple.fr",
    )

    res = client.post(
        f"/api/communications/{doc['id']}/associate",
        json={"clientId": client_id},
    )
    assert res.status_code == 200, res.text
    assert res.json()["clientId"] == client_id
    assert res.json()["alreadyLinked"] is False

    # Idempotent
    again = client.post(
        f"/api/communications/{doc['id']}/associate",
        json={"clientId": client_id},
    )
    assert again.status_code == 200
    assert again.json()["alreadyLinked"] is True

    comm = db.communications.find_one({"id": doc["id"]})
    assert comm["clientId"] == client_id

    msg = db.email_messages.find_one({"id": doc["metadata"]["emailMessageId"]})
    assert msg["clientId"] == client_id

    events = list(
        db.events.find(
            {"userId": user["id"], "type": {"$in": ["email_received", "email_sent"]}}
        )
    )
    assert len(events) == 1

    c360 = client.get(f"/api/clients/{client_id}/360")
    assert c360.status_code == 200
    assert c360.json()["stats"]["exchangesTotal"] >= 1
    assert any(c["id"] == doc["id"] for c in c360.json()["recentCommunications"])

    # Removed from unlinked
    assert client.get("/api/communications/unlinked/count").json()["total"] == 0


def test_cannot_associate_other_users_client(client):
    email_a, password_a = register_user(client, suffix=_uid("ul-iso-a"))
    email_b, password_b = register_user(client, suffix=_uid("ul-iso-b"))

    login_user(client, email_a, password_a)
    client_a = create_client_record(client, name="Client A")

    client.post("/api/auth/logout")
    login_user(client, email_b, password_b)
    db = _mongo()
    user_b = db.users.find_one({"email": email_b.lower()})
    doc = _insert_unlinked_email(db, user_b["id"], from_email="x@y.fr")

    res = client.post(
        f"/api/communications/{doc['id']}/associate",
        json={"clientId": client_a["id"]},
    )
    assert res.status_code == 404


def test_suggestion_exact_email_shown_domain_not_auto(client):
    email, password = register_user(client, suffix=_uid("ul-sug"))
    login_user(client, email, password)
    created = client.post(
        "/api/clients",
        json={
            "name": "Atelier Martin",
            "email": "jean@martin-atelier.fr",
            "company": "Atelier Martin",
            "status": "active",
        },
    )
    assert created.status_code in (200, 201)
    client_id = created.json()["id"]

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    exact = _insert_unlinked_email(
        db,
        user["id"],
        from_email="jean@martin-atelier.fr",
        from_name="Jean",
        subject="Exact",
    )
    weak = _insert_unlinked_email(
        db,
        user["id"],
        from_email="autre@martin-atelier.fr",
        from_name="Quelqu'un",
        subject="Domain only",
        provider_id=str(uuid.uuid4()),
        email_message_id=str(uuid.uuid4()),
    )

    res = client.get("/api/communications/unlinked")
    assert res.status_code == 200
    items = {item["id"]: item for item in res.json()["items"]}
    assert items[exact["id"]]["suggestion"] is not None
    assert items[exact["id"]]["suggestion"]["clientId"] == client_id
    assert items[exact["id"]]["suggestion"]["confidence"] == "high"
    # Domain-only must not be suggested (low confidence)
    assert items[weak["id"]]["suggestion"] is None
    # Still unlinked — never auto-associated
    assert db.communications.find_one({"id": weak["id"]})["clientId"] is None


def test_ignore_and_restore(client):
    email, password = register_user(client, suffix=_uid("ul-ig"))
    login_user(client, email, password)
    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    doc = _insert_unlinked_email(db, user["id"], subject="Newsletter")

    assert client.get("/api/communications/unlinked/count").json()["total"] == 1
    ignored = client.post(f"/api/communications/{doc['id']}/ignore")
    assert ignored.status_code == 200
    assert ignored.json()["ignoredAt"]
    assert client.get("/api/communications/unlinked/count").json()["total"] == 0

    # Visible in all / ignored
    all_emails = client.get(
        "/api/communications/unlinked", params={"linkStatus": "all"}
    )
    assert all_emails.status_code == 200
    match = next(i for i in all_emails.json()["items"] if i["id"] == doc["id"])
    assert match["status"] == "ignored"

    restored = client.post(f"/api/communications/{doc['id']}/restore")
    assert restored.status_code == 200
    assert client.get("/api/communications/unlinked/count").json()["total"] == 1


def test_create_client_from_email_and_duplicate(client):
    email, password = register_user(client, suffix=_uid("ul-cr"))
    login_user(client, email, password)
    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    doc = _insert_unlinked_email(
        db,
        user["id"],
        from_email="nouveau@chantier.fr",
        from_name="Paul Nouveau",
        subject="Demande devis",
    )

    created = client.post(
        f"/api/communications/{doc['id']}/create-client",
        json={"name": "Paul Nouveau", "email": "nouveau@chantier.fr", "company": "Chantier"},
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["duplicateClientId"] is None
    assert body["association"]["clientId"] == body["client"]["id"]
    assert db.communications.find_one({"id": doc["id"]})["clientId"] == body["client"]["id"]

    # Second email same address → duplicate associates to existing
    doc2 = _insert_unlinked_email(
        db,
        user["id"],
        from_email="nouveau@chantier.fr",
        from_name="Paul Nouveau",
        subject="Suite",
        provider_id=str(uuid.uuid4()),
        email_message_id=str(uuid.uuid4()),
    )
    dup = client.post(f"/api/communications/{doc2['id']}/create-client", json={})
    assert dup.status_code == 200
    assert dup.json()["duplicateClientId"] == body["client"]["id"]
    assert dup.json()["association"]["clientId"] == body["client"]["id"]


def test_dismiss_suggestion(client):
    email, password = register_user(client, suffix=_uid("ul-dis"))
    login_user(client, email, password)
    created = client.post(
        "/api/clients",
        json={"name": "Sophie", "email": "sophie@durand.fr", "status": "active"},
    )
    client_id = created.json()["id"]
    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    doc = _insert_unlinked_email(db, user["id"], from_email="sophie@durand.fr")

    before = client.get("/api/communications/unlinked").json()["items"][0]
    assert before["suggestion"]["clientId"] == client_id

    dismiss = client.post(f"/api/communications/{doc['id']}/dismiss-suggestion")
    assert dismiss.status_code == 200
    after = client.get("/api/communications/unlinked").json()["items"][0]
    assert after["suggestion"] is None
    assert after["status"] == "unlinked"
