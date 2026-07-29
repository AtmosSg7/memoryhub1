"""Stripe integration tests — mocked Stripe backend, no network."""

from __future__ import annotations

import json
import os
import uuid

import pytest
from fastapi.testclient import TestClient

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
os.environ["STRIPE_SUCCESS_URL"] = "http://localhost:3000/dashboard/billing?checkout=success"
os.environ["STRIPE_CANCEL_URL"] = "http://localhost:3000/dashboard/billing?checkout=cancel"

import stripe_service  # noqa: E402
from stripe_service import set_stripe_backend  # noqa: E402
import server  # noqa: E402
from tests.conftest import login_user, register_user  # noqa: E402


class FakeStripeObject(dict):
    def __getattr__(self, key):
        try:
            return self[key]
        except KeyError as exc:
            raise AttributeError(key) from exc


class FakeStripeBackend:
    def __init__(self):
        self.customers = {}
        self.subscriptions = {}
        self.checkout_sessions = {}
        self.portal_sessions = {}
        self.events = {}

    def create_customer(self, *, email, name, metadata):
        cid = f"cus_{uuid.uuid4().hex[:12]}"
        obj = FakeStripeObject(id=cid, email=email, name=name, metadata=metadata)
        self.customers[cid] = obj
        return obj

    def create_checkout_session(
        self,
        *,
        customer_id,
        price_id,
        success_url,
        cancel_url,
        metadata,
        trial_period_days=None,
        mode="subscription",
    ):
        if mode == "payment":
            return self.create_payment_checkout_session(
                customer_id=customer_id,
                price_id=price_id,
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata,
            )
        sid = f"cs_{uuid.uuid4().hex[:12]}"
        sub_id = f"sub_{uuid.uuid4().hex[:12]}"
        self._ensure_subscription(sub_id, customer_id, price_id, metadata, trial=trial_period_days)
        obj = FakeStripeObject(
            id=sid,
            url=f"https://checkout.stripe.test/{sid}",
            customer=customer_id,
            subscription=sub_id,
            metadata=metadata,
            mode="subscription",
        )
        self.checkout_sessions[sid] = obj
        return obj

    def create_payment_checkout_session(
        self,
        *,
        customer_id,
        price_id,
        success_url,
        cancel_url,
        metadata,
    ):
        sid = f"cs_{uuid.uuid4().hex[:12]}"
        obj = FakeStripeObject(
            id=sid,
            url=f"https://checkout.stripe.test/{sid}",
            customer=customer_id,
            metadata=metadata,
            mode="payment",
            payment_status="paid",
            payment_intent=f"pi_{uuid.uuid4().hex[:12]}",
        )
        self.checkout_sessions[sid] = obj
        return obj

    def create_portal_session(self, *, customer_id, return_url):
        pid = f"bps_{uuid.uuid4().hex[:12]}"
        obj = FakeStripeObject(id=pid, url=f"https://billing.stripe.test/{pid}")
        self.portal_sessions[pid] = obj
        return obj

    def retrieve_subscription(self, subscription_id):
        return self.subscriptions[subscription_id]

    def modify_subscription_price(self, subscription_id, *, item_id, price_id, proration_behavior):
        sub = self.subscriptions[subscription_id]
        sub["items"]["data"][0]["price"]["id"] = price_id
        return sub

    def schedule_downgrade_at_period_end(
        self,
        subscription_id,
        *,
        item_id,
        current_price_id,
        new_price_id,
        period_end_ts,
    ):
        return FakeStripeObject(id=f"sub_sched_{uuid.uuid4().hex[:8]}", subscription=subscription_id)

    def construct_webhook_event(self, payload, sig_header, webhook_secret):
        data = json.loads(payload.decode())
        return FakeStripeObject(**data)

    def _ensure_subscription(self, sub_id, customer_id, price_id, metadata, trial=False):
        import time

        now = int(time.time())
        self.subscriptions[sub_id] = FakeStripeObject(
            id=sub_id,
            customer=customer_id,
            status="trialing" if trial else "active",
            metadata=metadata,
            current_period_start=now,
            current_period_end=now + 30 * 24 * 3600,
            trial_end=now + 14 * 24 * 3600 if trial else None,
            cancel_at_period_end=False,
            items=FakeStripeObject(
                data=[
                    FakeStripeObject(
                        id=f"si_{uuid.uuid4().hex[:8]}",
                        price=FakeStripeObject(id=price_id),
                    )
                ]
            ),
        )


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


def test_billing_me_without_subscription(client):
    _auth(client)
    res = client.get("/api/billing/me")
    assert res.status_code == 200
    data = res.json()
    assert data["stripeConfigured"] is True
    assert data["hasSubscription"] is False
    assert data["actions"]["canCheckout"] is True


def test_checkout_creates_session(client, fake_stripe):
    _auth(client)
    res = client.post("/api/billing/checkout", json={"planId": "solo"})
    assert res.status_code == 200
    assert "checkout.stripe.test" in res.json()["checkoutUrl"]
    assert len(fake_stripe.checkout_sessions) == 1


def test_checkout_invalid_plan(client):
    _auth(client)
    res = client.post("/api/billing/checkout", json={"planId": "invalid"})
    assert res.status_code == 404


def test_checkout_when_already_subscribed(client, fake_stripe):
    _auth(client)
    client.post("/api/billing/checkout", json={"planId": "solo"})
    event = _checkout_completed_event(fake_stripe)
    wh = client.post(
        "/api/stripe/webhook",
        data=json.dumps(event),
        headers={"stripe-signature": "sig_test"},
    )
    assert wh.status_code == 200

    again = client.post("/api/billing/checkout", json={"planId": "pro"})
    assert again.status_code == 409


def test_webhook_invalid_signature(client, fake_stripe):
    fake_stripe.construct_webhook_event = lambda *args, **kwargs: (_ for _ in ()).throw(Exception("bad sig"))
    res = client.post(
        "/api/stripe/webhook",
        data=b"{}",
        headers={"stripe-signature": "bad"},
    )
    assert res.status_code == 400


def test_webhook_checkout_completed_activates_subscription(client, fake_stripe):
    _auth(client)
    client.post("/api/billing/checkout", json={"planId": "solo"})
    event = _checkout_completed_event(fake_stripe)
    res = client.post(
        "/api/stripe/webhook",
        data=json.dumps(event),
        headers={"stripe-signature": "sig_test"},
    )
    assert res.status_code == 200

    me = client.get("/api/billing/me")
    assert me.status_code == 200
    body = me.json()
    assert body["hasSubscription"] is True
    assert body["planId"] == "solo"
    assert body["monthlyAnalysesRemaining"] == 20


def test_webhook_idempotent_replay(client, fake_stripe):
    _auth(client)
    client.post("/api/billing/checkout", json={"planId": "solo"})
    event = _checkout_completed_event(fake_stripe)

    first = client.post(
        "/api/stripe/webhook",
        data=json.dumps(event),
        headers={"stripe-signature": "sig_test"},
    )
    second = client.post(
        "/api/stripe/webhook",
        data=json.dumps(event),
        headers={"stripe-signature": "sig_test"},
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["status"] == "already_processed"

    balance = client.get("/api/credits/balance")
    assert balance.json()["monthlyRemaining"] == 20


def _activate_fake_subscription(fake_stripe: FakeStripeBackend) -> None:
    sub = next(iter(fake_stripe.subscriptions.values()))
    sub["status"] = "active"
    sub["trial_end"] = None


def _subscription_updated_event(fake_stripe: FakeStripeBackend) -> dict:
    sub = next(iter(fake_stripe.subscriptions.values()))
    return {
        "id": f"evt_{uuid.uuid4().hex}",
        "type": "customer.subscription.updated",
        "data": {"object": dict(sub)},
    }


def test_invoice_paid_renews_credits_once(client, fake_stripe):
    _auth(client)
    client.post("/api/billing/checkout", json={"planId": "solo"})
    checkout_event = _checkout_completed_event(fake_stripe)
    client.post(
        "/api/stripe/webhook",
        data=json.dumps(checkout_event),
        headers={"stripe-signature": "sig_test"},
    )

    _activate_fake_subscription(fake_stripe)
    client.post(
        "/api/stripe/webhook",
        data=json.dumps(_subscription_updated_event(fake_stripe)),
        headers={"stripe-signature": "sig_test"},
    )

    user = client.get("/api/billing/me").json()
    assert user["monthlyAnalysesRemaining"] == 20

    invoice_event = _invoice_paid_event(fake_stripe, billing_reason="subscription_cycle")
    client.post(
        "/api/stripe/webhook",
        data=json.dumps(invoice_event),
        headers={"stripe-signature": "sig_test"},
    )
    replay = client.post(
        "/api/stripe/webhook",
        data=json.dumps(invoice_event),
        headers={"stripe-signature": "sig_test"},
    )
    assert replay.json()["status"] == "already_processed"


def test_invoice_payment_failed_marks_past_due(client, fake_stripe):
    _auth(client)
    client.post("/api/billing/checkout", json={"planId": "solo"})
    client.post(
        "/api/stripe/webhook",
        data=json.dumps(_checkout_completed_event(fake_stripe)),
        headers={"stripe-signature": "sig_test"},
    )
    _activate_fake_subscription(fake_stripe)
    client.post(
        "/api/stripe/webhook",
        data=json.dumps(_subscription_updated_event(fake_stripe)),
        headers={"stripe-signature": "sig_test"},
    )

    fail_event = _invoice_failed_event(fake_stripe)
    res = client.post(
        "/api/stripe/webhook",
        data=json.dumps(fail_event),
        headers={"stripe-signature": "sig_test"},
    )
    assert res.status_code == 200
    me = client.get("/api/billing/me")
    assert me.json()["subscriptionStatus"] == "past_due"


def test_subscription_deleted_cancels(client, fake_stripe):
    _auth(client)
    client.post("/api/billing/checkout", json={"planId": "solo"})
    client.post(
        "/api/stripe/webhook",
        data=json.dumps(_checkout_completed_event(fake_stripe)),
        headers={"stripe-signature": "sig_test"},
    )

    deleted = _subscription_deleted_event(fake_stripe)
    res = client.post(
        "/api/stripe/webhook",
        data=json.dumps(deleted),
        headers={"stripe-signature": "sig_test"},
    )
    assert res.status_code == 200
    me = client.get("/api/billing/me")
    assert me.json()["subscriptionStatus"] == "cancelled"


def test_portal_requires_customer(client, fake_stripe):
    _auth(client)
    res = client.post("/api/billing/portal")
    assert res.status_code == 400

    client.post("/api/billing/checkout", json={"planId": "solo"})
    client.post(
        "/api/stripe/webhook",
        data=json.dumps(_checkout_completed_event(fake_stripe)),
        headers={"stripe-signature": "sig_test"},
    )
    portal = client.post("/api/billing/portal")
    assert portal.status_code == 200
    assert "billing.stripe.test" in portal.json()["portalUrl"]


def test_change_plan_upgrade(client, fake_stripe):
    _auth(client)
    client.post("/api/billing/checkout", json={"planId": "solo"})
    client.post(
        "/api/stripe/webhook",
        data=json.dumps(_checkout_completed_event(fake_stripe)),
        headers={"stripe-signature": "sig_test"},
    )

    res = client.post("/api/billing/change-plan", json={"planId": "pro"})
    assert res.status_code == 200
    assert res.json()["effective"] == "immediate"


def test_stripe_not_configured(client, monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    _auth(client)
    res = client.post("/api/billing/checkout", json={"planId": "solo"})
    assert res.status_code == 503


def test_unknown_webhook_event_ignored(client):
    event = {
        "id": f"evt_{uuid.uuid4().hex}",
        "type": "customer.created",
        "data": {"object": {}},
    }
    res = client.post(
        "/api/stripe/webhook",
        data=json.dumps(event),
        headers={"stripe-signature": "sig_test"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ignored"


def _checkout_completed_event(fake_stripe: FakeStripeBackend) -> dict:
    session = next(iter(fake_stripe.checkout_sessions.values()))
    return {
        "id": f"evt_{uuid.uuid4().hex}",
        "type": "checkout.session.completed",
        "data": {"object": dict(session)},
    }


def _invoice_paid_event(fake_stripe: FakeStripeBackend, *, billing_reason: str) -> dict:
    sub = next(iter(fake_stripe.subscriptions.values()))
    return {
        "id": f"evt_{uuid.uuid4().hex}",
        "type": "invoice.paid",
        "data": {
            "object": {
                "id": f"in_{uuid.uuid4().hex}",
                "customer": sub["customer"],
                "billing_reason": billing_reason,
            }
        },
    }


def _invoice_failed_event(fake_stripe: FakeStripeBackend) -> dict:
    sub = next(iter(fake_stripe.subscriptions.values()))
    return {
        "id": f"evt_{uuid.uuid4().hex}",
        "type": "invoice.payment_failed",
        "data": {"object": {"id": f"in_{uuid.uuid4().hex}", "customer": sub["customer"]}},
    }


def _subscription_deleted_event(fake_stripe: FakeStripeBackend) -> dict:
    sub = next(iter(fake_stripe.subscriptions.values()))
    return {
        "id": f"evt_{uuid.uuid4().hex}",
        "type": "customer.subscription.deleted",
        "data": {"object": dict(sub)},
    }
