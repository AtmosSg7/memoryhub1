"""Google Contacts integration — OAuth, import, matching, isolation, refresh."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import pytest
from pymongo import MongoClient

os.environ["INTEGRATIONS_CONTACTS_PROVIDER"] = "mock"
os.environ.setdefault("INTEGRATIONS_TOKEN_KEY", "test-integrations-token-key-32chars!!")

from integrations.oauth_state import create_oauth_state, verify_oauth_state
from integrations.providers.mock_contacts import reset_mock_google_contacts, seed_mock_google_contacts
from integrations.secrets import reset_fernet_for_tests
from tests.conftest import login_user, register_user


@pytest.fixture(autouse=True)
def _mock_google_provider(monkeypatch):
    monkeypatch.setenv("INTEGRATIONS_CONTACTS_PROVIDER", "mock")
    monkeypatch.setenv("INTEGRATIONS_TOKEN_KEY", "test-integrations-token-key-32chars!!")
    reset_fernet_for_tests()
    reset_mock_google_contacts()
    seed_mock_google_contacts()
    yield
    reset_mock_google_contacts()
    reset_fernet_for_tests()


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _connect_via_oauth(client, user_email: str, password: str = "PyTestPassword123!"):
    login_user(client, user_email, password)
    res = client.post("/api/integrations/google-contacts/connect")
    assert res.status_code == 200, res.text
    authorize_url = res.json()["authorizeUrl"]
    parsed = urlparse(authorize_url)
    authorize_path = parsed.path + (("?" + parsed.query) if parsed.query else "")
    follow = client.get(authorize_path, follow_redirects=False)
    assert follow.status_code in (302, 307), follow.text
    callback_loc = follow.headers.get("location")
    assert callback_loc
    cb_parsed = urlparse(callback_loc)
    callback_path = cb_parsed.path + (("?" + cb_parsed.query) if cb_parsed.query else "")
    cb = client.get(callback_path, follow_redirects=False)
    assert cb.status_code in (302, 307), cb.text
    return cb.headers.get("location")


def _list_clients(client):
    res = client.get("/api/clients")
    assert res.status_code == 200, res.text
    data = res.json()
    if isinstance(data, dict) and "items" in data:
        return data["items"]
    return data


def test_oauth_state_valid_and_invalid():
    state = create_oauth_state("user-1", provider="google_contacts")
    body = verify_oauth_state(state, user_id="user-1", provider="google_contacts")
    assert body["uid"] == "user-1"

    with pytest.raises(ValueError):
        verify_oauth_state(state + "tampered", user_id="user-1")

    with pytest.raises(ValueError):
        verify_oauth_state(state, user_id="other-user")

    with pytest.raises(ValueError):
        verify_oauth_state("not-a-state")


def test_callback_rejects_invalid_state(client):
    email, password = register_user(client, suffix=_uid("gc-bad-state"))
    login_user(client, email, password)
    res = client.get(
        "/api/integrations/google-contacts/callback",
        params={"code": "x", "state": "invalid"},
        follow_redirects=False,
    )
    assert res.status_code in (302, 307)
    loc = res.headers.get("location", "")
    assert "google_contacts=error" in loc
    assert "invalid_state" in loc


def test_connect_import_and_status(client):
    email, password = register_user(client, suffix=_uid("gc-import"))
    redirect = _connect_via_oauth(client, email, password)
    assert "google_contacts=connected" in (redirect or "")

    status = client.get("/api/integrations/google-contacts/status")
    assert status.status_code == 200
    body = status.json()
    assert body["connected"] is True
    assert body["providerMode"] == "mock"
    assert body["account"]["accountEmail"]

    preview = client.get("/api/integrations/google-contacts/preview")
    assert preview.status_code == 200
    assert preview.json()["contactCount"] >= 2

    imported = client.post("/api/integrations/google-contacts/import")
    assert imported.status_code == 200, imported.text
    summary = imported.json()["summary"]
    assert summary["created"] >= 2
    assert summary["total"] >= 2

    clients = _list_clients(client)
    names = {c.get("name") or c.get("contactName") for c in clients}
    assert any("Jean" in (n or "") for n in names)

    sync = client.post("/api/integrations/google-contacts/sync")
    assert sync.status_code == 200
    summary2 = sync.json()["summary"]
    assert summary2["created"] == 0

    clients2 = _list_clients(client)
    jean_count = sum(1 for c in clients2 if "Jean" in (c.get("name") or ""))
    assert jean_count == 1


def test_enrich_existing_client_by_email(client):
    email, password = register_user(client, suffix=_uid("gc-enrich"))
    login_user(client, email, password)
    created = client.post(
        "/api/clients",
        json={
            "name": "Jean Martin",
            "email": "jean@martin.fr",
            "status": "active",
        },
    )
    assert created.status_code in (200, 201), created.text
    client_id = created.json()["id"]

    _connect_via_oauth(client, email, password)
    imported = client.post("/api/integrations/google-contacts/import")
    assert imported.status_code == 200
    summary = imported.json()["summary"]
    assert summary["enriched"] >= 1

    detail = client.get(f"/api/clients/{client_id}")
    assert detail.status_code == 200
    data = detail.json()
    assert data.get("phone") or (data.get("phones") or [])
    assert (data.get("integrations") or {}).get("googleContactsId") == "people/c1"
    phones = data.get("phones") or []
    assert any(p.get("source") == "google_contacts" for p in phones)


def test_match_by_phone_and_no_duplicate(client):
    email, password = register_user(client, suffix=_uid("gc-phone"))
    login_user(client, email, password)
    created = client.post(
        "/api/clients",
        json={
            "name": "Sophie Existing",
            "phone": "0700000000",
            "status": "active",
        },
    )
    assert created.status_code in (200, 201)
    client_id = created.json()["id"]

    _connect_via_oauth(client, email, password)
    imported = client.post("/api/integrations/google-contacts/import")
    assert imported.status_code == 200

    detail = client.get(f"/api/clients/{client_id}").json()
    assert (detail.get("integrations") or {}).get("googleContactsId") == "people/c2"


def test_user_modified_not_overwritten_creates_conflict(client):
    email, password = register_user(client, suffix=_uid("gc-conflict"))
    login_user(client, email, password)
    _connect_via_oauth(client, email, password)
    imported = client.post("/api/integrations/google-contacts/import")
    assert imported.status_code == 200

    clients = _list_clients(client)
    jean = next(c for c in clients if "Jean" in (c.get("name") or ""))
    detail = client.get(f"/api/clients/{jean['id']}").json()
    phones = detail.get("phones") or []
    assert phones
    phone = phones[0]
    updated_phones = [{**phone, "value": "06 99 99 99 99"}]
    patch = client.put(
        f"/api/clients/{jean['id']}",
        json={"phones": updated_phones, "phone": "06 99 99 99 99"},
    )
    assert patch.status_code == 200, patch.text

    sync = client.post("/api/integrations/google-contacts/sync")
    assert sync.status_code == 200
    summary = sync.json()["summary"]
    assert summary["conflicts"] >= 1

    after = client.get(f"/api/clients/{jean['id']}").json()
    values = [p.get("value") for p in (after.get("phones") or [])]
    assert any("99" in (v or "") for v in values)
    assert any(p.get("syncStatus") == "conflict" for p in (after.get("phones") or []))


def test_user_isolation(client):
    email_a, password_a = register_user(client, suffix=_uid("gc-iso-a"))
    email_b, password_b = register_user(client, suffix=_uid("gc-iso-b"))

    _connect_via_oauth(client, email_a, password_a)
    client.post("/api/integrations/google-contacts/import")
    clients_a = _list_clients(client)
    assert len(clients_a) >= 2

    client.post("/api/auth/logout")
    login_user(client, email_b, password_b)
    status_b = client.get("/api/integrations/google-contacts/status").json()
    assert status_b["connected"] is False
    clients_b = _list_clients(client)
    assert clients_b == []


def test_token_refresh_on_expired_access(client):
    email, password = register_user(client, suffix=_uid("gc-refresh"))
    _connect_via_oauth(client, email, password)

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    assert user
    account = db.connected_accounts.find_one({"userId": user["id"], "provider": "google_contacts"})
    assert account
    before_token = account.get("accessTokenEnc")
    expired = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    db.connected_accounts.update_one(
        {"userId": user["id"], "provider": "google_contacts"},
        {"$set": {"tokenExpiresAt": expired}},
    )

    preview = client.get("/api/integrations/google-contacts/preview")
    assert preview.status_code == 200
    assert preview.json()["contactCount"] >= 1

    after = db.connected_accounts.find_one({"userId": user["id"], "provider": "google_contacts"})
    assert after.get("accessTokenEnc") != before_token


def test_disconnect_removes_account(client):
    email, password = register_user(client, suffix=_uid("gc-disc"))
    _connect_via_oauth(client, email, password)
    assert client.get("/api/integrations/google-contacts/status").json()["connected"] is True

    res = client.post("/api/integrations/google-contacts/disconnect")
    assert res.status_code == 200
    assert res.json()["disconnected"] is True
    status = client.get("/api/integrations/google-contacts/status").json()
    assert status["connected"] is False
    assert status["account"] is None

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    assert db.connected_accounts.find_one({"userId": user["id"], "provider": "google_contacts"}) is None
