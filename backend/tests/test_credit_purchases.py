"""Credit pack purchase tests — dev simulation and Stripe webhook fulfillment."""

from __future__ import annotations

import json
import os
import uuid

import pytest

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "memoryhub_test")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-at-least-32-characters-long")
os.environ.setdefault("ENV", "development")
os.environ.setdefault("E2E_DISABLE_RATE_LIMIT", "1")

os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake_key_for_tests"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_secret"
os.environ["STRIPE_PRICE_SOLO"] = "price_solo_test"
os.environ["STRIPE_PRICE_PRO"] = "price_pro_test"
os.environ["STRIPE_PRICE_TEAM"] = "price_team_test"
os.environ["STRIPE_PRICE_CREDITS_10"] = "price_credits_10_test"
os.environ["STRIPE_PRICE_CREDITS_25"] = "price_credits_25_test"
os.environ["STRIPE_PRICE_CREDITS_50"] = "price_credits_50_test"
os.environ["STRIPE_SUCCESS_URL"] = "http://localhost:3000/dashboard/billing?checkout=success"
os.environ["STRIPE_CANCEL_URL"] = "http://localhost:3000/dashboard/billing?checkout=cancel"

import stripe_service  # noqa: E402
from credit_purchase_service import dev_credit_purchases_enabled  # noqa: E402
from stripe_service import set_stripe_backend  # noqa: E402
from tests.conftest import login_user, register_user  # noqa: E402
from tests.test_stripe_integration import FakeStripeBackend  # noqa: E402


@pytest.fixture(autouse=True)
def fake_stripe():
    backend = FakeStripeBackend()
    set_stripe_backend(backend)
    yield backend
    set_stripe_backend(None)


def _auth(client):
    suffix = uuid.uuid4().hex
    email, password = register_user(client, suffix=suffix)
    login_user(client, email, password)
    return email


def test_list_credit_packs(client, monkeypatch):
    monkeypatch.setenv("DEV_CREDIT_PURCHASES_ENABLED", "true")
    _auth(client)
    res = client.get("/api/billing/credit-packs")
    assert res.status_code == 200
    body = res.json()
    assert len(body["packs"]) >= 3
    assert body["devCreditPurchasesEnabled"] is True
    keys = {p["packKey"] for p in body["packs"]}
    assert "pack_10" in keys
    pack_10 = next(p for p in body["packs"] if p["packKey"] == "pack_10")
    assert pack_10["analyses"] == 10


def test_dev_purchase_grants_permanent_credits(client, monkeypatch):
    monkeypatch.setenv("DEV_CREDIT_PURCHASES_ENABLED", "true")
    _auth(client)
    before = client.get("/api/credits/balance").json()

    res = client.post("/api/billing/credit-packs/dev-purchase", json={"packKey": "pack_10"})
    assert res.status_code == 200
    body = res.json()
    assert body["purchase"]["analyses"] == 10
    assert body["purchase"]["method"] == "development"
    assert body["purchase"]["status"] == "completed"

    after = client.get("/api/credits/balance").json()
    assert after["permanentRemaining"] == before["permanentRemaining"] + 10

    tx = client.get("/api/credits/transactions")
    assert tx.status_code == 200
    assert any(item["source"] == "purchase" for item in tx.json()["items"])


def test_dev_purchase_idempotent(client, monkeypatch):
    monkeypatch.setenv("DEV_CREDIT_PURCHASES_ENABLED", "true")
    _auth(client)
    headers = {"Idempotency-Key": "test-idem-key-1"}
    first = client.post(
        "/api/billing/credit-packs/dev-purchase",
        json={"packKey": "pack_10"},
        headers=headers,
    )
    second = client.post(
        "/api/billing/credit-packs/dev-purchase",
        json={"packKey": "pack_10"},
        headers=headers,
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["idempotentReplay"] is True

    balance = client.get("/api/credits/balance").json()
    assert balance["permanentRemaining"] == 10


def test_dev_purchase_disabled_without_env(client, monkeypatch):
    monkeypatch.delenv("DEV_CREDIT_PURCHASES_ENABLED", raising=False)
    _auth(client)
    res = client.post("/api/billing/credit-packs/dev-purchase", json={"packKey": "pack_10"})
    assert res.status_code == 403


def test_dev_purchase_refused_in_staging(client, monkeypatch):
    monkeypatch.setenv("DEV_CREDIT_PURCHASES_ENABLED", "true")
    monkeypatch.setenv("ENV", "staging")
    _auth(client)
    res = client.post("/api/billing/credit-packs/dev-purchase", json={"packKey": "pack_10"})
    assert res.status_code == 403
    monkeypatch.setenv("ENV", "development")


def test_dev_purchase_unknown_pack(client, monkeypatch):
    monkeypatch.setenv("DEV_CREDIT_PURCHASES_ENABLED", "true")
    _auth(client)
    res = client.post("/api/billing/credit-packs/dev-purchase", json={"packKey": "unknown_pack"})
    assert res.status_code == 404


def test_dev_purchase_requires_auth(client, monkeypatch):
    monkeypatch.setenv("DEV_CREDIT_PURCHASES_ENABLED", "true")
    client.post("/api/auth/logout")
    res = client.post("/api/billing/credit-packs/dev-purchase", json={"packKey": "pack_10"})
    assert res.status_code == 401


def test_credit_checkout_creates_session_no_credits_yet(client, fake_stripe):
    _auth(client)
    before = client.get("/api/credits/balance").json()["permanentRemaining"]

    res = client.post("/api/billing/credit-packs/checkout", json={"packKey": "pack_10"})
    assert res.status_code == 200
    assert "checkout.stripe.test" in res.json()["checkoutUrl"]

    after = client.get("/api/credits/balance").json()["permanentRemaining"]
    assert after == before

    purchases = client.get("/api/billing/credit-purchases")
    assert purchases.json()["items"][0]["status"] == "pending"
    assert purchases.json()["items"][0]["analyses"] == 10


def test_credit_checkout_webhook_grants_credits(client, fake_stripe):
    _auth(client)
    client.post("/api/billing/credit-packs/checkout", json={"packKey": "pack_10"})
    session = next(iter(fake_stripe.checkout_sessions.values()))
    session["mode"] = "payment"
    session["payment_status"] = "paid"
    session["metadata"]["purchaseType"] = "credit_pack"

    event = {
        "id": f"evt_{uuid.uuid4().hex}",
        "type": "checkout.session.completed",
        "data": {"object": dict(session)},
    }
    wh = client.post(
        "/api/stripe/webhook",
        data=json.dumps(event),
        headers={"stripe-signature": "sig_test"},
    )
    assert wh.status_code == 200

    balance = client.get("/api/credits/balance").json()
    assert balance["permanentRemaining"] == 10

    replay = client.post(
        "/api/stripe/webhook",
        data=json.dumps(event),
        headers={"stripe-signature": "sig_test"},
    )
    assert replay.json()["status"] == "already_processed"
    balance2 = client.get("/api/credits/balance").json()
    assert balance2["permanentRemaining"] == 10


def test_credit_webhook_invalid_signature(client, fake_stripe):
    fake_stripe.construct_webhook_event = lambda *args, **kwargs: (_ for _ in ()).throw(Exception("bad sig"))
    res = client.post(
        "/api/stripe/webhook",
        data=b"{}",
        headers={"stripe-signature": "bad"},
    )
    assert res.status_code == 400


def test_dev_purchase_then_import_uses_credits(client, monkeypatch):
    monkeypatch.setenv("DEV_CREDIT_PURCHASES_ENABLED", "true")
    # Register without auto-trial (monthly bucket) so purchased permanent credits are consumed.
    monkeypatch.setenv("CREDITS_ENFORCED", "false")
    _auth(client)
    monkeypatch.setenv("CREDITS_ENFORCED", "true")

    client.post("/api/billing/credit-packs/dev-purchase", json={"packKey": "pack_10"})
    before = client.get("/api/credits/balance").json()
    assert before["permanentRemaining"] == 10
    assert before["monthlyRemaining"] == 0

    pdf_bytes = b"%PDF-1.4 credit purchase import test\n" + b"x" * 500
    analyze = client.post(
        "/api/imports/analyze",
        files={"file": ("devis.pdf", pdf_bytes, "application/pdf")},
    )
    assert analyze.status_code == 201

    balance = client.get("/api/credits/balance").json()
    assert balance["permanentRemaining"] < 10


def test_dev_credit_purchases_enabled_helper(monkeypatch):
    monkeypatch.setenv("ENV", "development")
    monkeypatch.setenv("DEV_CREDIT_PURCHASES_ENABLED", "true")
    assert dev_credit_purchases_enabled() is True
    monkeypatch.setenv("ENV", "production")
    assert dev_credit_purchases_enabled() is False
