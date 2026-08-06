"""Gmail auto-sync scheduler job — locks, backoff, batching, no duplicates."""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient

os.environ["INTEGRATIONS_GMAIL_PROVIDER"] = "mock"
os.environ.setdefault("INTEGRATIONS_TOKEN_KEY", "test-integrations-token-key-32chars!!")

from integrations.distributed_lock import acquire_lock, release_lock
from integrations.gmail_auto_sync_job import (
    list_eligible_gmail_accounts,
    run_gmail_auto_sync,
)
from integrations.gmail_sync_schedule import (
    backoff_delay_minutes,
    compute_next_sync_at,
    gmail_sync_lock_key,
)
from integrations.models import RemoteEmailMessage
from integrations.providers.mock_gmail import (
    append_mock_gmail_message,
    reset_mock_gmail,
    seed_mock_gmail,
)
from integrations.secrets import reset_fernet_for_tests
from tests.conftest import login_user, register_user


@pytest.fixture(autouse=True)
def _mock_gmail(monkeypatch):
    monkeypatch.setenv("INTEGRATIONS_GMAIL_PROVIDER", "mock")
    monkeypatch.setenv("INTEGRATIONS_TOKEN_KEY", "test-integrations-token-key-32chars!!")
    monkeypatch.setenv("GMAIL_AUTO_SYNC_ENABLED", "true")
    monkeypatch.setenv("GMAIL_AUTO_SYNC_INTERVAL_MINUTES", "10")
    monkeypatch.setenv("GMAIL_AUTO_SYNC_BATCH_SIZE", "25")
    monkeypatch.setenv("GMAIL_AUTO_SYNC_TIMEOUT_SECONDS", "60")
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


_LOOP = None


def _loop():
    global _LOOP
    if _LOOP is None or _LOOP.is_closed():
        _LOOP = asyncio.new_event_loop()
        asyncio.set_event_loop(_LOOP)
    return _LOOP


def _motor():
    _loop()
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client, client[os.environ["DB_NAME"]]


def _run(coro):
    return _loop().run_until_complete(coro)


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


def _account_for_email(email: str) -> dict:
    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    assert user
    account = db.connected_accounts.find_one({"userId": user["id"], "provider": "gmail"})
    assert account
    return account


def _user_id(email: str) -> str:
    user = _mongo().users.find_one({"email": email.lower()})
    assert user
    return user["id"]


def _auto_sync_for(*emails: str):
    motor_client, db = _motor()
    try:
        user_ids = [_user_id(e) for e in emails]
        return _run(run_gmail_auto_sync(db, user_ids=user_ids))
    finally:
        motor_client.close()


def test_backoff_delay_matrix():
    assert backoff_delay_minutes(0, interval_minutes=10) == 10
    assert backoff_delay_minutes(1, interval_minutes=10) == 10
    assert backoff_delay_minutes(2, interval_minutes=10) == 30
    assert backoff_delay_minutes(3, interval_minutes=10) == 60
    assert backoff_delay_minutes(4, interval_minutes=10) == 360
    assert backoff_delay_minutes(9, interval_minutes=10) == 360


def test_active_gmail_account_is_synced(client):
    email, password = register_user(client, suffix=_uid("auto-ok"))
    _connect_gmail(client, email, password)

    result = _auto_sync_for(email)

    assert result["enabled"] is True
    assert result["eligible"] == 1
    assert result["success"] == 1
    assert result["failed"] == 0

    account = _account_for_email(email)
    assert account.get("historyId")
    assert account.get("lastSuccessfulSyncAt")
    assert account.get("lastSyncAttemptAt")
    assert int(account.get("consecutiveSyncErrors") or 0) == 0
    assert account.get("nextSyncAt")
    assert account.get("status") == "connected"
    assert _mongo().email_messages.count_documents(
        {"userId": account["userId"], "provider": "gmail"}
    ) >= 3


def test_disconnected_account_ignored(client):
    email, password = register_user(client, suffix=_uid("auto-disc"))
    _connect_gmail(client, email, password)
    user_id = _user_id(email)
    assert client.post("/api/integrations/gmail/disconnect").status_code == 200

    motor_client, db = _motor()
    try:
        before = _run(list_eligible_gmail_accounts(db, limit=100, user_ids=[user_id]))
        assert before == []
        result = _run(run_gmail_auto_sync(db, user_ids=[user_id]))
    finally:
        motor_client.close()

    assert result["enabled"] is True
    assert result["eligible"] == 0
    assert result["processed"] == 0


def test_account_in_backoff_ignored_until_due(client):
    email, password = register_user(client, suffix=_uid("auto-bo"))
    _connect_gmail(client, email, password)
    account = _account_for_email(email)
    user_id = account["userId"]
    future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    _mongo().connected_accounts.update_one(
        {"id": account["id"]},
        {
            "$set": {
                "consecutiveSyncErrors": 3,
                "nextSyncAt": future,
                "status": "connected",
            }
        },
    )

    motor_client, db = _motor()
    try:
        eligible = _run(list_eligible_gmail_accounts(db, limit=200, user_ids=[user_id]))
        assert eligible == []

        # Expire backoff → eligible again
        past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        _mongo().connected_accounts.update_one(
            {"id": account["id"]},
            {"$set": {"nextSyncAt": past}},
        )
        eligible2 = _run(list_eligible_gmail_accounts(db, limit=200, user_ids=[user_id]))
        assert any(a["id"] == account["id"] for a in eligible2)
    finally:
        motor_client.close()


def test_two_workers_do_not_sync_same_account(client):
    email, password = register_user(client, suffix=_uid("auto-lock"))
    _connect_gmail(client, email, password)
    account = _account_for_email(email)
    key = gmail_sync_lock_key(account["id"])

    motor_client, db = _motor()
    try:
        assert _run(acquire_lock(db, key, owner="worker-a", ttl_seconds=120)) is True

        async def dual():
            from integrations.gmail_sync_service import sync_gmail

            results = await asyncio.gather(
                sync_gmail(db, account["userId"]),
                sync_gmail(db, account["userId"]),
                return_exceptions=True,
            )
            return results

        results = _run(dual())
        in_progress = [
            r
            for r in results
            if isinstance(r, Exception) and r.__class__.__name__ == "GmailSyncInProgressError"
        ]
        # Both should fail while external lock is held
        assert len(in_progress) == 2

        assert _run(release_lock(db, key, owner="worker-a")) is True
        # After release, one sync succeeds
        from integrations.gmail_sync_service import sync_gmail

        ok = _run(sync_gmail(db, account["userId"]))
        assert ok.summary.mode in ("full", "incremental")
    finally:
        _run(release_lock(db, key, owner="worker-a"))
        motor_client.close()


def test_expired_lock_is_reclaimable(client):
    email, password = register_user(client, suffix=_uid("auto-exp"))
    _connect_gmail(client, email, password)
    account = _account_for_email(email)
    key = gmail_sync_lock_key(account["id"])
    past = datetime.now(timezone.utc) - timedelta(minutes=5)

    motor_client, db = _motor()
    try:
        _run(
            db.distributed_locks.replace_one(
                {"_id": key},
                {
                    "_id": key,
                    "owner": "dead-worker",
                    "acquiredAt": past,
                    "expiresAt": past,
                },
                upsert=True,
            )
        )
        assert _run(acquire_lock(db, key, owner="alive-worker", ttl_seconds=60)) is True
        lock = _run(db.distributed_locks.find_one({"_id": key}))
        assert lock["owner"] == "alive-worker"
        assert _run(release_lock(db, key, owner="alive-worker")) is True
    finally:
        motor_client.close()


def test_timeout_records_failure_and_keeps_connected(client, monkeypatch):
    email, password = register_user(client, suffix=_uid("auto-to"))
    _connect_gmail(client, email, password)
    account = _account_for_email(email)
    monkeypatch.setenv("GMAIL_AUTO_SYNC_TIMEOUT_SECONDS", "1")

    async def slow_sync(db, user_id):
        await asyncio.sleep(3)
        raise AssertionError("should have timed out")

    monkeypatch.setattr(
        "integrations.gmail_sync_service.run_gmail_sync_for_user",
        slow_sync,
    )
    _mongo().connected_accounts.update_one(
        {"id": account["id"]},
        {"$set": {"nextSyncAt": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()}},
    )

    result = _auto_sync_for(email)

    assert result["failed"] == 1
    after = _account_for_email(email)
    assert after["status"] == "connected"
    assert int(after.get("consecutiveSyncErrors") or 0) >= 1
    assert after.get("nextSyncAt")
    assert "timed out" in (after.get("lastSyncError") or "").lower()


def test_one_account_error_does_not_block_others(client, monkeypatch):
    email_a, password_a = register_user(client, suffix=_uid("auto-e1"))
    email_b, password_b = register_user(client, suffix=_uid("auto-e2"))
    _connect_gmail(client, email_a, password_a)
    client.post("/api/auth/logout")
    _connect_gmail(client, email_b, password_b)

    acc_a = _account_for_email(email_a)
    past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    _mongo().connected_accounts.update_many(
        {"provider": "gmail", "id": {"$in": [acc_a["id"], _account_for_email(email_b)["id"]]}},
        {"$set": {"nextSyncAt": past}},
    )

    from integrations import gmail_sync_service as gss

    real_run = gss.run_gmail_sync_for_user

    async def flaky(db, user_id):
        if user_id == acc_a["userId"]:
            raise RuntimeError("simulated account failure")
        return await real_run(db, user_id)

    monkeypatch.setattr(
        "integrations.gmail_sync_service.run_gmail_sync_for_user",
        flaky,
    )

    result = _auto_sync_for(email_a, email_b)

    assert result["failed"] == 1
    assert result["success"] == 1
    assert _account_for_email(email_a)["status"] == "connected"
    assert int(_account_for_email(email_b).get("consecutiveSyncErrors") or 0) == 0


def test_success_resets_consecutive_errors(client):
    email, password = register_user(client, suffix=_uid("auto-reset"))
    _connect_gmail(client, email, password)
    account = _account_for_email(email)
    _mongo().connected_accounts.update_one(
        {"id": account["id"]},
        {
            "$set": {
                "consecutiveSyncErrors": 4,
                "nextSyncAt": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
                "status": "connected",
            }
        },
    )

    result = _auto_sync_for(email)

    assert result["success"] == 1
    after = _account_for_email(email)
    assert int(after.get("consecutiveSyncErrors") or 0) == 0


def test_failure_schedules_next_sync_at(client, monkeypatch):
    email, password = register_user(client, suffix=_uid("auto-next"))
    _connect_gmail(client, email, password)
    account = _account_for_email(email)
    _mongo().connected_accounts.update_one(
        {"id": account["id"]},
        {
            "$set": {
                "consecutiveSyncErrors": 1,
                "nextSyncAt": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
            }
        },
    )

    async def boom(db, user_id):
        raise RuntimeError("boom for nextSyncAt")

    monkeypatch.setattr(
        "integrations.gmail_sync_service.run_gmail_sync_for_user",
        boom,
    )

    before = datetime.now(timezone.utc)
    _auto_sync_for(email)

    after = _account_for_email(email)
    assert int(after["consecutiveSyncErrors"]) == 2
    # 2 errors → 30 minutes backoff
    expected_min = before + timedelta(minutes=25)
    next_at = datetime.fromisoformat(after["nextSyncAt"])
    if next_at.tzinfo is None:
        next_at = next_at.replace(tzinfo=timezone.utc)
    assert next_at >= expected_min


def test_no_duplication_across_auto_sync_runs(client):
    email, password = register_user(client, suffix=_uid("auto-dedup"))
    _connect_gmail(client, email, password)

    _auto_sync_for(email)
    account = _account_for_email(email)
    count1 = _mongo().email_messages.count_documents(
        {"userId": account["userId"], "provider": "gmail"}
    )
    _mongo().connected_accounts.update_one(
        {"id": account["id"]},
        {"$set": {"nextSyncAt": (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()}},
    )
    _auto_sync_for(email)
    count2 = _mongo().email_messages.count_documents(
        {"userId": account["userId"], "provider": "gmail"}
    )
    comms = _mongo().communications.count_documents(
        {"userId": account["userId"], "provider": "gmail"}
    )

    assert count1 == count2
    assert comms == count1


def test_auto_sync_disabled(client, monkeypatch):
    email, password = register_user(client, suffix=_uid("auto-off"))
    _connect_gmail(client, email, password)
    monkeypatch.setenv("GMAIL_AUTO_SYNC_ENABLED", "false")

    result = _auto_sync_for(email)

    assert result["enabled"] is False
    assert result["processed"] == 0
    account = _account_for_email(email)
    assert account.get("lastSuccessfulSyncAt") is None


def test_batch_size_respected(client, monkeypatch):
    monkeypatch.setenv("GMAIL_AUTO_SYNC_BATCH_SIZE", "2")
    emails = []
    for i in range(3):
        email, password = register_user(client, suffix=_uid(f"auto-b{i}"))
        _connect_gmail(client, email, password)
        emails.append(email)
        client.post("/api/auth/logout")

    past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    ids = [_account_for_email(e)["id"] for e in emails]
    user_ids = [_user_id(e) for e in emails]
    _mongo().connected_accounts.update_many(
        {"id": {"$in": ids}},
        {"$set": {"nextSyncAt": past}},
    )

    motor_client, db = _motor()
    try:
        eligible = _run(list_eligible_gmail_accounts(db, limit=2, user_ids=user_ids))
        assert len(eligible) == 2
        result = _run(run_gmail_auto_sync(db, user_ids=user_ids))
    finally:
        motor_client.close()

    assert result["eligible"] == 2
    assert result["processed"] + result["locked"] <= 2


def test_new_mail_creates_prospect_and_links_known_client(client):
    email, password = register_user(client, suffix=_uid("auto-pr"))
    login_user(client, email, password)
    client.post(
        "/api/clients",
        json={"name": "Jean Martin", "email": "jean@martin.fr", "status": "active"},
    )
    _connect_gmail(client, email, password)

    _auto_sync_for(email)
    account = _account_for_email(email)
    _mongo().connected_accounts.update_one(
        {"id": account["id"]},
        {"$set": {"nextSyncAt": (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()}},
    )
    append_mock_gmail_message(
        RemoteEmailMessage(
            sourceId="gmail-msg-new-prospect",
            threadId="t-new-p",
            subject="Devis urgent",
            snippet="Bonjour",
            fromEmail="inconnu.auto@example.fr",
            fromName="Inconnu Auto",
            toEmails=["artisan@gmail.com"],
            direction="inbound",
            sentAt="2026-08-05T12:00:00+00:00",
        )
    )
    _auto_sync_for(email)

    user_id = account["userId"]
    linked = _mongo().communications.find_one(
        {
            "userId": user_id,
            "provider": "gmail",
            "providerId": "gmail-msg-1",
            "clientId": {"$ne": None},
        }
    )
    assert linked is not None
    unknown = _mongo().communications.find_one(
        {"userId": user_id, "provider": "gmail", "providerId": "gmail-msg-new-prospect"}
    )
    assert unknown is not None
    assert unknown.get("clientId") in (None, "")

    login_user(client, email, password)
    prospects = client.get("/api/prospects")
    assert prospects.status_code == 200
    payload = prospects.json()
    items = payload.get("items") if isinstance(payload, dict) else payload
    assert isinstance(items, list)
    assert len(items) >= 1


def test_compute_next_sync_at_uses_interval():
    now = datetime(2026, 8, 5, 12, 0, tzinfo=timezone.utc)
    nxt = compute_next_sync_at(consecutive_errors=0, interval_minutes=10, now=now)
    assert nxt.startswith("2026-08-05T12:10:00")
