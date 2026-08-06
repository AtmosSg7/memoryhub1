"""Action Engine — rules, idempotency, API, hooks (no AI, channel-agnostic)."""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient

from action_engine.constants import (
    ACTION_TYPE_CALL_BACK,
    ACTION_TYPE_CREATE_INVOICE_FROM_QUOTE,
    ACTION_TYPE_FOLLOW_UP_OVERDUE_INVOICE,
    ACTION_TYPE_READ_CLIENT_REPLY,
    ACTION_TYPE_REPLY_TO_PROSPECT,
)
from action_engine.engine import (
    evaluate_communication,
    evaluate_invoice,
    evaluate_quote,
)
from action_engine.rules import propose_actions
from tests.conftest import create_client_record, login_user, register_user


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
def _enable_engine(monkeypatch):
    monkeypatch.setenv("ACTION_ENGINE_ENABLED", "true")
    monkeypatch.setenv("ACTION_RULE_REPLY_TO_PROSPECT", "true")
    monkeypatch.setenv("ACTION_RULE_READ_CLIENT_REPLY", "true")
    monkeypatch.setenv("ACTION_RULE_CALL_BACK", "true")
    monkeypatch.setenv("ACTION_RULE_FOLLOW_UP_OVERDUE_INVOICE", "true")
    monkeypatch.setenv("ACTION_RULE_CREATE_INVOICE_FROM_QUOTE", "true")


def _comm(
    user_id: str,
    *,
    client_id=None,
    direction="inbound",
    ctype="email",
    subject="Bonjour",
    from_email="inconnu@example.fr",
    ignored=False,
    missed=False,
    comm_id=None,
):
    cid = comm_id or str(uuid.uuid4())
    meta = {
        "fromEmail": from_email,
        "fromName": "Contact",
        "channel": ctype,
    }
    if client_id:
        meta["clientName"] = "Client Test"
    if missed:
        meta["missed"] = True
    doc = {
        "id": cid,
        "userId": user_id,
        "clientId": client_id,
        "type": ctype,
        "direction": direction,
        "provider": "test",
        "providerId": f"prov-{cid}",
        "subject": subject,
        "preview": "…",
        "createdAt": _now(),
        "updatedAt": _now(),
        "attachmentsCount": 0,
        "metadata": meta,
        "status": "ignored" if ignored else ("linked" if client_id else "unlinked"),
    }
    if ignored:
        doc["ignoredAt"] = _now()
    return doc


def test_rule_reply_to_prospect_pure():
    user_id = str(uuid.uuid4())
    proposals = propose_actions({"communication": _comm(user_id)})
    types = [p["type"] for p in proposals]
    assert ACTION_TYPE_REPLY_TO_PROSPECT in types
    assert ACTION_TYPE_READ_CLIENT_REPLY not in types


def test_rule_read_client_reply_pure():
    user_id = str(uuid.uuid4())
    client_id = str(uuid.uuid4())
    proposals = propose_actions(
        {"communication": _comm(user_id, client_id=client_id, from_email="jean@martin.fr")}
    )
    types = [p["type"] for p in proposals]
    assert ACTION_TYPE_READ_CLIENT_REPLY in types
    assert ACTION_TYPE_REPLY_TO_PROSPECT not in types


def test_rule_ignores_noise_and_outbound():
    user_id = str(uuid.uuid4())
    noise = _comm(user_id, from_email="noreply@fournisseur.example", subject="Newsletter")
    assert propose_actions({"communication": noise}) == []
    outbound = _comm(user_id, direction="outbound")
    assert propose_actions({"communication": outbound}) == []


def test_rule_call_back_missed_phone():
    user_id = str(uuid.uuid4())
    proposals = propose_actions(
        {
            "communication": _comm(
                user_id, ctype="phone", subject="Appel manqué", missed=True
            ),
            "missedCall": True,
        }
    )
    assert any(p["type"] == ACTION_TYPE_CALL_BACK for p in proposals)


def test_rule_overdue_invoice_and_accepted_quote():
    user_id = str(uuid.uuid4())
    inv = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "status": "overdue",
        "number": "F-1",
        "clientId": str(uuid.uuid4()),
        "clientName": "ACME",
        "amountTTC": 12000,
    }
    assert any(
        p["type"] == ACTION_TYPE_FOLLOW_UP_OVERDUE_INVOICE
        for p in propose_actions({"invoice": inv})
    )
    quote = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "status": "accepted",
        "number": "D-1",
        "clientId": inv["clientId"],
        "clientName": "ACME",
        "amountTTC": 12000,
    }
    assert any(
        p["type"] == ACTION_TYPE_CREATE_INVOICE_FROM_QUOTE
        for p in propose_actions({"quote": quote})
    )
    quote["invoiceId"] = "already"
    assert propose_actions({"quote": quote}) == []


def test_persist_idempotent(client):
    email, password = register_user(client, suffix=_uid("ae-idemp"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})
    comm = _comm(user["id"])

    motor_client, db = _motor()
    try:
        first = _run(evaluate_communication(db, comm))
        second = _run(evaluate_communication(db, comm))
    finally:
        motor_client.close()

    assert first["created"] == 1
    assert second["created"] == 0
    assert second["skipped"] >= 1
    count = _mongo().actions.count_documents(
        {"userId": user["id"], "type": ACTION_TYPE_REPLY_TO_PROSPECT}
    )
    assert count == 1


def test_upsert_communication_hook_creates_action(client):
    email, password = register_user(client, suffix=_uid("ae-hook"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})

    from communication_center import upsert_communication

    motor_client, db = _motor()
    try:
        doc = _comm(user["id"], subject="Devis cuisine")
        _run(upsert_communication(db, doc))
    finally:
        motor_client.close()

    actions = list(
        _mongo().actions.find(
            {"userId": user["id"], "type": ACTION_TYPE_REPLY_TO_PROSPECT},
            {"_id": 0},
        )
    )
    assert len(actions) == 1
    assert actions[0]["status"] == "pending"
    assert actions[0]["communicationId"] == doc["id"]


def test_api_list_complete_dismiss(client):
    email, password = register_user(client, suffix=_uid("ae-api"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})
    owned = create_client_record(client, name="Client API")

    motor_client, db = _motor()
    try:
        _run(
            evaluate_communication(
                db,
                _comm(
                    user["id"],
                    client_id=owned["id"],
                    from_email="client@api.fr",
                    subject="Suite devis",
                ),
            )
        )
    finally:
        motor_client.close()

    listed = client.get("/api/actions?status=pending")
    assert listed.status_code == 200, listed.text
    items = listed.json()["items"]
    assert len(items) >= 1
    action_id = items[0]["id"]
    assert items[0]["type"] == ACTION_TYPE_READ_CLIENT_REPLY

    count = client.get("/api/actions/count?status=pending")
    assert count.status_code == 200
    assert count.json()["total"] >= 1

    done = client.post(f"/api/actions/{action_id}/complete")
    assert done.status_code == 200
    assert done.json()["status"] == "completed"

    # Recreate same fact → still no duplicate pending
    motor_client, db = _motor()
    try:
        _run(
            evaluate_communication(
                db,
                _comm(
                    user["id"],
                    client_id=owned["id"],
                    from_email="client@api.fr",
                    subject="Suite devis",
                    comm_id=items[0]["communicationId"],
                ),
            )
        )
    finally:
        motor_client.close()
    pending = client.get("/api/actions?status=pending&type=read_client_reply")
    assert pending.json()["total"] == 0

    # New communication → dismiss flow
    motor_client, db = _motor()
    try:
        result = _run(
            evaluate_communication(
                db,
                _comm(user["id"], subject="Autre prospect"),
            )
        )
    finally:
        motor_client.close()
    assert result["created"] == 1
    dismiss_id = result["actions"][0].id
    dismissed = client.post(f"/api/actions/{dismiss_id}/dismiss")
    assert dismissed.status_code == 200
    assert dismissed.json()["status"] == "dismissed"


def test_quote_accept_creates_action(client):
    email, password = register_user(client, suffix=_uid("ae-quote"))
    login_user(client, email, password)
    owned = create_client_record(client, name="Client Devis")
    created = client.post(
        "/api/quotes",
        json={
            "clientId": owned["id"],
            "title": "Travaux",
            "amountHT": 10000,
            "vatRate": 20,
            "status": "draft",
        },
    )
    assert created.status_code in (200, 201), created.text
    quote_id = created.json()["id"]
    sent = client.put(f"/api/quotes/{quote_id}", json={"status": "sent"})
    assert sent.status_code == 200, sent.text
    accepted = client.put(f"/api/quotes/{quote_id}", json={"status": "accepted"})
    assert accepted.status_code == 200, accepted.text

    user = _mongo().users.find_one({"email": email.lower()})
    action = _mongo().actions.find_one(
        {
            "userId": user["id"],
            "type": ACTION_TYPE_CREATE_INVOICE_FROM_QUOTE,
            "idempotencyKey": f"{ACTION_TYPE_CREATE_INVOICE_FROM_QUOTE}:{quote_id}",
        },
        {"_id": 0},
    )
    assert action is not None
    assert action["status"] == "pending"


def test_overdue_invoice_creates_action(client):
    email, password = register_user(client, suffix=_uid("ae-inv"))
    login_user(client, email, password)
    owned = create_client_record(client, name="Client Facture")
    old = (datetime.now(timezone.utc) - timedelta(days=45)).date().isoformat()
    created = client.post(
        "/api/invoices",
        json={
            "clientId": owned["id"],
            "title": "Presta",
            "amountHT": 5000,
            "vatRate": 20,
            "status": "in_progress",
            "invoiceDate": old,
        },
    )
    assert created.status_code in (200, 201), created.text
    invoice_id = created.json()["id"]

    from commercial_lifecycle import sync_overdue_invoices

    motor_client, db = _motor()
    try:
        user = _mongo().users.find_one({"email": email.lower()})
        n = _run(sync_overdue_invoices(db, user_id=user["id"]))
    finally:
        motor_client.close()

    assert n >= 1
    action = _mongo().actions.find_one(
        {
            "userId": user["id"],
            "type": ACTION_TYPE_FOLLOW_UP_OVERDUE_INVOICE,
            "idempotencyKey": f"{ACTION_TYPE_FOLLOW_UP_OVERDUE_INVOICE}:{invoice_id}",
        },
        {"_id": 0},
    )
    assert action is not None
    assert action["priority"] == "urgent"


def test_engine_disabled(monkeypatch, client):
    monkeypatch.setenv("ACTION_ENGINE_ENABLED", "false")
    email, password = register_user(client, suffix=_uid("ae-off"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})

    motor_client, db = _motor()
    try:
        result = _run(evaluate_communication(db, _comm(user["id"])))
    finally:
        motor_client.close()

    assert result["created"] == 0
    assert _mongo().actions.count_documents({"userId": user["id"]}) == 0


def test_rule_disabled(monkeypatch, client):
    monkeypatch.setenv("ACTION_RULE_REPLY_TO_PROSPECT", "false")
    email, password = register_user(client, suffix=_uid("ae-rule-off"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})

    motor_client, db = _motor()
    try:
        result = _run(evaluate_communication(db, _comm(user["id"])))
    finally:
        motor_client.close()

    assert result["created"] == 0


def test_evaluate_api_idempotent(client):
    email, password = register_user(client, suffix=_uid("ae-eval"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})
    doc = _comm(user["id"])
    _mongo().communications.insert_one(doc)

    first = client.post(f"/api/actions/evaluate/communication/{doc['id']}")
    assert first.status_code == 200, first.text
    assert first.json()["created"] == 1
    second = client.post(f"/api/actions/evaluate/communication/{doc['id']}")
    assert second.status_code == 200
    assert second.json()["created"] == 0


def test_whatsapp_channel_same_rules():
    """Rules must not depend on Gmail — WhatsApp inbound unknown → reply."""
    user_id = str(uuid.uuid4())
    proposals = propose_actions(
        {
            "communication": _comm(
                user_id,
                ctype="whatsapp",
                from_email=None,
                subject="Message WhatsApp",
            )
        }
    )
    # fromEmail None — noise classifier should not block non-email channels if no email
    # Our _comm still sets fromEmail; use phone-like whatsapp without noise email
    proposals = propose_actions(
        {
            "communication": {
                **_comm(user_id, ctype="whatsapp", subject="Dispo demain ?"),
                "metadata": {"fromName": "Paul", "channel": "whatsapp"},
            }
        }
    )
    assert any(p["type"] == ACTION_TYPE_REPLY_TO_PROSPECT for p in proposals)


def _create_pending_action(client, user_id: str) -> str:
    motor_client, db = _motor()
    try:
        result = _run(evaluate_communication(db, _comm(user_id, subject="À reporter")))
    finally:
        motor_client.close()
    assert result["created"] == 1
    return result["actions"][0].id


def test_snooze_future_excludes_from_active_list_and_count(client):
    email, password = register_user(client, suffix=_uid("ae-snooze"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})
    action_id = _create_pending_action(client, user["id"])

    before_count = client.get("/api/actions/count?status=pending")
    assert before_count.status_code == 200
    assert before_count.json()["total"] >= 1

    until = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    snoozed = client.post(f"/api/actions/{action_id}/snooze", json={"until": until})
    assert snoozed.status_code == 200, snoozed.text
    body = snoozed.json()
    assert body["status"] == "pending"
    assert body["snoozedUntil"]
    assert body["snoozedBy"] == user["id"]
    assert body["snoozedAt"]

    listed = client.get("/api/actions?status=pending")
    assert listed.status_code == 200
    assert all(item["id"] != action_id for item in listed.json()["items"])

    after_count = client.get("/api/actions/count?status=pending")
    assert after_count.json()["total"] == before_count.json()["total"] - 1

    snoozed_only = client.get("/api/actions?status=pending&snoozedOnly=true")
    assert snoozed_only.status_code == 200
    assert any(item["id"] == action_id for item in snoozed_only.json()["items"])

    included = client.get("/api/actions?status=pending&includeSnoozed=true")
    assert any(item["id"] == action_id for item in included.json()["items"])


def test_snooze_rejects_past_and_invalid(client):
    email, password = register_user(client, suffix=_uid("ae-snooze-past"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})
    action_id = _create_pending_action(client, user["id"])

    past = client.post(
        f"/api/actions/{action_id}/snooze",
        json={"until": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()},
    )
    assert past.status_code == 422
    assert past.json()["detail"]["code"] == "until_must_be_future"

    invalid = client.post(
        f"/api/actions/{action_id}/snooze",
        json={"until": "not-a-date"},
    )
    assert invalid.status_code == 422


def test_snooze_reappears_after_until(client):
    email, password = register_user(client, suffix=_uid("ae-snooze-back"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})
    action_id = _create_pending_action(client, user["id"])

    until = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat()
    assert client.post(f"/api/actions/{action_id}/snooze", json={"until": until}).status_code == 200

    # Simulate elapsed snooze window (read-time filter, no cron).
    past_until = (datetime.now(timezone.utc) - timedelta(minutes=5)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    _mongo().actions.update_one(
        {"userId": user["id"], "id": action_id},
        {"$set": {"snoozedUntil": past_until}},
    )

    listed = client.get("/api/actions?status=pending")
    assert any(item["id"] == action_id for item in listed.json()["items"])
    count = client.get("/api/actions/count?status=pending")
    assert count.json()["total"] >= 1


def test_snooze_replace_then_complete_and_dismiss(client):
    email, password = register_user(client, suffix=_uid("ae-snooze-replace"))
    login_user(client, email, password)
    user = _mongo().users.find_one({"email": email.lower()})
    action_id = _create_pending_action(client, user["id"])

    first_until = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    second_until = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    first = client.post(f"/api/actions/{action_id}/snooze", json={"until": first_until})
    assert first.status_code == 200
    second = client.post(f"/api/actions/{action_id}/snooze", json={"until": second_until})
    assert second.status_code == 200
    assert second.json()["snoozedUntil"] != first.json()["snoozedUntil"]

    # Complete clears snooze fields.
    done = client.post(f"/api/actions/{action_id}/complete")
    assert done.status_code == 200
    assert done.json()["status"] == "completed"
    assert done.json().get("snoozedUntil") in (None, "")

    # Fresh action → snooze then dismiss
    other_id = _create_pending_action(client, user["id"])
    assert (
        client.post(
            f"/api/actions/{other_id}/snooze",
            json={"until": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()},
        ).status_code
        == 200
    )
    dismissed = client.post(f"/api/actions/{other_id}/dismiss")
    assert dismissed.status_code == 200
    assert dismissed.json()["status"] == "dismissed"
    assert dismissed.json().get("snoozedUntil") in (None, "")


def test_snooze_user_isolation(client):
    email_a, password_a = register_user(client, suffix=_uid("ae-snooze-a"))
    login_user(client, email_a, password_a)
    user_a = _mongo().users.find_one({"email": email_a.lower()})
    action_id = _create_pending_action(client, user_a["id"])

    email_b, password_b = register_user(client, suffix=_uid("ae-snooze-b"))
    login_user(client, email_b, password_b)

    until = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    forbidden = client.post(f"/api/actions/{action_id}/snooze", json={"until": until})
    assert forbidden.status_code == 404

    listed_b = client.get("/api/actions?status=pending")
    assert all(item["id"] != action_id for item in listed_b.json()["items"])


def test_invoice_and_quote_evaluate_helpers():
    user_id = str(uuid.uuid4())
    motor_client, db = _motor()
    try:
        inv_result = _run(
            evaluate_invoice(
                db,
                {
                    "id": str(uuid.uuid4()),
                    "userId": user_id,
                    "status": "overdue",
                    "number": "F-9",
                    "clientName": "X",
                },
            )
        )
        quote_result = _run(
            evaluate_quote(
                db,
                {
                    "id": str(uuid.uuid4()),
                    "userId": user_id,
                    "status": "accepted",
                    "number": "D-9",
                    "clientName": "X",
                },
            )
        )
    finally:
        motor_client.close()

    assert inv_result["created"] == 1
    assert quote_result["created"] == 1
