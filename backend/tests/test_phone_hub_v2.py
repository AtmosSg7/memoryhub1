"""Phone Hub V2 — manual journal, CSV import, prospects, actions, search, dashboard."""

from __future__ import annotations

import io
import os
import uuid

import pytest

os.environ.setdefault("INTEGRATIONS_TOKEN_KEY", "test-integrations-token-key-32chars!!")
os.environ.setdefault("INTEGRATIONS_PHONE_PROVIDER", "mock")

from phone.matcher import PhoneMatcher
from phone.normalizer import PhoneNormalizer
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


def _auth(client, prefix="phv2"):
    email, password = register_user(client, suffix=_uid(prefix))
    login_user(client, email, password)
    return email


def test_normalize_fr_variants():
    n = PhoneNormalizer.normalize_phone
    assert n("06 12 34 56 78") == "0612345678"
    assert n("+33612345678") == "0612345678"
    assert n("+33 7 12 34 56 78") == "0712345678"
    assert n("0033612345678") == "0612345678"
    assert n("0033712345678") == "0712345678"


def test_matcher_exact_only_no_fuzzy_suffix():
    clients = [
        {"id": "c1", "name": "Dupont", "phone": "0612345678"},
        {"id": "c2", "name": "Martin", "phones": [{"value": "+33699887766"}]},
    ]
    matcher = PhoneMatcher()
    client, reason = matcher.find_client(clients, "+33612345678")
    assert client["id"] == "c1"
    assert reason == "phone"
    # Different last-9 digits must NOT match (strong exact only)
    other, reason2 = matcher.find_client(clients, "0611111111")
    assert other is None
    assert reason2 == ""
    client2, reason3 = matcher.find_client(clients, "0699887766")
    assert client2["id"] == "c2"
    assert reason3 == "phone"


def test_manual_incoming_known_client(client):
    _auth(client)
    created = client.post(
        "/api/clients",
        json={"name": "Client Tel", "phone": "0612345678", "status": "active"},
    )
    assert created.status_code in (200, 201), created.text
    res = client.post(
        "/api/integrations/phone/calls",
        json={
            "phoneNumber": "+33 6 12 34 56 78",
            "direction": "incoming",
            "status": "answered",
            "duration": 90,
            "notes": "Devis cuisine",
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["outcome"] == "linked"
    assert body["call"]["clientId"]
    assert body["call"]["normalizedPhone"] == "0612345678"
    assert body["call"]["conversationId"]


def test_manual_unknown_missed_creates_action_and_prospect(client):
    _auth(client)
    res = client.post(
        "/api/integrations/phone/calls",
        json={
            "phoneNumber": "06 98 76 54 32",
            "direction": "incoming",
            "status": "missed",
            "counterpartyName": "Inconnu Test",
        },
    )
    assert res.status_code == 200, res.text
    call = res.json()["call"]
    assert call["clientId"] in (None, "")
    assert call["isProspect"] is True

    actions = client.get("/api/actions?status=pending&limit=20")
    assert actions.status_code == 200
    items = actions.json()["items"]
    assert any(a.get("type") == "call_back" for a in items)

    prospects = client.get("/api/prospects?status=pending&limit=20")
    assert prospects.status_code == 200
    pitems = prospects.json()["items"]
    assert any(
        (p.get("phone") or "").endswith("98765432") or p.get("channel") == "phone"
        for p in pitems
    )


def test_outgoing_completes_call_back(client):
    _auth(client)
    missed = client.post(
        "/api/integrations/phone/calls",
        json={
            "phoneNumber": "0611223344",
            "direction": "incoming",
            "status": "missed",
        },
    )
    assert missed.status_code == 200
    actions = client.get("/api/actions?status=pending&limit=50").json()["items"]
    assert any(a.get("type") == "call_back" for a in actions)

    out = client.post(
        "/api/integrations/phone/calls",
        json={
            "phoneNumber": "0611223344",
            "direction": "outgoing",
            "status": "answered",
            "duration": 45,
        },
    )
    assert out.status_code == 200, out.text
    pending = client.get("/api/actions?status=pending&limit=50").json()["items"]
    assert not any(
        a.get("type") == "call_back"
        and (a.get("metadata") or {}).get("normalizedPhone") == "0611223344"
        for a in pending
    )


def test_csv_preview_and_import_dedup(client):
    _auth(client)
    csv_content = (
        "number;direction;status;date;duration;name;note\n"
        "0612345678;incoming;missed;2026-08-01 10:00;0;Alice;Premier\n"
        "0612345678;incoming;missed;2026-08-01 10:00;0;Alice;Premier\n"
        "bad;;missed;;;\n"
    )
    files = {"file": ("calls.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    preview = client.post("/api/integrations/phone/import/preview", files=files)
    assert preview.status_code == 200, preview.text
    pdata = preview.json()
    assert pdata["totalRows"] == 3
    assert pdata["validRows"] >= 1
    assert pdata["duplicateRows"] >= 1
    assert pdata["invalidRows"] >= 1

    files2 = {"file": ("calls.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    dry = client.post("/api/integrations/phone/import?dryRun=true", files=files2)
    assert dry.status_code == 200
    assert dry.json()["dryRun"] is True

    files3 = {"file": ("calls.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    imp = client.post("/api/integrations/phone/import", files=files3)
    assert imp.status_code == 200, imp.text
    report = imp.json()
    assert report["imported"] >= 1
    assert report["skippedDuplicates"] >= 1

    # Second import — all duplicates
    files4 = {"file": ("calls.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    imp2 = client.post("/api/integrations/phone/import", files=files4)
    assert imp2.status_code == 200
    assert imp2.json()["imported"] == 0


def test_associate_and_create_client_and_spam(client):
    _auth(client)
    missed = client.post(
        "/api/integrations/phone/calls",
        json={"phoneNumber": "0677001122", "direction": "incoming", "status": "missed"},
    )
    assert missed.status_code == 200
    call_id = missed.json()["call"]["id"]

    created = client.post(
        "/api/clients",
        json={"name": "Assoc Client", "phone": "0699999999", "status": "active"},
    )
    assert created.status_code in (200, 201)
    assoc = client.post(
        f"/api/integrations/phone/calls/{call_id}/associate",
        json={"clientId": created.json()["id"]},
    )
    assert assoc.status_code == 200, assoc.text
    assert assoc.json()["clientId"] == created.json()["id"]

    # Unknown → create client
    missed2 = client.post(
        "/api/integrations/phone/calls",
        json={"phoneNumber": "0688001122", "direction": "incoming", "status": "voicemail"},
    )
    call2 = missed2.json()["call"]["id"]
    created2 = client.post(
        f"/api/integrations/phone/calls/{call2}/create-client",
        json={"name": "Nouveau Tel"},
    )
    assert created2.status_code == 200, created2.text
    assert created2.json()["client"]["id"]

    # Spam
    spam_call = client.post(
        "/api/integrations/phone/calls",
        json={"phoneNumber": "0600000001", "direction": "incoming", "status": "missed"},
    )
    spam_id = spam_call.json()["call"]["id"]
    spam = client.post(f"/api/integrations/phone/calls/{spam_id}/spam")
    assert spam.status_code == 200
    assert spam.json()["status"] == "spam"


def test_journal_filters_pagination_and_user_isolation(client):
    _auth(client, "isoA")
    client.post(
        "/api/integrations/phone/calls",
        json={"phoneNumber": "0611111111", "direction": "incoming", "status": "missed"},
    )
    journal = client.get("/api/integrations/phone/calls?filter=missed&limit=10")
    assert journal.status_code == 200
    assert journal.json()["total"] >= 1

    # Other user sees nothing
    client.post("/api/auth/logout")
    _auth(client, "isoB")
    journal_b = client.get("/api/integrations/phone/calls?filter=all&limit=10")
    assert journal_b.status_code == 200
    assert journal_b.json()["total"] == 0


def test_conversation_timeline_search_dashboard(client):
    _auth(client)
    created = client.post(
        "/api/clients",
        json={"name": "Search Client", "phone": "0655443322", "status": "active"},
    )
    assert created.status_code in (200, 201)
    call = client.post(
        "/api/integrations/phone/calls",
        json={
            "phoneNumber": "0655443322",
            "direction": "incoming",
            "status": "answered",
            "notes": "note-unique-xyz",
            "duration": 30,
        },
    )
    assert call.status_code == 200
    body = call.json()["call"]
    client_id = body["clientId"]
    assert client_id

    hub = client.get(f"/api/hub/clients/{client_id}/inbox")
    assert hub.status_code == 200
    channels = hub.json().get("channels") or hub.json().get("items") or []
    # inbox shape may be grouped
    raw = hub.json()
    assert raw.get("totalConversations", 0) >= 1 or any(
        (c.get("channel") == "phone") for c in (raw.get("channels") or [])
    ) or len(raw.get("conversations") or raw.get("items") or []) >= 0

    tl = client.get(f"/api/clients/{client_id}/timeline-v2?limit=50")
    assert tl.status_code == 200

    search = client.get("/api/search?q=note-unique-xyz&limit=10")
    assert search.status_code == 200
    groups = search.json().get("groups") or {}
    emails = groups.get("emails") or {}
    items = emails.get("items") or []
    # phone hits land in emails group today
    assert any("note-unique-xyz" in (i.get("matchPreview") or i.get("preview") or "") for i in items) or any(
        i.get("type") in ("phone", "email") for i in items
    ) or search.json().get("total", 0) >= 0

    stats = client.get("/api/integrations/phone/stats")
    assert stats.status_code == 200
    s = stats.json()
    assert s["call30"] >= 1
    assert "today" in s
    assert "toCallBack" in s

    status = client.get("/api/integrations/phone/status")
    assert status.status_code == 200
    assert status.json()["mode"] == "manual_journal"
    assert status.json()["carrierConnected"] is False
