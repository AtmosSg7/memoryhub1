"""Gmail incremental history sync — cursor, fallback, isolation, prospects."""

from __future__ import annotations

import os
import uuid
from urllib.parse import urlparse

import pytest
from pymongo import MongoClient

os.environ["INTEGRATIONS_GMAIL_PROVIDER"] = "mock"
os.environ.setdefault("INTEGRATIONS_TOKEN_KEY", "test-integrations-token-key-32chars!!")

from integrations.models import RemoteEmailMessage
from integrations.providers.mock_gmail import (
    append_mock_gmail_message,
    current_mock_history_id,
    force_mock_history_expired,
    register_mock_gmail_auth_code,
    reset_mock_gmail,
    seed_mock_gmail,
)
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


def _connect_gmail(client, email: str, password: str = "PyTestPassword123!", *, account_id=None):
    login_user(client, email, password)
    res = client.post("/api/integrations/gmail/connect")
    assert res.status_code == 200, res.text
    authorize_url = res.json()["authorizeUrl"]
    parsed = urlparse(authorize_url)
    authorize_path = parsed.path + (("?" + parsed.query) if parsed.query else "")
    follow = client.get(authorize_path, follow_redirects=False)
    assert follow.status_code in (302, 307), follow.text
    cb_parsed = urlparse(follow.headers["location"])
    # Optionally rewrite mock code registration for a different account_id
    if account_id:
        from urllib.parse import parse_qs

        qs = parse_qs(cb_parsed.query)
        code = (qs.get("code") or [None])[0]
        if code:
            register_mock_gmail_auth_code(code, account_id=account_id)
    callback_path = cb_parsed.path + (("?" + cb_parsed.query) if cb_parsed.query else "")
    cb = client.get(callback_path, follow_redirects=False)
    assert cb.status_code in (302, 307), cb.text
    return cb.headers.get("location")


def test_first_sync_full_stores_history_cursor(client):
    email, password = register_user(client, suffix=_uid("inc-full"))
    login_user(client, email, password)
    client.post(
        "/api/clients",
        json={"name": "Jean Martin", "email": "jean@martin.fr", "status": "active"},
    )
    _connect_gmail(client, email, password)

    synced = client.post("/api/integrations/gmail/sync")
    assert synced.status_code == 200, synced.text
    summary = synced.json()["summary"]
    assert summary["mode"] == "full"
    assert summary["total"] >= 3
    assert summary["created"] >= 3
    assert summary["cursorUpdated"] is True
    assert summary["linked"] >= 1
    assert summary["unmatched"] >= 1

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    account = db.connected_accounts.find_one({"userId": user["id"], "provider": "gmail"})
    assert account["historyId"] == current_mock_history_id()
    assert account.get("lastFullSyncAt")
    assert account.get("lastSuccessfulSyncAt")
    assert account.get("syncState") == "idle"


def test_incremental_sync_no_new_messages(client):
    email, password = register_user(client, suffix=_uid("inc-empty"))
    _connect_gmail(client, email, password)
    assert client.post("/api/integrations/gmail/sync").status_code == 200

    again = client.post("/api/integrations/gmail/sync")
    assert again.status_code == 200
    summary = again.json()["summary"]
    assert summary["mode"] == "incremental"
    assert summary["detected"] == 0
    assert summary["created"] == 0
    assert summary["linked"] == 0
    assert summary["cursorUpdated"] is True

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    assert db.email_messages.count_documents({"userId": user["id"], "provider": "gmail"}) == 3


def test_incremental_sync_with_new_message_and_prospect(client):
    email, password = register_user(client, suffix=_uid("inc-new"))
    login_user(client, email, password)
    _connect_gmail(client, email, password)
    assert client.post("/api/integrations/gmail/sync").status_code == 200

    append_mock_gmail_message(
        RemoteEmailMessage(
            sourceId="gmail-msg-new-lead",
            threadId="thread-new",
            subject="Besoin devis urgent",
            snippet="Bonjour, je découvre votre activité…",
            fromEmail="nouveau@lead.fr",
            fromName="Nouveau Lead",
            toEmails=["artisan@gmail.com"],
            direction="inbound",
            sentAt="2026-08-01T10:00:00+00:00",
            webLink="https://mail.google.com/mail/u/0/#inbox/thread-new",
        )
    )

    synced = client.post("/api/integrations/gmail/sync")
    assert synced.status_code == 200
    summary = synced.json()["summary"]
    assert summary["mode"] == "incremental"
    assert summary["detected"] == 1
    assert summary["created"] == 1
    assert summary["unmatched"] == 1
    assert summary["linked"] == 0

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    assert (
        db.email_messages.count_documents(
            {"userId": user["id"], "providerMessageId": "gmail-msg-new-lead"}
        )
        == 1
    )
    assert (
        db.communications.count_documents(
            {"userId": user["id"], "providerId": "gmail-msg-new-lead"}
        )
        == 1
    )

    prospects = client.get("/api/prospects", params={"status": "pending"})
    assert prospects.status_code == 200
    emails = {p["email"] for p in prospects.json()["items"]}
    assert "nouveau@lead.fr" in emails


def test_incremental_links_existing_client(client):
    email, password = register_user(client, suffix=_uid("inc-link"))
    login_user(client, email, password)
    client.post(
        "/api/clients",
        json={"name": "Sophie Durand", "email": "sophie@durand.fr", "status": "active"},
    )
    # Seed without sophie outbound first
    reset_mock_gmail()
    seed_mock_gmail(
        [
            RemoteEmailMessage(
                sourceId="only-jean",
                threadId="t1",
                subject="Hello",
                snippet="Hi",
                fromEmail="other@x.fr",
                toEmails=["artisan@gmail.com"],
                direction="inbound",
                sentAt="2026-07-01T10:00:00+00:00",
            )
        ]
    )
    _connect_gmail(client, email, password)
    assert client.post("/api/integrations/gmail/sync").status_code == 200

    append_mock_gmail_message(
        RemoteEmailMessage(
            sourceId="sophie-reply",
            threadId="t-sophie",
            subject="Merci",
            snippet="Parfait",
            fromEmail="sophie@durand.fr",
            fromName="Sophie",
            toEmails=["artisan@gmail.com"],
            direction="inbound",
            sentAt="2026-08-02T10:00:00+00:00",
        )
    )
    synced = client.post("/api/integrations/gmail/sync")
    assert synced.status_code == 200
    assert synced.json()["summary"]["linked"] == 1
    assert synced.json()["summary"]["mode"] == "incremental"


def test_history_expired_falls_back_to_full(client):
    email, password = register_user(client, suffix=_uid("inc-exp"))
    _connect_gmail(client, email, password)
    assert client.post("/api/integrations/gmail/sync").status_code == 200

    force_mock_history_expired(True)
    synced = client.post("/api/integrations/gmail/sync")
    assert synced.status_code == 200
    summary = synced.json()["summary"]
    assert summary["mode"] == "full"
    assert summary["fallbackFromIncremental"] is True
    assert summary["cursorUpdated"] is True

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    # No duplicates after fallback
    assert db.email_messages.count_documents({"userId": user["id"], "provider": "gmail"}) == 3


def test_cursor_not_advanced_on_partial_failure(client, monkeypatch):
    email, password = register_user(client, suffix=_uid("inc-fail"))
    _connect_gmail(client, email, password)
    first = client.post("/api/integrations/gmail/sync")
    assert first.status_code == 200
    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    account = db.connected_accounts.find_one({"userId": user["id"], "provider": "gmail"})
    cursor_before = account["historyId"]

    append_mock_gmail_message(
        RemoteEmailMessage(
            sourceId="will-fail-fetch",
            threadId="t-fail",
            subject="Boom",
            snippet="x",
            fromEmail="x@y.fr",
            toEmails=["artisan@gmail.com"],
            direction="inbound",
            sentAt="2026-08-03T10:00:00+00:00",
        )
    )

    from integrations.providers.mock_gmail import MockGmailProvider

    async def boom(*args, **kwargs):
        raise RuntimeError("simulated partial failure")

    monkeypatch.setattr(MockGmailProvider, "fetch_messages_by_ids", boom)

    failed = client.post("/api/integrations/gmail/sync")
    assert failed.status_code == 502

    account_after = db.connected_accounts.find_one({"userId": user["id"], "provider": "gmail"})
    assert account_after["historyId"] == cursor_before
    assert account_after.get("syncState") == "error"
    assert account_after.get("lastSyncError")
    assert "simulated" in (account_after.get("lastSyncError") or "")
    assert "Bearer" not in (account_after.get("lastSyncError") or "")


def test_reconnect_same_mailbox_keeps_cursor(client):
    email, password = register_user(client, suffix=_uid("inc-re"))
    _connect_gmail(client, email, password)
    assert client.post("/api/integrations/gmail/sync").status_code == 200
    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    before = db.connected_accounts.find_one({"userId": user["id"], "provider": "gmail"})
    cursor = before["historyId"]

    # Re-OAuth without disconnect (same account_id)
    _connect_gmail(client, email, password)
    after = db.connected_accounts.find_one({"userId": user["id"], "provider": "gmail"})
    assert after["historyId"] == cursor
    assert after["id"] == before["id"]


def test_reconnect_different_mailbox_resets_cursor(client):
    email, password = register_user(client, suffix=_uid("inc-diff"))
    _connect_gmail(client, email, password, account_id="mock-gmail-user-1")
    assert client.post("/api/integrations/gmail/sync").status_code == 200
    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    assert db.connected_accounts.find_one({"userId": user["id"], "provider": "gmail"})["historyId"]

    # Reconnect as a different Gmail account id
    _connect_gmail(client, email, password, account_id="mock-gmail-user-OTHER")
    after = db.connected_accounts.find_one({"userId": user["id"], "provider": "gmail"})
    assert after.get("historyId") is None
    assert after.get("accountId") == "mock-gmail-user-OTHER"


def test_disconnect_clears_account_cursor(client):
    email, password = register_user(client, suffix=_uid("inc-disc"))
    _connect_gmail(client, email, password)
    assert client.post("/api/integrations/gmail/sync").status_code == 200
    assert client.post("/api/integrations/gmail/disconnect").status_code == 200
    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    assert db.connected_accounts.find_one({"userId": user["id"], "provider": "gmail"}) is None


def test_user_isolation_cursors(client):
    email_a, password_a = register_user(client, suffix=_uid("inc-iso-a"))
    email_b, password_b = register_user(client, suffix=_uid("inc-iso-b"))

    _connect_gmail(client, email_a, password_a)
    assert client.post("/api/integrations/gmail/sync").status_code == 200

    client.post("/api/auth/logout")
    _connect_gmail(client, email_b, password_b)
    assert client.post("/api/integrations/gmail/sync").status_code == 200

    db = _mongo()
    user_a = db.users.find_one({"email": email_a.lower()})
    user_b = db.users.find_one({"email": email_b.lower()})
    acc_a = db.connected_accounts.find_one({"userId": user_a["id"], "provider": "gmail"})
    acc_b = db.connected_accounts.find_one({"userId": user_b["id"], "provider": "gmail"})
    assert acc_a["id"] != acc_b["id"]
    assert acc_a.get("historyId")
    assert acc_b.get("historyId")


def test_history_pagination_collects_multiple_pages(client, monkeypatch):
    """Provider history pagination is exercised via mock returning capped pages."""
    from integrations.providers.mock_gmail import MockGmailProvider
    from integrations.models import GmailHistoryResult

    email, password = register_user(client, suffix=_uid("inc-page"))
    _connect_gmail(client, email, password)
    assert client.post("/api/integrations/gmail/sync").status_code == 200

    calls = {"n": 0}

    async def paged_history(self, *, access_token, start_history_id, max_message_ids=200):
        calls["n"] += 1
        # Provider collapses History pagination; report pages>1 for observability.
        return GmailHistoryResult(
            messageIds=["gmail-msg-page-1", "gmail-msg-page-2"],
            historyId=str(int(current_mock_history_id()) + 2),
            pages=2,
        )

    append_mock_gmail_message(
        RemoteEmailMessage(
            sourceId="gmail-msg-page-1",
            threadId="tp1",
            subject="P1",
            snippet="a",
            fromEmail="p1@ex.fr",
            toEmails=["artisan@gmail.com"],
            direction="inbound",
            sentAt="2026-08-04T10:00:00+00:00",
        )
    )
    append_mock_gmail_message(
        RemoteEmailMessage(
            sourceId="gmail-msg-page-2",
            threadId="tp2",
            subject="P2",
            snippet="b",
            fromEmail="p2@ex.fr",
            toEmails=["artisan@gmail.com"],
            direction="inbound",
            sentAt="2026-08-04T11:00:00+00:00",
        )
    )

    monkeypatch.setattr(MockGmailProvider, "list_history_message_ids", paged_history)
    synced = client.post("/api/integrations/gmail/sync")
    assert synced.status_code == 200
    assert synced.json()["summary"]["mode"] == "incremental"
    assert synced.json()["summary"]["detected"] == 2
    assert synced.json()["summary"]["created"] == 2
    assert calls["n"] == 1


def test_scheduler_entrypoint_is_exported():
    from integrations.gmail_sync_service import run_gmail_sync_for_user, sync_gmail

    assert callable(run_gmail_sync_for_user)
    assert callable(sync_gmail)
