"""Communication Hub V2 — conversations, lifecycle, client inbox, timeline, search."""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient

from communication_center import upsert_from_gmail_email_doc
from communication_hub.conversation_engine import (
    derive_conversation_key,
    merge_participants,
)
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


def _motor():
    _loop()
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client, client[os.environ["DB_NAME"]]


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@pytest.fixture
def hub_user(client: TestClient):
    email, password = register_user(client, suffix=_uid("hub"))
    login_user(client, email, password)
    return email, password


def _seed_gmail(
    db,
    user_id: str,
    *,
    client_id=None,
    thread_id="t-1",
    msg_id=None,
    direction="inbound",
    subject="Devis terrasse",
    preview="Bonjour",
    sent_at=None,
    from_email="alex@example.com",
):
    msg_id = msg_id or f"msg-{uuid.uuid4().hex[:10]}"
    email_doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "provider": "gmail",
        "providerMessageId": msg_id,
        "clientId": client_id,
        "clientName": "Client Hub" if client_id else None,
        "subject": subject,
        "preview": preview,
        "direction": direction,
        "fromEmail": from_email,
        "fromName": "Alex",
        "toEmails": ["artisan@example.com"],
        "ccEmails": ["cc@example.com"],
        "threadId": thread_id,
        "sentAt": sent_at or _now(),
        "attachmentCount": 1,
        "attachments": [
            {"filename": "devis.pdf", "mimeType": "application/pdf", "size": 1200}
        ],
        "gmailUrl": "https://mail.google.com/mail/u/0/#inbox/abc",
    }
    return _run(upsert_from_gmail_email_doc(db, email_doc))


def test_conversation_key_derivation():
    key = derive_conversation_key(
        {
            "type": "email",
            "provider": "gmail",
            "providerId": "x",
            "metadata": {"threadId": "abc123"},
        }
    )
    assert key == "email:gmail:thread:abc123"

    fallback = derive_conversation_key(
        {
            "type": "email",
            "provider": "gmail",
            "providerId": "solo-1",
            "metadata": {},
        }
    )
    assert fallback == "email:gmail:msg:solo-1"


def test_merge_participants_dedupes():
    merged = merge_participants(
        [{"identityKey": "email:a@x.com", "email": "a@x.com", "role": "from"}],
        [
            {"identityKey": "email:a@x.com", "email": "a@x.com", "role": "to"},
            {"identityKey": "email:b@x.com", "email": "b@x.com", "role": "to"},
        ],
    )
    keys = [p["identityKey"] for p in merged]
    assert keys.count("email:a@x.com") == 1
    assert "email:b@x.com" in keys
    assert next(p for p in merged if p["identityKey"] == "email:a@x.com")["role"] == "from"


def test_hub_providers_list(client, hub_user):
    res = client.get("/api/hub/providers")
    assert res.status_code == 200
    ids = {p["providerId"] for p in res.json()["items"]}
    assert {"gmail", "phone", "whatsapp"} <= ids


def test_three_emails_same_thread_one_conversation(client, hub_user):
    mongo = _mongo()
    user = mongo.users.find_one({"email": hub_user[0].lower()})
    user_id = user["id"]
    created = create_client_record(client, name="Entreprise Martin")
    client_id = created["id"]

    motor_client, db = _motor()
    try:
        _seed_gmail(
            db,
            user_id,
            client_id=client_id,
            thread_id="thread-same",
            msg_id="m1",
            sent_at="2026-08-01T10:00:00+00:00",
            preview="Premier",
        )
        _seed_gmail(
            db,
            user_id,
            client_id=client_id,
            thread_id="thread-same",
            msg_id="m2",
            direction="outbound",
            sent_at="2026-08-01T11:00:00+00:00",
            preview="Réponse artisan",
        )
        _seed_gmail(
            db,
            user_id,
            client_id=client_id,
            thread_id="thread-same",
            msg_id="m3",
            sent_at="2026-08-01T12:00:00+00:00",
            preview="Dernier message client",
        )
    finally:
        motor_client.close()

    inbox = client.get(f"/api/hub/clients/{client_id}/inbox").json()
    assert inbox["totalConversations"] == 1
    assert inbox["totalMessages"] >= 3
    conv = inbox["channels"][0]["conversations"][0]
    assert conv["messageCount"] == 3
    assert conv["preview"] == "Dernier message client"
    assert conv["unreadCount"] >= 1

    detail = client.get(f"/api/hub/conversations/{conv['id']}?markRead=true").json()
    assert len(detail["messages"]) == 3
    assert [m["preview"] for m in detail["messages"]] == [
        "Premier",
        "Réponse artisan",
        "Dernier message client",
    ]
    assert len(detail["attachments"]) >= 1

    refreshed = client.get(f"/api/hub/conversations/{conv['id']}").json()
    assert refreshed["conversation"]["unreadCount"] == 0
    assert refreshed["conversation"]["lifecycleStatus"] in {"read", "replied"}


def test_two_threads_two_conversations(client, hub_user):
    mongo = _mongo()
    user = mongo.users.find_one({"email": hub_user[0].lower()})
    user_id = user["id"]
    created = create_client_record(client, name="Deux Fils")
    client_id = created["id"]

    motor_client, db = _motor()
    try:
        _seed_gmail(db, user_id, client_id=client_id, thread_id="ta", msg_id="a1", subject="Devis")
        _seed_gmail(db, user_id, client_id=client_id, thread_id="tb", msg_id="b1", subject="SAV")
    finally:
        motor_client.close()

    inbox = client.get(f"/api/hub/clients/{client_id}/inbox").json()
    assert inbox["totalConversations"] == 2


def test_lifecycle_archive_ignore(client, hub_user):
    mongo = _mongo()
    user = mongo.users.find_one({"email": hub_user[0].lower()})
    user_id = user["id"]
    created = create_client_record(client, name="Lifecycle Co")
    motor_client, db = _motor()
    try:
        doc = _seed_gmail(
            db, user_id, client_id=created["id"], thread_id="life", msg_id="l1"
        )
    finally:
        motor_client.close()

    assert doc.get("lifecycleStatus") == "to_read"
    # Association stays linked while lifecycle changes independently.
    assert doc.get("status") == "linked"

    for status in ("read", "waiting", "archived"):
        res = client.patch(
            f"/api/hub/communications/{doc['id']}/lifecycle",
            json={"lifecycleStatus": status},
        )
        assert res.status_code == 200, res.text
        assert res.json()["lifecycleStatus"] == status

    ignored = client.patch(
        f"/api/hub/communications/{doc['id']}/lifecycle",
        json={"lifecycleStatus": "ignored"},
    )
    assert ignored.status_code == 200
    stored = mongo.communications.find_one({"id": doc["id"]}, {"_id": 0})
    assert stored["lifecycleStatus"] == "ignored"
    assert stored["status"] == "linked"  # association untouched


def test_hub_migrate_idempotent_and_user_isolation(client, hub_user):
    mongo = _mongo()
    user = mongo.users.find_one({"email": hub_user[0].lower()})
    user_id = user["id"]
    created = create_client_record(client, name="Client Migrate")

    other_email, other_password = register_user(client, suffix=_uid("other"))
    other = mongo.users.find_one({"email": other_email.lower()})
    other_comm = str(uuid.uuid4())
    mongo.communications.insert_one(
        {
            "id": other_comm,
            "userId": other["id"],
            "type": "email",
            "direction": "inbound",
            "provider": "gmail",
            "providerId": f"other-{other_comm}",
            "subject": "Autre user",
            "preview": "secret",
            "createdAt": _now(),
            "updatedAt": _now(),
            "attachmentsCount": 0,
            "status": "unlinked",
            "metadata": {"threadId": "other-thread"},
        }
    )

    login_user(client, hub_user[0], hub_user[1])
    comm_id = str(uuid.uuid4())
    mongo.communications.insert_one(
        {
            "id": comm_id,
            "userId": user_id,
            "clientId": created["id"],
            "type": "email",
            "direction": "inbound",
            "provider": "gmail",
            "providerId": f"pre-hub-{comm_id}",
            "subject": "Ancien message",
            "preview": "avant hub",
            "createdAt": _now(),
            "updatedAt": _now(),
            "attachmentsCount": 0,
            "status": "linked",
            "metadata": {
                "threadId": "legacy-thread-1",
                "fromEmail": "old@example.com",
                "toEmails": ["me@example.com"],
            },
        }
    )

    first = client.post("/api/hub/migrate?limit=500")
    assert first.status_code == 200, first.text
    second = client.post("/api/hub/migrate?limit=500")
    assert second.status_code == 200

    stored = mongo.communications.find_one({"id": comm_id}, {"_id": 0})
    assert stored.get("conversationId")
    assert stored.get("lifecycleStatus")
    # communication id never rewritten
    assert stored["id"] == comm_id

    other_stored = mongo.communications.find_one({"id": other_comm}, {"_id": 0})
    assert not other_stored.get("conversationId")

    # Unique conversation for legacy thread
    convs = list(
        mongo.conversations.find(
            {"userId": user_id, "conversationKey": "email:gmail:thread:legacy-thread-1"},
            {"_id": 0},
        )
    )
    assert len(convs) == 1


def test_prospect_to_client_retargets_conversation(client, hub_user):
    mongo = _mongo()
    user = mongo.users.find_one({"email": hub_user[0].lower()})
    user_id = user["id"]

    motor_client, db = _motor()
    try:
        doc = _seed_gmail(
            db,
            user_id,
            client_id=None,
            thread_id="prospect-thread",
            msg_id="p1",
            from_email="prospect@example.com",
        )
    finally:
        motor_client.close()

    created = create_client_record(client, name="Prospect Converted")
    assoc = client.post(
        f"/api/communications/{doc['id']}/associate",
        json={"clientId": created["id"]},
    )
    if assoc.status_code == 404:
        # Alternate route used in some builds
        assoc = client.post(
            f"/api/unlinked-emails/{doc['id']}/associate",
            json={"clientId": created["id"]},
        )
    assert assoc.status_code in (200, 201), assoc.text

    inbox = client.get(f"/api/hub/clients/{created['id']}/inbox")
    assert inbox.status_code == 200, inbox.text
    assert inbox.json()["totalConversations"] >= 1


def test_timeline_collapses_thread(client, hub_user):
    mongo = _mongo()
    user = mongo.users.find_one({"email": hub_user[0].lower()})
    user_id = user["id"]
    created = create_client_record(client, name="Timeline Co")
    client_id = created["id"]

    motor_client, db = _motor()
    try:
        for i in range(3):
            _seed_gmail(
                db,
                user_id,
                client_id=client_id,
                thread_id="tl-thread",
                msg_id=f"tl-{i}",
                sent_at=f"2026-08-0{i+1}T10:00:00+00:00",
            )
    finally:
        motor_client.close()

    res = client.get(f"/api/clients/{client_id}/timeline-v2?category=communications&limit=50")
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    email_items = [i for i in items if i.get("category") == "communications"]
    # One synthetic card for the thread, not three identical floods
    assert len(email_items) == 1
    assert email_items[0]["metadata"].get("messageCount") == 3
    assert email_items[0]["metadata"].get("conversationId")


def test_search_finds_conversation(client, hub_user):
    mongo = _mongo()
    user = mongo.users.find_one({"email": hub_user[0].lower()})
    user_id = user["id"]
    created = create_client_record(client, name="Search Co")
    motor_client, db = _motor()
    try:
        _seed_gmail(
            db,
            user_id,
            client_id=created["id"],
            thread_id="search-thread",
            msg_id="s1",
            subject="Terrasse unique XYZ",
            from_email="searchme@example.com",
        )
    finally:
        motor_client.close()

    res = client.get("/api/search", params={"q": "Terrasse unique XYZ"})
    assert res.status_code == 200, res.text
    groups = res.json()["groups"]
    conv_items = groups.get("conversations", {}).get("items") or []
    assert any("Terrasse" in (i.get("title") or "") for i in conv_items)
    hit = next(i for i in conv_items if "Terrasse" in (i.get("title") or ""))
    assert "conversation=" in (hit.get("navigationTarget") or hit.get("url") or "")


def test_action_idempotent_per_conversation(client, hub_user, monkeypatch):
    monkeypatch.setenv("ACTION_ENGINE_ENABLED", "true")
    monkeypatch.setenv("ACTION_RULE_READ_CLIENT_REPLY", "true")

    mongo = _mongo()
    user = mongo.users.find_one({"email": hub_user[0].lower()})
    user_id = user["id"]
    created = create_client_record(client, name="Actions Co")
    client_id = created["id"]

    motor_client, db = _motor()
    try:
        _seed_gmail(
            db, user_id, client_id=client_id, thread_id="act-thread", msg_id="a1"
        )
        _seed_gmail(
            db, user_id, client_id=client_id, thread_id="act-thread", msg_id="a2"
        )
    finally:
        motor_client.close()

    actions = list(
        mongo.actions.find(
            {
                "userId": user_id,
                "clientId": client_id,
                "type": "read_client_reply",
                "status": "pending",
            },
            {"_id": 0, "idempotencyKey": 1},
        )
    )
    # One pending action for the conversation, not one per message
    assert len(actions) == 1
    assert "conv:" in (actions[0].get("idempotencyKey") or "")
