"""Subscription API endpoint tests."""

import uuid

from tests.conftest import register_user


def test_subscriptions_plans_public(client):
    res = client.get("/api/subscriptions/plans")
    assert res.status_code == 200
    plans = res.json()
    ids = {p["id"] for p in plans}
    assert ids == {"solo", "pro", "team"}


def test_subscriptions_dev_lifecycle(client):
    register_user(client, suffix=uuid.uuid4().hex)

    trial = client.post(
        "/api/subscriptions/dev/start-trial",
        json={"planId": "solo", "startWithTrial": True},
    )
    assert trial.status_code == 200
    assert trial.json()["status"] == "trial"

    me = client.get("/api/subscriptions/me")
    assert me.status_code == 200
    assert me.json()["planId"] == "solo"

    balance = client.get("/api/credits/balance")
    assert balance.status_code == 200
    assert balance.json()["monthlyRemaining"] == 10

    activate = client.post("/api/subscriptions/dev/activate")
    assert activate.status_code == 200
    assert activate.json()["status"] == "active"

    upgrade = client.post("/api/subscriptions/dev/upgrade", params={"planId": "pro"})
    assert upgrade.status_code == 200
    assert upgrade.json()["planId"] == "pro"

    balance2 = client.get("/api/credits/balance")
    assert balance2.json()["monthlyRemaining"] == 20

    history = client.get("/api/subscriptions/history")
    assert history.status_code == 200
    assert history.json()["total"] >= 3


def test_subscriptions_dev_activate_paid(client):
    register_user(client, suffix=uuid.uuid4().hex)

    paid = client.post("/api/subscriptions/dev/activate-paid", params={"planId": "team"})
    assert paid.status_code == 200
    assert paid.json()["status"] == "active"
    assert paid.json()["planId"] == "team"

    assign = client.post("/api/credits/dev/assign-plan", params={"planId": "solo"})
    assert assign.status_code == 200
    assert assign.json()["monthlyRemaining"] == 10


def test_subscriptions_me_requires_auth(client):
    client.post("/api/auth/logout")
    res = client.get("/api/subscriptions/me")
    assert res.status_code == 401


def test_subscriptions_cancel_and_reactivate(client):
    register_user(client, suffix=uuid.uuid4().hex)

    client.post("/api/subscriptions/dev/activate-paid", params={"planId": "solo"})
    cancel = client.post(
        "/api/subscriptions/dev/cancel",
        json={"atPeriodEnd": False},
    )
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "cancelled"

    reactivate = client.post("/api/subscriptions/dev/reactivate", json={})
    assert reactivate.status_code == 200
    assert reactivate.json()["status"] == "active"


def test_subscriptions_duplicate_trial_conflict(client):
    register_user(client, suffix=uuid.uuid4().hex)

    first = client.post(
        "/api/subscriptions/dev/start-trial",
        json={"planId": "solo", "startWithTrial": True},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/subscriptions/dev/start-trial",
        json={"planId": "pro", "startWithTrial": True},
    )
    assert second.status_code == 409
