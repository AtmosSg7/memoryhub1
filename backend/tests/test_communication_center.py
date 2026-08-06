"""Communication Center, Client 360, Universal Timeline, Search V2."""

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


def _insert_comm(db, *, user_id: str, client_id: str, **kwargs):
    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "clientId": client_id,
        "type": kwargs.get("type", "email"),
        "direction": kwargs.get("direction", "inbound"),
        "provider": kwargs.get("provider", "gmail"),
        "providerId": kwargs.get("provider_id", str(uuid.uuid4())),
        "subject": kwargs.get("subject"),
        "preview": kwargs.get("preview"),
        "createdAt": kwargs.get("created_at", _now()),
        "attachmentsCount": kwargs.get("attachments_count", 0),
        "externalUrl": kwargs.get("external_url"),
        "metadata": kwargs.get("metadata") or {},
        "updatedAt": _now(),
    }
    db.communications.insert_one(doc)
    return doc


def test_communication_center_feeds_communications_api(client):
    email, password = register_user(client, suffix=_uid("cc"))
    login_user(client, email, password)
    created = create_client_record(client, name="Atelier Dupont")
    client_id = created["id"]

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    _insert_comm(
        db,
        user_id=user["id"],
        client_id=client_id,
        provider_id="msg-1",
        subject="Devis plomberie",
        preview="Bonjour, voici mon besoin…",
        external_url="https://mail.google.com/mail/u/0/#inbox/msg-1",
        metadata={"fromEmail": "client@example.com", "emailMessageId": "em-1"},
    )

    # Unique provider upsert path: second insert with same providerId should be prevented
    # by unique index when present; for unit scope we just assert API reads center.
    res = client.get("/api/communications", params={"category": "email", "clientId": client_id})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] >= 1
    assert any("plomberie" in (item.get("title") or "") for item in body["items"])


def test_client_360_endpoint(client):
    email, password = register_user(client, suffix=_uid("c360"))
    login_user(client, email, password)
    created = create_client_record(client, name="Client 360")
    client_id = created["id"]

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    _insert_comm(
        db,
        user_id=user["id"],
        client_id=client_id,
        direction="inbound",
        provider_id="360-in",
        subject="Bonjour",
        preview="Snippet reçu",
    )
    _insert_comm(
        db,
        user_id=user["id"],
        client_id=client_id,
        direction="outbound",
        provider_id="360-out",
        subject="Réponse",
        preview="Snippet envoyé",
    )

    res = client.get(f"/api/clients/{client_id}/360")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["clientId"] == client_id
    assert body["stats"]["exchangesTotal"] == 2
    assert body["stats"]["emailsReceived"] == 1
    assert body["stats"]["emailsSent"] == 1
    assert "integrations" in body
    assert "googleContacts" in body["integrations"]
    assert "gmail" in body["integrations"]
    assert len(body["recentCommunications"]) == 2


def test_universal_timeline_dedupes_email_events(client):
    email, password = register_user(client, suffix=_uid("tl"))
    login_user(client, email, password)
    created = create_client_record(client, name="Timeline Client")
    client_id = created["id"]

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    user_id = user["id"]
    now = _now()
    email_msg_id = str(uuid.uuid4())

    db.events.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "type": "email_received",
            "entityType": "email",
            "entityId": email_msg_id,
            "clientId": client_id,
            "metadata": {
                "subject": "Ancien event",
                "providerMessageId": "prov-dup",
                "emailMessageId": email_msg_id,
            },
            "createdAt": now,
        }
    )
    db.events.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "type": "note_created",
            "entityType": "note",
            "entityId": str(uuid.uuid4()),
            "clientId": client_id,
            "metadata": {"noteTitle": "Appel client"},
            "createdAt": now,
        }
    )
    _insert_comm(
        db,
        user_id=user_id,
        client_id=client_id,
        direction="inbound",
        provider_id="prov-dup",
        subject="Center email",
        preview="From center",
        created_at=now,
        metadata={"emailMessageId": email_msg_id},
    )

    res = client.get("/api/events", params={"clientId": client_id})
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    email_items = [e for e in items if e["type"] in ("email_received", "email_sent")]
    assert len(email_items) == 1
    assert email_items[0]["id"].startswith("comm-")
    assert any(e["type"] == "note_created" for e in items)


def test_search_v2_nested_client_and_email_snippet(client):
    email, password = register_user(client, suffix=_uid("sv2"))
    login_user(client, email, password)

    created = client.post(
        "/api/clients",
        json={
            "name": "Marie Search",
            "company": "Search Plomberie",
            "email": "marie.search@example.com",
            "phone": "0611223344",
            "city": "Nantes",
            "siret": "12345678900012",
            "tags": ["urgent", "chantier"],
            "status": "active",
        },
    )
    assert created.status_code in (200, 201), created.text
    client_id = created.json()["id"]

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    _insert_comm(
        db,
        user_id=user["id"],
        client_id=client_id,
        provider_id="search-mail",
        subject="Fuite cuisine",
        preview="Urgent fuite sous l'évier du chantier",
        metadata={"clientName": "Search Plomberie", "fromEmail": "marie.search@example.com"},
    )

    for q in ("Nantes", "12345678900012", "urgent", "0611223344", "marie.search"):
        res = client.get("/api/search", params={"q": q})
        assert res.status_code == 200, f"{q}: {res.text}"
        assert res.json()["groups"]["clients"]["total"] >= 1, q

    res = client.get("/api/search", params={"q": "évier"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert "emails" in body["groups"]
    assert body["groups"]["emails"]["total"] >= 1
    assert body["groups"]["whatsapp"]["total"] == 0
    assert body["groups"]["calls"]["total"] == 0
    assert body["groups"]["calendar"]["total"] == 0

    short = client.get("/api/search", params={"q": "a"})
    assert short.status_code == 422


def test_gmail_sync_feeds_communication_center(client, monkeypatch):
    """Gmail sync dual-writes email_messages + communications with full SoT fields."""
    monkeypatch.setenv("INTEGRATIONS_GMAIL_PROVIDER", "mock")
    monkeypatch.setenv("INTEGRATIONS_TOKEN_KEY", "test-integrations-token-key-32chars!!")

    from integrations.providers.mock_gmail import reset_mock_gmail, seed_mock_gmail
    from integrations.secrets import reset_fernet_for_tests
    from urllib.parse import urlparse

    reset_fernet_for_tests()
    reset_mock_gmail()
    seed_mock_gmail()

    email, password = register_user(client, suffix=_uid("gm-cc"))
    login_user(client, email, password)
    client.post(
        "/api/clients",
        json={"name": "Jean Martin", "email": "jean@martin.fr", "status": "active"},
    )
    client.post(
        "/api/clients",
        json={"name": "Sophie Durand", "email": "sophie@durand.fr", "status": "active"},
    )

    res = client.post("/api/integrations/gmail/connect")
    assert res.status_code == 200, res.text
    authorize_url = res.json()["authorizeUrl"]
    parsed = urlparse(authorize_url)
    authorize_path = parsed.path + (("?" + parsed.query) if parsed.query else "")
    follow = client.get(authorize_path, follow_redirects=False)
    assert follow.status_code in (302, 307)
    cb_parsed = urlparse(follow.headers["location"])
    callback_path = cb_parsed.path + (("?" + cb_parsed.query) if cb_parsed.query else "")
    client.get(callback_path, follow_redirects=False)

    synced = client.post("/api/integrations/gmail/sync")
    assert synced.status_code == 200, synced.text

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    user_id = user["id"]
    account = db.connected_accounts.find_one({"userId": user_id, "provider": "gmail"})
    assert account and account.get("id")

    email_count = db.email_messages.count_documents({"userId": user_id, "provider": "gmail"})
    center_docs = list(
        db.communications.find({"userId": user_id, "provider": "gmail", "type": "email"}, {"_id": 0})
    )
    assert email_count >= 1
    assert len(center_docs) == email_count

    for doc in center_docs:
        assert doc.get("userId") == user_id
        assert doc.get("connectedAccountId") == account["id"]
        assert doc.get("type") == "email"
        assert doc.get("direction") in ("inbound", "outbound")
        assert doc.get("provider") == "gmail"
        assert doc.get("providerId")
        assert doc.get("createdAt")
        assert doc.get("updatedAt")
        assert doc.get("status") in ("linked", "unlinked")
        meta = doc.get("metadata") or {}
        assert meta.get("channel") == "email"
        assert meta.get("source") == "gmail"
        assert meta.get("sourceId") == doc["providerId"]
        assert meta.get("fromEmail")
        assert meta.get("toEmails") or meta.get("toEmail")
        assert meta.get("threadId")
        assert meta.get("connectedAccountId") == account["id"]
        assert meta.get("associationStatus") == doc.get("status")
        assert meta.get("emailMessageId")
        assert meta.get("sentAt")

    linked = [d for d in center_docs if d.get("clientId")]
    unlinked = [d for d in center_docs if not d.get("clientId")]
    assert linked
    assert unlinked
    assert all(d["status"] == "linked" for d in linked)
    assert all(d["status"] == "unlinked" for d in unlinked)

    # Unlinked inbox (À traiter)
    inbox = client.get("/api/communications/unlinked")
    assert inbox.status_code == 200, inbox.text
    assert inbox.json()["total"] == len(unlinked)

    # Timeline via communications for a linked client
    jean = db.clients.find_one({"userId": user_id, "email": "jean@martin.fr"})
    events = client.get("/api/events", params={"clientId": jean["id"]})
    assert events.status_code == 200
    email_items = [
        e for e in events.json()["items"] if e["type"] in ("email_received", "email_sent")
    ]
    assert email_items
    assert any(e["id"].startswith("comm-") for e in email_items)

    # Re-sync (incremental): no duplicates in email_messages, communications, or events
    again = client.post("/api/integrations/gmail/sync")
    assert again.status_code == 200
    assert again.json()["summary"]["linked"] == 0
    assert again.json()["summary"].get("mode") == "incremental"
    assert db.email_messages.count_documents({"userId": user_id, "provider": "gmail"}) == email_count
    assert (
        db.communications.count_documents(
            {"userId": user_id, "provider": "gmail", "type": "email"}
        )
        == email_count
    )
    email_events = db.events.count_documents(
        {"userId": user_id, "type": {"$in": ["email_received", "email_sent"]}}
    )
    again_events = client.post("/api/integrations/gmail/sync")
    assert again_events.status_code == 200
    assert (
        db.events.count_documents(
            {"userId": user_id, "type": {"$in": ["email_received", "email_sent"]}}
        )
        == email_events
    )

    reset_mock_gmail()
    reset_fernet_for_tests()


def test_gmail_resync_backfills_missing_communications(client, monkeypatch):
    """Re-sync upserts communications for email_messages that lack a center row."""
    monkeypatch.setenv("INTEGRATIONS_GMAIL_PROVIDER", "mock")
    monkeypatch.setenv("INTEGRATIONS_TOKEN_KEY", "test-integrations-token-key-32chars!!")

    from integrations.providers.mock_gmail import (
        force_mock_history_expired,
        reset_mock_gmail,
        seed_mock_gmail,
    )
    from integrations.secrets import reset_fernet_for_tests
    from urllib.parse import urlparse

    reset_fernet_for_tests()
    reset_mock_gmail()
    seed_mock_gmail()

    email, password = register_user(client, suffix=_uid("gm-bf"))
    login_user(client, email, password)
    client.post(
        "/api/clients",
        json={"name": "Jean Martin", "email": "jean@martin.fr", "status": "active"},
    )

    res = client.post("/api/integrations/gmail/connect")
    authorize_url = res.json()["authorizeUrl"]
    parsed = urlparse(authorize_url)
    authorize_path = parsed.path + (("?" + parsed.query) if parsed.query else "")
    follow = client.get(authorize_path, follow_redirects=False)
    cb_parsed = urlparse(follow.headers["location"])
    client.get(
        cb_parsed.path + (("?" + cb_parsed.query) if cb_parsed.query else ""),
        follow_redirects=False,
    )
    assert client.post("/api/integrations/gmail/sync").status_code == 200

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    user_id = user["id"]
    before = db.communications.count_documents({"userId": user_id, "provider": "gmail"})
    assert before >= 1

    # Simulate legacy gap: email_messages exist without communications
    db.communications.delete_many({"userId": user_id, "provider": "gmail"})
    assert db.communications.count_documents({"userId": user_id, "provider": "gmail"}) == 0
    email_count = db.email_messages.count_documents({"userId": user_id, "provider": "gmail"})

    # Full fallback re-lists messages and upserts missing communications
    force_mock_history_expired(True)
    assert client.post("/api/integrations/gmail/sync").status_code == 200
    after = db.communications.count_documents({"userId": user_id, "provider": "gmail"})
    assert after == email_count
    assert db.email_messages.count_documents({"userId": user_id, "provider": "gmail"}) == email_count

    reset_mock_gmail()
    reset_fernet_for_tests()


def test_gmail_resync_preserves_manual_link_and_ignored(client, monkeypatch):
    """Re-sync must not wipe a manual association or ignoredAt."""
    monkeypatch.setenv("INTEGRATIONS_GMAIL_PROVIDER", "mock")
    monkeypatch.setenv("INTEGRATIONS_TOKEN_KEY", "test-integrations-token-key-32chars!!")

    from integrations.providers.mock_gmail import reset_mock_gmail, seed_mock_gmail
    from integrations.secrets import reset_fernet_for_tests
    from urllib.parse import urlparse

    reset_fernet_for_tests()
    reset_mock_gmail()
    seed_mock_gmail()

    email, password = register_user(client, suffix=_uid("gm-pres"))
    login_user(client, email, password)
    created = create_client_record(client, name="Client Manuel")
    client_id = created["id"]

    res = client.post("/api/integrations/gmail/connect")
    authorize_url = res.json()["authorizeUrl"]
    parsed = urlparse(authorize_url)
    authorize_path = parsed.path + (("?" + parsed.query) if parsed.query else "")
    follow = client.get(authorize_path, follow_redirects=False)
    cb_parsed = urlparse(follow.headers["location"])
    client.get(
        cb_parsed.path + (("?" + cb_parsed.query) if cb_parsed.query else ""),
        follow_redirects=False,
    )
    assert client.post("/api/integrations/gmail/sync").status_code == 200

    inbox = client.get("/api/communications/unlinked")
    assert inbox.status_code == 200
    assert inbox.json()["total"] >= 1
    ignored_id = inbox.json()["items"][0]["id"]

    assert client.post(f"/api/communications/{ignored_id}/ignore").status_code == 200
    before_ignored = client.get("/api/communications/unlinked/count").json()["total"]
    assert client.post("/api/integrations/gmail/sync").status_code == 200
    db = _mongo()
    ignored = db.communications.find_one({"id": ignored_id}, {"_id": 0})
    assert ignored.get("ignoredAt")
    assert ignored.get("status") == "ignored"
    assert client.get("/api/communications/unlinked/count").json()["total"] == before_ignored

    # Restore then associate; re-sync must keep the manual link
    assert client.post(f"/api/communications/{ignored_id}/restore").status_code == 200
    assoc = client.post(
        f"/api/communications/{ignored_id}/associate",
        json={"clientId": client_id},
    )
    assert assoc.status_code == 200, assoc.text
    assert client.post("/api/integrations/gmail/sync").status_code == 200
    linked = db.communications.find_one({"id": ignored_id}, {"_id": 0})
    assert linked["clientId"] == client_id
    assert (linked.get("metadata") or {}).get("linkedBy") == "manual"
    assert linked.get("status") == "linked"

    reset_mock_gmail()
    reset_fernet_for_tests()
