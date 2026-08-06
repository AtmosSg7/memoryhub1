"""Gmail integration — OAuth, sync, matching, timeline, isolation, dedupe."""

from __future__ import annotations

import os
import uuid
from urllib.parse import urlparse

import pytest
from pymongo import MongoClient

os.environ["INTEGRATIONS_GMAIL_PROVIDER"] = "mock"
os.environ["INTEGRATIONS_CONTACTS_PROVIDER"] = "mock"
os.environ.setdefault("INTEGRATIONS_TOKEN_KEY", "test-integrations-token-key-32chars!!")

from integrations.providers.mock_gmail import reset_mock_gmail, seed_mock_gmail
from integrations.secrets import reset_fernet_for_tests
from tests.conftest import login_user, register_user


@pytest.fixture(autouse=True)
def _mock_gmail(monkeypatch):
    monkeypatch.setenv("INTEGRATIONS_GMAIL_PROVIDER", "mock")
    monkeypatch.setenv("INTEGRATIONS_TOKEN_KEY", "test-integrations-token-key-32chars!!")
    reset_fernet_for_tests()
    reset_mock_gmail()
    seed_mock_gmail()
    yield
    reset_mock_gmail()
    reset_fernet_for_tests()


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _connect_gmail(client, email: str, password: str = "PyTestPassword123!"):
    login_user(client, email, password)
    res = client.post("/api/integrations/gmail/connect")
    assert res.status_code == 200, res.text
    authorize_url = res.json()["authorizeUrl"]
    parsed = urlparse(authorize_url)
    authorize_path = parsed.path + (("?" + parsed.query) if parsed.query else "")
    follow = client.get(authorize_path, follow_redirects=False)
    assert follow.status_code in (302, 307), follow.text
    cb_parsed = urlparse(follow.headers["location"])
    callback_path = cb_parsed.path + (("?" + cb_parsed.query) if cb_parsed.query else "")
    cb = client.get(callback_path, follow_redirects=False)
    assert cb.status_code in (302, 307), cb.text
    return cb.headers.get("location")


def test_gmail_callback_rejects_invalid_state(client):
    email, password = register_user(client, suffix=_uid("gm-bad"))
    login_user(client, email, password)
    res = client.get(
        "/api/integrations/gmail/callback",
        params={"code": "x", "state": "invalid"},
        follow_redirects=False,
    )
    assert res.status_code in (302, 307)
    loc = res.headers.get("location", "")
    assert "gmail=error" in loc
    assert "invalid_state" in loc


def test_gmail_connect_sync_match_timeline_dedupe(client):
    email, password = register_user(client, suffix=_uid("gm-sync"))
    login_user(client, email, password)

    created = client.post(
        "/api/clients",
        json={
            "name": "Jean Martin",
            "email": "jean@martin.fr",
            "company": "Martin Plomberie",
            "status": "active",
        },
    )
    assert created.status_code in (200, 201), created.text
    jean_id = created.json()["id"]

    sophie = client.post(
        "/api/clients",
        json={
            "name": "Sophie Durand",
            "email": "sophie@durand.fr",
            "status": "active",
        },
    )
    assert sophie.status_code in (200, 201)
    sophie_id = sophie.json()["id"]

    redirect = _connect_gmail(client, email, password)
    assert "gmail=connected" in (redirect or "")

    status = client.get("/api/integrations/gmail/status")
    assert status.status_code == 200
    assert status.json()["connected"] is True

    preview = client.get("/api/integrations/gmail/preview")
    assert preview.status_code == 200
    assert preview.json()["messageCount"] >= 3

    synced = client.post("/api/integrations/gmail/sync")
    assert synced.status_code == 200, synced.text
    summary = synced.json()["summary"]
    assert summary["linked"] >= 2
    assert summary["unmatched"] >= 1
    assert summary["total"] >= 3

    jean_emails = client.get(f"/api/integrations/gmail/clients/{jean_id}/emails")
    assert jean_emails.status_code == 200
    items = jean_emails.json()["items"]
    assert len(items) >= 1
    assert items[0]["subject"]
    assert items[0]["fromEmail"] or items[0]["toEmail"]
    assert "attachments" in items[0]

    events = client.get(f"/api/events?clientId={jean_id}")
    assert events.status_code == 200
    types = {e["type"] for e in events.json()["items"]}
    assert "email_received" in types

    sophie_events = client.get(f"/api/events?clientId={sophie_id}")
    assert any(e["type"] == "email_sent" for e in sophie_events.json()["items"])

    # Second sync is incremental — no new messages, no duplicates, cursor kept
    again = client.post("/api/integrations/gmail/sync")
    assert again.status_code == 200
    again_summary = again.json()["summary"]
    assert again_summary["linked"] == 0
    assert again_summary.get("mode") == "incremental"
    assert again_summary.get("detected", 0) == 0
    assert again_summary.get("cursorUpdated") is True

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    user_id = user["id"]
    count = db.email_messages.count_documents({"userId": user_id, "provider": "gmail"})
    assert count == summary["total"]  # no duplicates

    # Communications SoT: same count, connectedAccountId, directions preserved
    account = db.connected_accounts.find_one({"userId": user_id, "provider": "gmail"})
    assert account.get("historyId")
    center = list(
        db.communications.find({"userId": user_id, "provider": "gmail", "type": "email"}, {"_id": 0})
    )
    assert len(center) == count
    assert all(c.get("connectedAccountId") == account["id"] for c in center)
    assert {c["direction"] for c in center} >= {"inbound", "outbound"}
    event_count = db.events.count_documents(
        {"userId": user_id, "type": {"$in": ["email_received", "email_sent"]}}
    )
    client.post("/api/integrations/gmail/sync")
    assert (
        db.events.count_documents(
            {"userId": user_id, "type": {"$in": ["email_received", "email_sent"]}}
        )
        == event_count
    )


def test_gmail_user_isolation(client):
    email_a, password_a = register_user(client, suffix=_uid("gm-iso-a"))
    email_b, password_b = register_user(client, suffix=_uid("gm-iso-b"))

    login_user(client, email_a, password_a)
    client.post(
        "/api/clients",
        json={"name": "Jean Martin", "email": "jean@martin.fr", "status": "active"},
    )
    _connect_gmail(client, email_a, password_a)
    client.post("/api/integrations/gmail/sync")

    client.post("/api/auth/logout")
    login_user(client, email_b, password_b)
    status_b = client.get("/api/integrations/gmail/status").json()
    assert status_b["connected"] is False
    # Cannot see A's client emails without owning the client
    clients_b = client.get("/api/clients").json()["items"]
    assert clients_b == []


def test_gmail_disconnect(client):
    email, password = register_user(client, suffix=_uid("gm-disc"))
    _connect_gmail(client, email, password)
    assert client.get("/api/integrations/gmail/status").json()["connected"] is True
    res = client.post("/api/integrations/gmail/disconnect")
    assert res.status_code == 200
    assert res.json()["disconnected"] is True
    assert client.get("/api/integrations/gmail/status").json()["connected"] is False
