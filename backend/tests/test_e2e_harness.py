"""E2E harness routes — available only when ALLOW_E2E_SEED and not deployed."""

from __future__ import annotations

import os

import pytest

from tests.conftest import login_user, register_user


@pytest.fixture
def e2e_env(monkeypatch):
    monkeypatch.setenv("ALLOW_E2E_SEED", "1")
    monkeypatch.setenv("ENV", "development")
    monkeypatch.setenv("INTEGRATIONS_GMAIL_PROVIDER", "mock")
    monkeypatch.setenv("ACTION_ENGINE_ENABLED", "true")
    monkeypatch.setenv("COMMUNICATION_INTELLIGENCE_ENABLED", "true")
    monkeypatch.setenv("COMMUNICATION_INTELLIGENCE_PROVIDER", "mock")
    monkeypatch.setenv("CREDITS_ENFORCED", "false")
    monkeypatch.setenv("E2E_DISABLE_RATE_LIMIT", "1")
    # Reload gating reads os.environ at request time via _e2e_allowed
    yield


def test_e2e_health_requires_flag(client, monkeypatch):
    monkeypatch.setenv("ALLOW_E2E_SEED", "")
    monkeypatch.setenv("ENV", "development")
    res = client.get("/api/e2e/health")
    assert res.status_code == 404


def test_e2e_health_ok(client, e2e_env):
    res = client.get("/api/e2e/health")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["allowE2eSeed"] is True


def test_e2e_seed_unknown_syncs_prospect(client, e2e_env):
    email, password = register_user(client, suffix=f"e2e-harness-{os.urandom(4).hex()}")
    login_user(client, email, password)

    res = client.post(
        "/api/e2e/scenario/seed-unknown",
        json={
            "fromEmail": "alex.inconnu@e2e.example.com",
            "subject": "Devis terrasse Lyon E2E",
            "preview": "Bonjour, je souhaite un devis pour une terrasse à Lyon.",
            "resetFirst": True,
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ok"] is True
    assert len(body.get("communicationIds") or []) >= 1

    prospects = client.get("/api/prospects", params={"status": "pending"}).json()
    assert prospects["total"] >= 1
    emails = {(p.get("email") or "").lower() for p in prospects["items"]}
    assert "alex.inconnu@e2e.example.com" in emails

    # Idempotent second sync
    again = client.post("/api/e2e/scenario/sync", json={})
    assert again.status_code == 200, again.text
    assert again.json().get("synced", 0) == 0
