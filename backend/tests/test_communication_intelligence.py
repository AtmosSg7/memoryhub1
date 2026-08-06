"""Communication Intelligence — analyze, suggest, accept/reject (no auto side-effects)."""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone

import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient

from communication_intelligence.eligibility import eligibility_for_analysis
from communication_intelligence.hashing import build_content_hash
from communication_intelligence.mapping import map_intent_to_suggestion
from communication_intelligence.service import COLLECTION, analyze_communication
from credit_cost_service import seed_default_costs
from tests.conftest import login_user, register_user

_LOOP = None


def _loop():
    global _LOOP
    if _LOOP is None or _LOOP.is_closed():
        _LOOP = asyncio.new_event_loop()
        asyncio.set_event_loop(_LOOP)
    return _LOOP


def _run(coro):
    return _loop().run_until_complete(coro)


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _motor():
    _loop()
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client, client[os.environ["DB_NAME"]]


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@pytest.fixture(autouse=True)
def _enable_ci(monkeypatch):
    monkeypatch.setenv("COMMUNICATION_INTELLIGENCE_ENABLED", "true")
    monkeypatch.setenv("COMMUNICATION_INTELLIGENCE_AUTO_ON_INGEST", "false")
    monkeypatch.setenv("COMMUNICATION_INTELLIGENCE_PROVIDER", "mock")
    monkeypatch.setenv("CREDITS_ENFORCED", "false")


def _insert_comm(
    user_id: str,
    *,
    direction="inbound",
    subject="Demande de devis pour une cuisine",
    preview="Bonjour, pourriez-vous me faire un devis ?",
    from_email="prospect@example.fr",
    ignored=False,
    provider="gmail",
):
    cid = str(uuid.uuid4())
    doc = {
        "id": cid,
        "userId": user_id,
        "clientId": None,
        "type": "email",
        "direction": direction,
        "provider": provider,
        "providerId": f"gmail-{cid}",
        "subject": subject,
        "preview": preview,
        "createdAt": _now(),
        "updatedAt": _now(),
        "attachmentsCount": 0,
        "status": "ignored" if ignored else "unlinked",
        "metadata": {
            "fromEmail": from_email,
            "fromName": "Marie Prospect",
            "source": "gmail",
            "channel": "email",
        },
    }
    if ignored:
        doc["ignoredAt"] = _now()
    _mongo().communications.insert_one(doc)
    return doc


def test_eligibility_skips_outbound_and_noise():
    ok, reason = eligibility_for_analysis(
        {
            "direction": "outbound",
            "type": "email",
            "subject": "Re:",
            "preview": "ok",
            "metadata": {"fromEmail": "a@b.fr"},
        }
    )
    assert not ok and reason == "outbound_or_internal"

    ok, reason = eligibility_for_analysis(
        {
            "direction": "inbound",
            "type": "email",
            "subject": "Newsletter hebdo",
            "preview": "Désinscription",
            "metadata": {"fromEmail": "noreply@shop.com"},
        }
    )
    assert not ok
    assert reason in {
        "noise_noreply",
        "noise_newsletter",
        "noise_notification",
        "noise_technical",
    }


def test_mapping_intents():
    s = map_intent_to_suggestion("request_quote")
    assert s["type"] == "prepare_quote"
    assert "devis" in s["title"].lower()
    s2 = map_intent_to_suggestion("complaint")
    assert s2["type"] == "handle_complaint"


def test_analyze_relevant_mail_and_idempotent(client):
    email, password = register_user(client, suffix=_uid("ci-ok"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})
    motor_client, db = _motor()
    try:
        _run(seed_default_costs(db))
        comm = _insert_comm(user["id"])
        first = client.post(f"/api/communication-intelligence/{comm['id']}/analyze")
        assert first.status_code == 200, first.text
        body = first.json()
        assert body["status"] == "ready"
        assert body["intent"] == "request_quote"
        assert body["urgency"] in {"low", "normal", "high", "urgent"}
        assert body["summary"]
        assert body["suggestedActionType"] == "prepare_quote"
        assert body["suggestionStatus"] == "pending"
        assert body["contentHash"]

        second = client.post(f"/api/communication-intelligence/{comm['id']}/analyze")
        assert second.status_code == 200
        assert second.json()["id"] == body["id"]
        assert second.json()["contentHash"] == body["contentHash"]
        # Still a single analysis document
        assert (
            _mongo()[COLLECTION].count_documents(
                {"userId": user["id"], "communicationId": comm["id"]}
            )
            == 1
        )
    finally:
        motor_client.close()


def test_analyze_skips_newsletter_and_outbound(client):
    email, password = register_user(client, suffix=_uid("ci-skip"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})
    motor_client, db = _motor()
    try:
        _run(seed_default_costs(db))
        noise = _insert_comm(
            user["id"],
            subject="Newsletter",
            preview="Offres de la semaine",
            from_email="noreply@mailer.com",
        )
        r = client.post(f"/api/communication-intelligence/{noise['id']}/analyze")
        assert r.status_code == 200
        assert r.json()["status"] == "skipped"

        outbound = _insert_comm(
            user["id"],
            direction="outbound",
            subject="Suite à notre échange",
            preview="Voici mon retour",
            from_email="artisan@example.fr",
        )
        r2 = client.post(f"/api/communication-intelligence/{outbound['id']}/analyze")
        assert r2.status_code == 200
        assert r2.json()["status"] == "skipped"
        assert r2.json()["skipReason"] == "outbound_or_internal"
    finally:
        motor_client.close()


def test_ai_error_non_blocking_and_retry(client, monkeypatch):
    email, password = register_user(client, suffix=_uid("ci-err"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})
    motor_client, db = _motor()
    try:
        _run(seed_default_costs(db))
        comm = _insert_comm(user["id"])

        async def boom(_communication):
            raise RuntimeError("simulated_openai_down")

        monkeypatch.setattr(
            "communication_intelligence.service.run_analyzer",
            boom,
        )
        failed = client.post(f"/api/communication-intelligence/{comm['id']}/analyze")
        assert failed.status_code == 200, failed.text
        assert failed.json()["status"] == "error"
        # Communication still present
        assert _mongo().communications.find_one({"id": comm["id"]}) is not None

        monkeypatch.setattr(
            "communication_intelligence.service.run_analyzer",
            __import__(
                "communication_intelligence.analyzer", fromlist=["run_analyzer"]
            ).run_analyzer,
        )
        retried = client.post(
            f"/api/communication-intelligence/{comm['id']}/analyze",
            json={"force": True},
        )
        assert retried.status_code == 200
        assert retried.json()["status"] == "ready"
    finally:
        motor_client.close()


def test_accept_creates_idempotent_action_and_reject(client):
    email, password = register_user(client, suffix=_uid("ci-accept"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})
    motor_client, db = _motor()
    try:
        _run(seed_default_costs(db))
        comm = _insert_comm(
            user["id"],
            subject="Pouvez-vous me rappeler demain ?",
            preview="Merci de me rappeler",
        )
        analyzed = client.post(f"/api/communication-intelligence/{comm['id']}/analyze")
        assert analyzed.status_code == 200
        assert analyzed.json()["intent"] == "request_callback"

        first = client.post(f"/api/communication-intelligence/{comm['id']}/accept")
        assert first.status_code == 200, first.text
        assert first.json()["created"] is True
        action_id = first.json()["action"]["id"]
        assert first.json()["analysis"]["suggestionStatus"] == "accepted"

        second = client.post(f"/api/communication-intelligence/{comm['id']}/accept")
        assert second.status_code == 200
        assert second.json()["created"] is False
        assert second.json()["action"]["id"] == action_id
        assert (
            _mongo().actions.count_documents(
                {
                    "userId": user["id"],
                    "idempotencyKey": f"ci_accept:{comm['id']}:request_callback",
                }
            )
            == 1
        )

        # Reject path on another mail
        other = _insert_comm(
            user["id"],
            subject="Question sur le chantier",
            preview="Comment avance le chantier ?",
        )
        client.post(f"/api/communication-intelligence/{other['id']}/analyze")
        rejected = client.post(f"/api/communication-intelligence/{other['id']}/reject")
        assert rejected.status_code == 200
        assert rejected.json()["suggestionStatus"] == "rejected"
        conflict = client.post(f"/api/communication-intelligence/{other['id']}/accept")
        assert conflict.status_code == 409
    finally:
        motor_client.close()


def test_user_isolation_and_feature_flag(client, monkeypatch):
    email_a, password_a = register_user(client, suffix=_uid("ci-a"))
    login_user(client, email_a, password_a)
    user_a = _mongo().users.find_one({"email": email_a.lower()})
    motor_client, db = _motor()
    try:
        _run(seed_default_costs(db))
        comm = _insert_comm(user_a["id"])
        assert (
            client.post(f"/api/communication-intelligence/{comm['id']}/analyze").status_code
            == 200
        )

        email_b, password_b = register_user(client, suffix=_uid("ci-b"))
        login_user(client, email_b, password_b)
        forbidden = client.get(f"/api/communication-intelligence/{comm['id']}")
        assert forbidden.status_code == 404

        monkeypatch.setenv("COMMUNICATION_INTELLIGENCE_ENABLED", "false")
        disabled = client.post(f"/api/communication-intelligence/{comm['id']}/analyze")
        assert disabled.status_code == 403
    finally:
        motor_client.close()


def test_daily_quota(client, monkeypatch):
    monkeypatch.setenv("COMMUNICATION_INTELLIGENCE_DAILY_LIMIT", "1")
    email, password = register_user(client, suffix=_uid("ci-quota"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})
    motor_client, db = _motor()
    try:
        _run(seed_default_costs(db))
        c1 = _insert_comm(user["id"], subject="Devis 1", preview="Besoin d'un devis")
        c2 = _insert_comm(user["id"], subject="Devis 2", preview="Autre devis svp")
        assert (
            client.post(f"/api/communication-intelligence/{c1['id']}/analyze").status_code
            == 200
        )
        limited = client.post(f"/api/communication-intelligence/{c2['id']}/analyze")
        assert limited.status_code == 429
        assert limited.json()["detail"]["code"] == "quota_exceeded"
    finally:
        motor_client.close()


def test_logs_omit_message_body(client, caplog):
    email, password = register_user(client, suffix=_uid("ci-log"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})
    motor_client, db = _motor()
    secret = "SECRET_BODY_SHOULD_NOT_APPEAR_IN_LOGS_XYZ"
    try:
        _run(seed_default_costs(db))
        comm = _insert_comm(
            user["id"],
            subject="Devis urgent",
            preview=secret,
        )
        with caplog.at_level(logging.INFO):
            client.post(f"/api/communication-intelligence/{comm['id']}/analyze")
        joined = " ".join(r.message for r in caplog.records)
        assert secret not in joined
    finally:
        motor_client.close()


def test_content_hash_changes_with_preview():
    base = {
        "subject": "A",
        "preview": "one",
        "direction": "inbound",
        "clientId": None,
        "metadata": {"fromEmail": "a@b.fr"},
    }
    h1 = build_content_hash(base, version="1.0.0")
    h2 = build_content_hash({**base, "preview": "two"}, version="1.0.0")
    assert h1 != h2


def test_ingest_hook_does_not_raise_when_disabled(client, monkeypatch):
    monkeypatch.setenv("COMMUNICATION_INTELLIGENCE_ENABLED", "false")
    from communication_center import upsert_communication

    email, password = register_user(client, suffix=_uid("ci-hook"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})
    motor_client, db = _motor()
    try:
        doc = _insert_comm(user["id"])
        # Re-upsert via center should not raise
        _run(upsert_communication(db, {**doc, "preview": "updated"}))
    finally:
        motor_client.close()
