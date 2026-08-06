"""End-to-end journey: unknown email → prospect → client → reply → no duplicates."""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone

import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

from action_engine.constants import (
    ACTION_STATUS_PENDING,
    ACTION_TYPE_READ_CLIENT_REPLY,
    ACTION_TYPE_REPLY_TO_PROSPECT,
)
from action_engine.engine import evaluate_communication
from tests.conftest import login_user, register_user
from tests.test_prospects import _insert_email_comm

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


@pytest.fixture
def ci_on(monkeypatch):
    monkeypatch.setenv("COMMUNICATION_INTELLIGENCE_ENABLED", "true")
    monkeypatch.setenv("COMMUNICATION_INTELLIGENCE_AUTO_ON_INGEST", "false")
    monkeypatch.setenv("COMMUNICATION_INTELLIGENCE_PROVIDER", "mock")
    monkeypatch.setenv("CREDITS_ENFORCED", "false")
    monkeypatch.setenv("ACTION_ENGINE_ENABLED", "true")


def test_full_unknown_to_client_journey(client, ci_on):
    email, password = register_user(client, suffix=_uid("journey"))
    login_user(client, email, password)
    db_sync = _mongo()
    user_id = db_sync.users.find_one({"email": email.lower()})["id"]
    from_email = f"inconnu.{uuid.uuid4().hex[:6]}@chantier.fr"

    # 1–3: unknown inbound communication (as after Gmail sync upsert)
    comm = _insert_email_comm(
        db_sync,
        user_id=user_id,
        from_email=from_email,
        from_name="Alex Inconnu",
        subject="Devis terrasse Lyon",
        preview="Bonjour, je souhaite un devis pour une terrasse.",
    )
    motor_client, db = _motor()
    try:
        # 5: Action Engine creates reply_to_prospect
        result = _run(evaluate_communication(db, comm))
        assert result["created"] >= 1
    finally:
        motor_client.close()

    pending_actions = list(
        db_sync.actions.find(
            {
                "userId": user_id,
                "status": ACTION_STATUS_PENDING,
                "type": ACTION_TYPE_REPLY_TO_PROSPECT,
            },
            {"_id": 0},
        )
    )
    assert len(pending_actions) == 1
    assert pending_actions[0]["communicationId"] == comm["id"]
    assert not pending_actions[0].get("clientId")

    # 4–6: prospect in Clients potentiels
    prospects = client.get("/api/prospects").json()
    assert prospects["total"] == 1
    prospect = prospects["items"][0]
    prospect_id = prospect["id"]
    assert prospect["email"] == from_email.lower()
    assert client.get("/api/prospects/count", params={"status": "pending"}).json()["total"] == 1

    # 7: CI analysis + accept suggestion (must not twin with reply_to_prospect)
    db_sync.communication_analyses.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "communicationId": comm["id"],
            "status": "ready",
            "suggestionStatus": "pending",
            "summary": "Le contact demande un devis terrasse à Lyon.",
            "intent": "request_quote",
            "urgency": "high",
            "suggestedActionType": "prepare_quote",
            "suggestedActionTitle": "Préparer un devis terrasse",
            "suggestedActionDescription": "Suite mail terrasse Lyon",
            "version": "1.0.0",
            "createdAt": _now(),
            "updatedAt": _now(),
        }
    )
    accept = client.post(f"/api/communication-intelligence/{comm['id']}/accept")
    assert accept.status_code == 200, accept.text
    assert accept.json().get("created") is True

    reply_after_ci = db_sync.actions.count_documents(
        {
            "userId": user_id,
            "communicationId": comm["id"],
            "type": ACTION_TYPE_REPLY_TO_PROSPECT,
            "status": ACTION_STATUS_PENDING,
        }
    )
    assert reply_after_ci == 0, "CI accept must supersede reply_to_prospect"
    ci_actions = list(
        db_sync.actions.find(
            {
                "userId": user_id,
                "communicationId": comm["id"],
                "status": ACTION_STATUS_PENDING,
            },
            {"_id": 0},
        )
    )
    assert len(ci_actions) == 1
    assert ci_actions[0]["idempotencyKey"].startswith("ci_accept:")

    # Second accept is idempotent — still one pending action
    accept2 = client.post(f"/api/communication-intelligence/{comm['id']}/accept")
    assert accept2.status_code == 200
    assert (
        db_sync.actions.count_documents(
            {"userId": user_id, "communicationId": comm["id"], "status": ACTION_STATUS_PENDING}
        )
        == 1
    )

    # 8–10: create client from prospect — link comms + update actions
    created = client.post(
        f"/api/prospects/{prospect_id}/create-client",
        json={"name": "Alex Inconnu", "email": from_email},
    )
    assert created.status_code == 200, created.text
    client_id = created.json()["client"]["id"]
    assert created.json()["association"]["linkedCommunications"] >= 1

    linked_comm = db_sync.communications.find_one({"id": comm["id"]})
    assert linked_comm["clientId"] == client_id

    action_after = db_sync.actions.find_one({"id": ci_actions[0]["id"]}, {"_id": 0})
    assert action_after["clientId"] == client_id
    assert action_after["status"] == ACTION_STATUS_PENDING

    assert client.get("/api/prospects").json()["total"] == 0
    assert client.get("/api/prospects/count", params={"status": "pending"}).json()["total"] == 0

    # 11–12: Timeline V2 + relation summary
    timeline = client.get(f"/api/clients/{client_id}/timeline-v2", params={"limit": 50})
    assert timeline.status_code == 200, timeline.text
    tbody = timeline.json()
    email_items = [i for i in tbody["items"] if i.get("type") == "email_received"]
    assert len(email_items) >= 1
    entity_ids = [i.get("entityId") for i in email_items]
    assert len(entity_ids) == len(set(entity_ids))
    summary = tbody["summary"]
    assert summary.get("communicationCount", 0) >= 1

    # 13: universal search finds client + email
    search = client.get("/api/search", params={"q": "terrasse Lyon"})
    assert search.status_code == 200
    sbody = search.json()
    assert sbody["total"] >= 1
    assert sbody["groups"]["emails"]["total"] >= 1

    # 14–16: new reply from same person auto-links + read_client_reply action
    reply = _insert_email_comm(
        db_sync,
        user_id=user_id,
        from_email=from_email,
        from_name="Alex Inconnu",
        subject="Suite terrasse",
        preview="Merci, je reste disponible.",
        client_id=client_id,
    )
    motor_client, db = _motor()
    try:
        reply_eval = _run(evaluate_communication(db, reply))
        assert reply_eval["created"] >= 1
    finally:
        motor_client.close()

    read_actions = list(
        db_sync.actions.find(
            {
                "userId": user_id,
                "type": ACTION_TYPE_READ_CLIENT_REPLY,
                "communicationId": reply["id"],
                "status": ACTION_STATUS_PENDING,
            },
            {"_id": 0},
        )
    )
    assert len(read_actions) == 1
    assert read_actions[0]["clientId"] == client_id

    # 17: no duplicate communications for same providerId
    twin = {**reply, "id": str(uuid.uuid4())}
    with pytest.raises(DuplicateKeyError):
        db_sync.communications.insert_one(twin)

    timeline2 = client.get(f"/api/clients/{client_id}/timeline-v2", params={"limit": 50}).json()
    email_entities = [
        i.get("entityId")
        for i in timeline2["items"]
        if i.get("category") == "communications" or i.get("type") == "email_received"
    ]
    assert len(email_entities) == len(set(email_entities))


def test_ignored_prospect_does_not_recreate_action(client, ci_on):
    email, password = register_user(client, suffix=_uid("ign-act"))
    login_user(client, email, password)
    db_sync = _mongo()
    user_id = db_sync.users.find_one({"email": email.lower()})["id"]
    from_email = f"ignore.{uuid.uuid4().hex[:6]}@spam.fr"

    first = _insert_email_comm(db_sync, user_id=user_id, from_email=from_email, subject="Premier")
    motor_client, db = _motor()
    try:
        _run(evaluate_communication(db, first))
    finally:
        motor_client.close()

    prospect_id = client.get("/api/prospects").json()["items"][0]["id"]
    ignored = client.post(f"/api/prospects/{prospect_id}/ignore")
    assert ignored.status_code == 200

    assert (
        db_sync.actions.count_documents(
            {
                "userId": user_id,
                "communicationId": first["id"],
                "type": ACTION_TYPE_REPLY_TO_PROSPECT,
                "status": ACTION_STATUS_PENDING,
            }
        )
        == 0
    )

    second = _insert_email_comm(db_sync, user_id=user_id, from_email=from_email, subject="Encore")
    motor_client, db = _motor()
    try:
        _run(evaluate_communication(db, second))
    finally:
        motor_client.close()

    assert (
        db_sync.actions.count_documents(
            {
                "userId": user_id,
                "type": ACTION_TYPE_REPLY_TO_PROSPECT,
                "status": ACTION_STATUS_PENDING,
            }
        )
        == 0
    )
    assert client.get("/api/prospects").json()["total"] == 0


def test_create_client_blocked_while_ignored(client):
    email, password = register_user(client, suffix=_uid("ign-crt"))
    login_user(client, email, password)
    db_sync = _mongo()
    user_id = db_sync.users.find_one({"email": email.lower()})["id"]
    _insert_email_comm(db_sync, user_id=user_id, from_email="blocked@ex.fr")
    prospect_id = client.get("/api/prospects").json()["items"][0]["id"]
    assert client.post(f"/api/prospects/{prospect_id}/ignore").status_code == 200

    blocked = client.post(f"/api/prospects/{prospect_id}/create-client", json={})
    assert blocked.status_code == 400

    assert client.post(f"/api/prospects/{prospect_id}/restore").status_code == 200
    ok = client.post(f"/api/prospects/{prospect_id}/create-client", json={})
    assert ok.status_code == 200, ok.text
