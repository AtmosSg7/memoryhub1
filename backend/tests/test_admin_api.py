"""Admin API — security, metrics, actions, exports."""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone

import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient

from tests.conftest import login_user, register_user

from admin_constants import COLLECTION_ADMIN_AUDIT_LOGS, COLLECTION_AI_USAGE_EVENTS, USER_ROLE_ADMIN
from email_constants import COLLECTION_EMAIL_EVENTS
from ai_usage_event_service import record_ai_usage_event

_mongo_async = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
_async_db = _mongo_async[os.environ.get("DB_NAME", "memoryhub_test")]
_async_loop = asyncio.new_event_loop()


def _run_async(coro):
    return _async_loop.run_until_complete(coro)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _motor_db():
    return _async_db


def _make_admin(email: str) -> None:
    _db().users.update_one({"email": email.lower()}, {"$set": {"role": USER_ROLE_ADMIN}})


def _register_target(client, suffix: str):
    """Register a user without replacing the current session cookie."""
    email = f"pytest-{suffix}@example.com"
    doc = {
        "id": str(uuid.uuid4()),
        "firstName": "Target",
        "lastName": "User",
        "companyName": "Target Co",
        "email": email,
        "passwordHash": "$2b$12$dummy",  # not used in admin tests
        "emailVerified": True,
        "role": "user",
        "accountStatus": "active",
        "createdAt": "2026-01-01T00:00:00+00:00",
        "updatedAt": "2026-01-01T00:00:00+00:00",
    }
    _db().users.insert_one(doc)
    return email, doc


def _admin_headers(client):
    suffix = uuid.uuid4().hex[:8]
    email, password = register_user(client, suffix=f"admin-{suffix}")
    _make_admin(email)
    login_user(client, email, password)
    return email


@pytest.fixture
def normal_user(client):
    email, password = register_user(client, suffix=f"user-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)
    return email


@pytest.fixture
def admin_session(client):
    _admin_headers(client)


ADMIN_ROUTES = [
    "/api/admin/overview",
    "/api/admin/users",
    "/api/admin/subscriptions",
    "/api/admin/ai-usage",
    "/api/admin/imports",
    "/api/admin/credits",
    "/api/admin/emails",
    "/api/admin/errors",
    "/api/admin/system-health",
]


def test_normal_user_forbidden_on_admin_routes(client, normal_user):
    for path in ADMIN_ROUTES:
        res = client.get(path)
        assert res.status_code == 403, path


def test_admin_can_access_overview(client, admin_session):
    res = client.get("/api/admin/overview?period=30d")
    assert res.status_code == 200
    body = res.json()
    assert "users" in body
    assert "mrr" in body
    assert "alerts" in body


def test_admin_users_paginated(client, admin_session):
    res = client.get("/api/admin/users?page=1&pageSize=10")
    assert res.status_code == 200
    body = res.json()
    assert "items" in body
    assert body["page"] == 1
    assert body["pageSize"] == 10


def test_admin_grant_credits_requires_reason(client, admin_session):
    _, target = _register_target(client, f"target-reason-{uuid.uuid4().hex[:8]}")
    res = client.post(
        f"/api/admin/users/{target['id']}/grant-credits",
        json={"credits": 10, "reason": "ab"},
    )
    assert res.status_code == 422


def test_admin_grant_credits_audited(client, admin_session):
    _, target = _register_target(client, f"grant-{uuid.uuid4().hex[:8]}")
    res = client.post(
        f"/api/admin/users/{target['id']}/grant-credits",
        json={"credits": 25, "reason": "Support compensation test"},
    )
    assert res.status_code == 200
    audit = _db()[COLLECTION_ADMIN_AUDIT_LOGS].find_one({"action": "grant_credits", "targetId": target["id"]})
    assert audit is not None
    assert audit.get("reason") == "Support compensation test"


def test_admin_suspend_and_resume(client, admin_session):
    target_email, target = _register_target(client, f"susp-{uuid.uuid4().hex[:8]}")
    from auth import hash_password

    _db().users.update_one(
        {"id": target["id"]},
        {"$set": {"passwordHash": hash_password("PyTestPassword123!")}},
    )

    res = client.post(
        f"/api/admin/users/{target['id']}/suspend",
        json={"reason": "Policy violation test"},
    )
    assert res.status_code == 200
    updated = _db().users.find_one({"id": target["id"]})
    assert updated.get("accountStatus") == "suspended"

    client.post("/api/auth/logout")
    login_res = client.post(
        "/api/auth/login",
        json={"email": target_email, "password": "PyTestPassword123!"},
    )
    assert login_res.status_code == 403

    _admin_headers(client)
    res = client.post(f"/api/admin/users/{target['id']}/resume", json={})
    assert res.status_code == 200
    updated = _db().users.find_one({"id": target["id"]})
    assert updated.get("accountStatus") == "active"


def test_ai_usage_event_idempotent():
    db = _motor_db()
    user_id = str(uuid.uuid4())
    key = f"test-idem-{uuid.uuid4().hex}"

    async def run():
        first = await record_ai_usage_event(
            db,
            user_id=user_id,
            action_key="IMPORT_DOCUMENT",
            model="gpt-4o-mini",
            input_tokens=100,
            output_tokens=50,
            total_tokens=150,
            duration_ms=1200,
            success=True,
            idempotency_key=key,
        )
        second = await record_ai_usage_event(
            db,
            user_id=user_id,
            action_key="IMPORT_DOCUMENT",
            model="gpt-4o-mini",
            input_tokens=100,
            output_tokens=50,
            total_tokens=150,
            duration_ms=1200,
            success=True,
            idempotency_key=key,
        )
        return first, second

    first, second = _run_async(run())
    assert first["id"] == second["id"]
    count = _db()[COLLECTION_AI_USAGE_EVENTS].count_documents({"idempotencyKey": key})
    assert count == 1


def test_ai_cost_unknown_model():
    db = _motor_db()

    async def run():
        return await record_ai_usage_event(
            db,
            user_id=str(uuid.uuid4()),
            action_key="IMPORT_DOCUMENT",
            model="unknown-model-xyz",
            input_tokens=10,
            output_tokens=5,
            total_tokens=15,
            duration_ms=100,
            success=True,
        )

    doc = _run_async(run())
    assert doc["costKnown"] is False
    assert doc["estimatedCostUsd"] is None


def test_admin_export_forbidden_for_normal_user(client, normal_user):
    res = client.get("/api/admin/export/users?period=30d")
    assert res.status_code == 403


def test_admin_export_users_csv(client, admin_session):
    res = client.get("/api/admin/export/users?period=30d")
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    assert "email" in res.text.splitlines()[0]


def test_admin_me_shows_is_admin(client):
    email = _admin_headers(client)
    res = client.get("/api/auth/me")
    assert res.status_code == 200
    assert res.json().get("isAdmin") is True

    client.post("/api/auth/logout")
    user_email, password = register_user(client, suffix=f"nonadmin-{uuid.uuid4().hex[:8]}")
    login_user(client, user_email, password)
    res = client.get("/api/auth/me")
    assert res.json().get("isAdmin") is False


def test_admin_simulate_credits(client, admin_session):
    res = client.post(
        "/api/admin/credits/simulate",
        json={"actionKey": "IMPORT_DOCUMENT", "hypotheticalCost": 20, "period": "30d"},
    )
    assert res.status_code == 200
    body = res.json()
    assert "disclaimer" in body
    assert body["actionKey"] == "IMPORT_DOCUMENT"


def test_admin_invalid_period(client, admin_session):
    res = client.get("/api/admin/overview?period=invalid")
    assert res.status_code == 400


def test_admin_users_credits_available(client, admin_session):
    _, target = _register_target(client, f"credits-{uuid.uuid4().hex[:8]}")
    _db().user_credit_accounts.update_one(
        {"userId": target["id"]},
        {
            "$set": {
                "id": str(uuid.uuid4()),
                "userId": target["id"],
                "monthlyCreditsRemaining": 40,
                "permanentCreditsRemaining": 15,
                "updatedAt": "2026-01-01T00:00:00+00:00",
            }
        },
        upsert=True,
    )
    res = client.get(f"/api/admin/users?q={target['email']}&page=1&pageSize=5")
    assert res.status_code == 200
    items = res.json()["items"]
    match = next((row for row in items if row["id"] == target["id"]), None)
    assert match is not None
    assert match["creditsAvailable"] == 55


def test_admin_emails_maps_recipient_fields(client, admin_session):
    user_id = str(uuid.uuid4())
    event_id = str(uuid.uuid4())
    now_iso = _utc_now_iso()
    _db()[COLLECTION_EMAIL_EVENTS].insert_one(
        {
            "id": event_id,
            "userId": user_id,
            "templateKey": "auth_verify_email",
            "recipient": "founder-test@example.com",
            "status": "failed",
            "attempts": 3,
            "lastErrorCode": "recipient_refused",
            "createdAt": now_iso,
            "updatedAt": now_iso,
        }
    )
    res = client.get("/api/admin/emails?period=30d&status=failed&page=1&pageSize=50")
    assert res.status_code == 200
    row = next((item for item in res.json()["items"] if item["id"] == event_id), None)
    assert row is not None
    assert row["to"] == "founder-test@example.com"
    assert row["lastError"] == "recipient_refused"


def test_admin_import_failures_from_ai_usage(client, admin_session):
    user_id = str(uuid.uuid4())
    now_iso = _utc_now_iso()
    _db()[COLLECTION_AI_USAGE_EVENTS].insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "actionKey": "IMPORT_DOCUMENT",
            "model": "gpt-4o-mini",
            "inputTokens": 10,
            "outputTokens": 5,
            "totalTokens": 15,
            "durationMs": 100,
            "success": False,
            "costKnown": False,
            "estimatedCostUsd": None,
            "createdAt": now_iso,
        }
    )
    res = client.get("/api/admin/overview?period=30d")
    assert res.status_code == 200
    imports = res.json()["imports"]
    assert imports["analysisFailed"] >= 1
    assert imports["failed"] >= 1
