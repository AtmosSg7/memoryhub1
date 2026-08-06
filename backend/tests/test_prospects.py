"""Automatic prospects — grouping, filters, associate/convert, isolation."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

import pytest
from pymongo import MongoClient

from prospects.identity import classify_email_noise, identity_key_for_email
from prospects.service import prospect_id_for
from tests.conftest import create_client_record, login_user, register_user


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _insert_email_comm(
    db,
    *,
    user_id: str,
    from_email: str,
    from_name: str = "",
    subject: str = "Hello",
    preview: str = "Snippet",
    direction: str = "inbound",
    client_id=None,
    to_emails=None,
    provider_id=None,
    created_at=None,
    ignored_at=None,
):
    created_at = created_at or _now()
    provider_id = provider_id or str(uuid.uuid4())
    to_emails = list(to_emails or ["artisan@gmail.com"])
    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "clientId": client_id,
        "type": "email",
        "direction": direction,
        "provider": "gmail",
        "providerId": provider_id,
        "subject": subject,
        "preview": preview,
        "createdAt": created_at,
        "updatedAt": created_at,
        "attachmentsCount": 0,
        "externalUrl": f"https://mail.google.com/mail/u/0/#inbox/{provider_id}",
        "metadata": {
            "fromEmail": from_email,
            "fromName": from_name,
            "toEmail": to_emails[0] if to_emails else None,
            "toEmails": to_emails,
            "threadId": f"thread-{provider_id}",
            "channel": "email",
            "source": "gmail",
            "sourceId": provider_id,
            "accountEmail": "artisan@gmail.com",
        },
        "status": "linked" if client_id else "unlinked",
    }
    if ignored_at:
        doc["ignoredAt"] = ignored_at
        doc["status"] = "ignored"
    db.communications.insert_one(doc)
    return doc


def test_identity_noise_classification():
    assert classify_email_noise(email="noreply@acme.com") == "noreply"
    assert classify_email_noise(email="no-reply@acme.com") == "noreply"
    assert classify_email_noise(email="newsletter@shop.com") == "newsletter"
    assert classify_email_noise(email="alerts@stripe.com") in ("notification", "noreply", "technical")
    assert classify_email_noise(email="jean@martin.fr") is None
    assert identity_key_for_email("Jean@Martin.FR") == "email:jean@martin.fr"


def test_prospects_group_same_unknown_email(client):
    email, password = register_user(client, suffix=_uid("pr-grp"))
    login_user(client, email, password)
    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    user_id = user["id"]

    _insert_email_comm(
        db,
        user_id=user_id,
        from_email="inconnu@exemple.fr",
        from_name="Paul Inconnu",
        subject="Devis 1",
        created_at="2026-07-01T10:00:00+00:00",
    )
    _insert_email_comm(
        db,
        user_id=user_id,
        from_email="Inconnu@Exemple.FR",
        from_name="Paul Inconnu",
        subject="Devis 2",
        created_at="2026-07-02T10:00:00+00:00",
    )
    # Outbound to same person attaches, does not create a second prospect
    _insert_email_comm(
        db,
        user_id=user_id,
        from_email="artisan@gmail.com",
        from_name="Artisan",
        subject="Re: Devis 2",
        direction="outbound",
        to_emails=["inconnu@exemple.fr"],
        created_at="2026-07-02T11:00:00+00:00",
    )

    res = client.get("/api/prospects", params={"status": "pending"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 1
    prospect = body["items"][0]
    assert prospect["email"] == "inconnu@exemple.fr"
    assert prospect["communicationsCount"] == 3
    assert prospect["inboundCount"] == 2
    assert prospect["displayName"] == "Paul Inconnu"
    assert prospect["lastSubject"] == "Re: Devis 2"
    assert prospect["status"] == "pending"

    detail = client.get(f"/api/prospects/{prospect['id']}")
    assert detail.status_code == 200
    assert detail.json()["totalCommunications"] == 3


def test_prospects_two_emails_two_prospects(client):
    email, password = register_user(client, suffix=_uid("pr-two"))
    login_user(client, email, password)
    db = _mongo()
    user_id = db.users.find_one({"email": email.lower()})["id"]

    _insert_email_comm(db, user_id=user_id, from_email="a@exemple.fr", subject="A")
    _insert_email_comm(db, user_id=user_id, from_email="b@exemple.fr", subject="B")

    res = client.get("/api/prospects")
    assert res.status_code == 200
    assert res.json()["total"] == 2
    emails = {p["email"] for p in res.json()["items"]}
    assert emails == {"a@exemple.fr", "b@exemple.fr"}


def test_outbound_alone_creates_no_prospect(client):
    email, password = register_user(client, suffix=_uid("pr-out"))
    login_user(client, email, password)
    db = _mongo()
    user_id = db.users.find_one({"email": email.lower()})["id"]

    _insert_email_comm(
        db,
        user_id=user_id,
        from_email="artisan@gmail.com",
        direction="outbound",
        to_emails=["cold@lead.fr"],
        subject="Prospection",
    )

    res = client.get("/api/prospects")
    assert res.status_code == 200
    assert res.json()["total"] == 0


def test_noreply_marked_automatic(client):
    email, password = register_user(client, suffix=_uid("pr-nr"))
    login_user(client, email, password)
    db = _mongo()
    user_id = db.users.find_one({"email": email.lower()})["id"]

    _insert_email_comm(
        db,
        user_id=user_id,
        from_email="noreply@fournisseur.com",
        from_name="Fournisseur",
        subject="Notification",
    )
    _insert_email_comm(
        db,
        user_id=user_id,
        from_email="newsletter@shop.com",
        subject="Newsletter juillet",
    )

    pending = client.get("/api/prospects", params={"status": "pending"})
    assert pending.json()["total"] == 0

    automatic = client.get("/api/prospects", params={"status": "automatic"})
    assert automatic.status_code == 200
    assert automatic.json()["total"] >= 2
    assert all(p["status"] == "automatic" for p in automatic.json()["items"])
    assert all(p.get("noiseClass") for p in automatic.json()["items"])


def test_ignore_prospect_survives_and_restore(client):
    email, password = register_user(client, suffix=_uid("pr-ign"))
    login_user(client, email, password)
    db = _mongo()
    user_id = db.users.find_one({"email": email.lower()})["id"]
    _insert_email_comm(db, user_id=user_id, from_email="lead@acme.fr", from_name="Lead")

    listed = client.get("/api/prospects").json()["items"]
    assert len(listed) == 1
    prospect_id = listed[0]["id"]

    ignored = client.post(f"/api/prospects/{prospect_id}/ignore")
    assert ignored.status_code == 200
    assert ignored.json()["status"] == "ignored"

    assert client.get("/api/prospects").json()["total"] == 0
    ignored_list = client.get("/api/prospects", params={"status": "ignored"})
    assert ignored_list.json()["total"] == 1

    # Decision persists — still ignored after "re-scan"
    assert client.get("/api/prospects").json()["total"] == 0

    restored = client.post(f"/api/prospects/{prospect_id}/restore")
    assert restored.status_code == 200
    assert client.get("/api/prospects").json()["total"] == 1


def test_associate_links_all_compatible_communications(client):
    email, password = register_user(client, suffix=_uid("pr-asc"))
    login_user(client, email, password)
    created = create_client_record(client, name="Client Cible")
    client_id = created["id"]

    db = _mongo()
    user_id = db.users.find_one({"email": email.lower()})["id"]
    c1 = _insert_email_comm(
        db, user_id=user_id, from_email="multi@lead.fr", subject="Un", created_at="2026-07-01T10:00:00+00:00"
    )
    c2 = _insert_email_comm(
        db, user_id=user_id, from_email="multi@lead.fr", subject="Deux", created_at="2026-07-02T10:00:00+00:00"
    )
    c3 = _insert_email_comm(
        db,
        user_id=user_id,
        from_email="artisan@gmail.com",
        direction="outbound",
        to_emails=["multi@lead.fr"],
        subject="Réponse",
        created_at="2026-07-02T12:00:00+00:00",
    )

    prospect_id = client.get("/api/prospects").json()["items"][0]["id"]
    assoc = client.post(
        f"/api/prospects/{prospect_id}/associate",
        json={"clientId": client_id},
    )
    assert assoc.status_code == 200, assoc.text
    assert assoc.json()["linkedCommunications"] == 3

    for doc_id in (c1["id"], c2["id"], c3["id"]):
        row = db.communications.find_one({"id": doc_id})
        assert row["clientId"] == client_id

    events = list(
        db.events.find(
            {"userId": user_id, "type": {"$in": ["email_received", "email_sent"]}},
            {"_id": 0},
        )
    )
    assert len(events) == 3

    # Second associate is idempotent (no new events)
    again = client.post(
        f"/api/prospects/{prospect_id}/associate",
        json={"clientId": client_id},
    )
    assert again.status_code == 200
    events_after = db.events.count_documents(
        {"userId": user_id, "type": {"$in": ["email_received", "email_sent"]}}
    )
    assert events_after == 3

    assert client.get("/api/prospects").json()["total"] == 0


def test_create_client_from_prospect_reuses_identity(client):
    email, password = register_user(client, suffix=_uid("pr-crt"))
    login_user(client, email, password)
    db = _mongo()
    user_id = db.users.find_one({"email": email.lower()})["id"]
    _insert_email_comm(
        db,
        user_id=user_id,
        from_email="nouvelle@entreprise.io",
        from_name="Camille Durand",
        subject="Demande devis",
    )
    _insert_email_comm(
        db,
        user_id=user_id,
        from_email="nouvelle@entreprise.io",
        from_name="Camille Durand",
        subject="Relance",
    )

    prospect_id = client.get("/api/prospects").json()["items"][0]["id"]
    created = client.post(f"/api/prospects/{prospect_id}/create-client", json={})
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["client"]["email"] == "nouvelle@entreprise.io"
    assert "Camille" in (body["client"].get("name") or body["client"].get("contactName") or "")
    assert body["association"]["linkedCommunications"] == 2
    assert body["duplicateClientId"] is None

    decision = db.prospect_decisions.find_one({"userId": user_id, "id": prospect_id})
    assert decision["status"] == "converted"
    assert decision["associatedClientId"] == body["client"]["id"]

    linked = db.communications.count_documents(
        {"userId": user_id, "clientId": body["client"]["id"], "type": "email"}
    )
    assert linked == 2


def test_prospect_user_isolation(client):
    email_a, password_a = register_user(client, suffix=_uid("pr-iso-a"))
    email_b, password_b = register_user(client, suffix=_uid("pr-iso-b"))

    login_user(client, email_a, password_a)
    db = _mongo()
    user_a = db.users.find_one({"email": email_a.lower()})["id"]
    _insert_email_comm(db, user_id=user_a, from_email="secret@lead.fr")

    login_user(client, email_b, password_b)
    assert client.get("/api/prospects").json()["total"] == 0

    login_user(client, email_a, password_a)
    assert client.get("/api/prospects").json()["total"] == 1


def test_manual_unlinked_association_preserved(client):
    """Associating via unlinked inbox removes that identity from pending prospects."""
    email, password = register_user(client, suffix=_uid("pr-man"))
    login_user(client, email, password)
    created = create_client_record(client, name="Déjà Client")
    client_id = created["id"]

    db = _mongo()
    user_id = db.users.find_one({"email": email.lower()})["id"]
    comm = _insert_email_comm(
        db, user_id=user_id, from_email="manual@lead.fr", from_name="Manual"
    )

    assert client.get("/api/prospects").json()["total"] == 1
    assoc = client.post(
        f"/api/communications/{comm['id']}/associate",
        json={"clientId": client_id},
    )
    assert assoc.status_code == 200
    assert client.get("/api/prospects").json()["total"] == 0
    row = db.communications.find_one({"id": comm["id"]})
    assert row["clientId"] == client_id
    assert (row.get("metadata") or {}).get("linkedBy") == "manual"


@pytest.fixture
def _mock_gmail(monkeypatch):
    monkeypatch.setenv("INTEGRATIONS_GMAIL_PROVIDER", "mock")
    monkeypatch.setenv("INTEGRATIONS_TOKEN_KEY", "test-integrations-token-key-32chars!!")
    from integrations.providers.mock_gmail import reset_mock_gmail, seed_mock_gmail
    from integrations.secrets import reset_fernet_for_tests

    reset_fernet_for_tests()
    reset_mock_gmail()
    seed_mock_gmail()
    yield
    reset_mock_gmail()
    reset_fernet_for_tests()


def test_gmail_resync_no_prospect_duplicates(client, _mock_gmail):
    email, password = register_user(client, suffix=_uid("pr-sync"))
    login_user(client, email, password)

    # Connect mock Gmail
    res = client.post("/api/integrations/gmail/connect")
    authorize_url = res.json()["authorizeUrl"]
    parsed = urlparse(authorize_url)
    follow = client.get(
        parsed.path + (("?" + parsed.query) if parsed.query else ""),
        follow_redirects=False,
    )
    cb = urlparse(follow.headers["location"])
    client.get(cb.path + (("?" + cb.query) if cb.query else ""), follow_redirects=False)

    assert client.post("/api/integrations/gmail/sync").status_code == 200
    first = client.get("/api/prospects").json()
    # Mock has newsletter@ (automatic) + jean matched if client exists; create no jean client
    # Default mock: jean@martin.fr inbound, sophie outbound, newsletter inbound
    # Without clients → jean + newsletter(auto). Pending = jean only (1)
    assert first["total"] >= 1
    total_first = first["total"]
    ids_first = {p["id"] for p in first["items"]}

    assert client.post("/api/integrations/gmail/sync").status_code == 200
    second = client.get("/api/prospects").json()
    assert second["total"] == total_first
    assert {p["id"] for p in second["items"]} == ids_first

    db = _mongo()
    user_id = db.users.find_one({"email": email.lower()})["id"]
    # Deterministic prospect id stable across syncs
    key = identity_key_for_email("jean@martin.fr")
    assert prospect_id_for(user_id, key) in ids_first or any(
        p["email"] == "jean@martin.fr" for p in first["items"]
    )
