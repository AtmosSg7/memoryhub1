"""Credit API endpoint tests."""

import os
import uuid

from tests.conftest import register_user


def test_credits_api_balance_and_costs(client):
    register_user(client, suffix=uuid.uuid4().hex)

    assign = client.post("/api/credits/dev/assign-plan", params={"planId": "solo"})
    assert assign.status_code == 200
    assert assign.json()["monthlyRemaining"] == 10

    balance = client.get("/api/credits/balance")
    assert balance.status_code == 200
    assert balance.json()["monthlyRemaining"] == 10

    costs = client.get("/api/credits/costs")
    assert costs.status_code == 200
    assert any(c["actionKey"] == "IMPORT_DOCUMENT" for c in costs.json())

    preview = client.get("/api/credits/costs/import-preview", params={"tier": "complex"})
    assert preview.status_code == 200
    assert preview.json()["estimatedAnalyses"] == 1

    estimate = client.get(
        "/api/credits/costs/import-preview",
        params={"extension": "pdf", "sizeBytes": 800_000},
    )
    assert estimate.status_code == 200
    body = estimate.json()
    assert body["estimatedAnalyses"] == 1
    assert body["tierKey"]

    history = client.get("/api/credits/ai-history")
    assert history.status_code == 200
    assert "items" in history.json()

    tx = client.get("/api/credits/transactions")
    assert tx.status_code == 200
    assert tx.json()["total"] >= 1


def test_credits_balance_requires_auth(client):
    client.post("/api/auth/logout")
    res = client.get("/api/credits/balance")
    assert res.status_code == 401
