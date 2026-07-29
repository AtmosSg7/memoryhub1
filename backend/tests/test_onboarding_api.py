"""Tests for onboarding, checklist and account maturity."""

import uuid

from tests.conftest import create_client_record, login_user, register_user


def test_empty_account_maturity_and_wizard(client):
    email, password = register_user(client, suffix=f"ob-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)

    res = client.get("/api/onboarding/state")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["maturity"] == "empty"
    assert body["showWizard"] is True
    assert body["signals"]["clientsCount"] == 0
    assert body["checklist"]["visible"] is True
    assert body["demoAllowed"] is True


def test_wizard_dismiss_persists(client):
    email, password = register_user(client, suffix=f"obd-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)

    res = client.patch("/api/onboarding/wizard", json={"dismissed": True})
    assert res.status_code == 200, res.text
    assert res.json()["showWizard"] is False
    assert res.json()["wizard"]["dismissed"] is True

    again = client.get("/api/onboarding/state")
    assert again.status_code == 200
    assert again.json()["showWizard"] is False


def test_checklist_updates_and_dismiss(client):
    email, password = register_user(client, suffix=f"obc-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)

    create_client_record(client, name="Client Onboarding")
    res = client.get("/api/onboarding/state")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["maturity"] in {"starting", "active"}
    client_item = next(i for i in body["checklist"]["items"] if i["id"] == "create_client")
    assert client_item["done"] is True

    dismissed = client.patch("/api/onboarding/checklist", json={"dismissed": True})
    assert dismissed.status_code == 200, dismissed.text
    assert dismissed.json()["checklist"]["dismissed"] is True
    assert dismissed.json()["showChecklist"] is False

    again = client.get("/api/onboarding/state")
    assert again.json()["showChecklist"] is False


def test_view_client_360_checklist_item(client):
    email, password = register_user(client, suffix=f"ob3-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)
    create_client_record(client, name="Client 360")

    res = client.post("/api/onboarding/checklist/viewed-client-360")
    assert res.status_code == 200, res.text
    item = next(i for i in res.json()["checklist"]["items"] if i["id"] == "view_client_360")
    assert item["done"] is True


def test_first_win_ack(client):
    email, password = register_user(client, suffix=f"obw-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)
    create_client_record(client, name="First Win Client")

    state = client.get("/api/onboarding/state").json()
    win = next(w for w in state["firstWins"] if w["id"] == "first_client")
    assert win["achieved"] is True
    assert win["celebratedAt"] is None

    ack = client.post("/api/onboarding/first-win/ack", json={"id": "first_client"})
    assert ack.status_code == 200, ack.text
    win2 = next(w for w in ack.json()["firstWins"] if w["id"] == "first_client")
    assert win2["celebratedAt"] is not None


def test_maturity_endpoint(client):
    email, password = register_user(client, suffix=f"obm-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)
    res = client.get("/api/onboarding/maturity")
    assert res.status_code == 200, res.text
    assert res.json()["maturity"] == "empty"
