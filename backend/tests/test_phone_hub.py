"""Phone Hub V1 — normalize, match, ingest → communications / Hub."""

from __future__ import annotations

import os
import uuid

import pytest

os.environ.setdefault("INTEGRATIONS_TOKEN_KEY", "test-integrations-token-key-32chars!!")
os.environ.setdefault("INTEGRATIONS_PHONE_PROVIDER", "mock")

from communication_hub.conversation_engine import derive_conversation_key
from phone.constants import PROVIDER_PHONE, VENDOR_MOCK
from phone.matcher import PhoneMatcher
from phone.models import RemoteCall
from phone.normalizer import PhoneNormalizer
from phone.providers.mock_phone import MockPhoneProvider
from phone.registry import get_phone_provider, list_phone_vendors
from tests.conftest import login_user, register_user


@pytest.fixture(autouse=True)
def _phone_env(monkeypatch):
    monkeypatch.setenv("INTEGRATIONS_PHONE_PROVIDER", "mock")
    monkeypatch.setenv("INTEGRATIONS_PHONE_MOCK", "true")
    monkeypatch.setenv("INTEGRATIONS_TOKEN_KEY", "test-integrations-token-key-32chars!!")
    from integrations.secrets import reset_fernet_for_tests

    reset_fernet_for_tests()
    yield
    reset_fernet_for_tests()


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def test_phone_normalizer_fr_identity():
    identity = PhoneNormalizer.identity("+33 6 12 34 56 78")
    assert identity is not None
    assert identity.normalized == "0612345678"
    assert identity.identityKey == "phone:0612345678"
    assert identity.e164 == "+33612345678"


def test_phone_normalizer_status_aliases():
    assert PhoneNormalizer.normalize_status("no-answer") == "missed"
    assert PhoneNormalizer.normalize_status("declined") == "rejected"
    assert PhoneNormalizer.normalize_status(None, voicemail=True) == "voicemail"
    assert PhoneNormalizer.normalize_direction("outbound") == "outgoing"


def test_phone_matcher_links_client():
    clients = [
        {"id": "c1", "name": "Dupont", "phone": "06 12 34 56 78"},
        {"id": "c2", "name": "Martin", "phones": [{"value": "+33699887766"}]},
    ]
    matcher = PhoneMatcher()
    client, reason = matcher.find_client(clients, "+33612345678")
    assert client["id"] == "c1"
    assert reason == "phone"
    client2, reason2 = matcher.find_client(clients, "0699887766")
    assert client2["id"] == "c2"
    assert reason2 == "phone"


def test_phone_vendors_registered():
    vendors = list_phone_vendors()
    for key in ("mock", "twilio", "aircall", "ringover", "ovh", "3cx", "freepbx"):
        assert key in vendors
    assert get_phone_provider("mock").is_ready() is True
    assert get_phone_provider("twilio").is_ready() is False


def test_mock_provider_lists_calls():
    import asyncio

    provider = MockPhoneProvider()
    calls = asyncio.run(provider.list_calls(max_results=10))
    assert len(calls) >= 2
    assert all(isinstance(c, RemoteCall) for c in calls)
    assert all(c.provider == PROVIDER_PHONE for c in calls)


def test_conversation_key_uses_normalized_phone():
    key = derive_conversation_key(
        {
            "type": "phone",
            "provider": "phone",
            "providerId": "call-1",
            "metadata": {"phoneNumber": "+33 6 12 34 56 78"},
        }
    )
    assert key == "phone:phone:identity:0612345678"


def test_phone_status_connect_sync_disconnect(client):
    email, password = register_user(client, suffix=_uid("phone"))
    login_user(client, email, password)

    created = client.post(
        "/api/clients",
        json={
            "name": "Client Appel",
            "phone": "0612345678",
            "email": f"appel-{_uid('c')}@example.com",
            "status": "active",
        },
    )
    assert created.status_code in (200, 201), created.text

    status = client.get("/api/integrations/phone/status")
    assert status.status_code == 200
    body = status.json()
    assert body["providerMode"] == VENDOR_MOCK
    assert body["connected"] is False
    assert "twilio" in body["availableVendors"]

    connect = client.post("/api/integrations/phone/connect")
    assert connect.status_code == 200, connect.text
    assert connect.json()["connected"] is True

    preview = client.get("/api/integrations/phone/preview")
    assert preview.status_code == 200
    assert preview.json()["callCount"] >= 1

    sync = client.post("/api/integrations/phone/sync")
    assert sync.status_code == 200, sync.text
    summary = sync.json()["summary"]
    assert summary["total"] >= 1
    assert summary["linked"] >= 1

    status2 = client.get("/api/integrations/phone/status")
    assert status2.status_code == 200
    data = status2.json()
    assert data["connected"] is True
    assert data["stats"]["total"] >= 1
    assert data["lastCall"] is not None
    assert data["lastSync"] is not None

    providers = client.get("/api/hub/providers")
    assert providers.status_code == 200
    phone_row = next(p for p in providers.json()["items"] if p["providerId"] == "phone")
    assert phone_row["ready"] is True

    # Idempotent second sync (same providerCallIds)
    sync2 = client.post("/api/integrations/phone/sync")
    assert sync2.status_code == 200

    hub = client.get("/api/hub/conversations?channel=phone&limit=20")
    assert hub.status_code == 200
    assert (hub.json().get("total") or len(hub.json().get("items") or [])) >= 1

    disconnect = client.post("/api/integrations/phone/disconnect")
    assert disconnect.status_code == 200
    status3 = client.get("/api/integrations/phone/status")
    assert status3.json()["connected"] is False
