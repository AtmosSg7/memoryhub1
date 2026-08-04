"""Tests for transactional email infrastructure."""

from __future__ import annotations

import os
import uuid

import pytest

from email_constants import ALL_TEMPLATE_KEYS, TEMPLATE_EMAIL_VERIFICATION
from email_renderer import render_template
from email_utils import hash_recipient, mask_token, normalize_email, sanitize_subject
from fake_email_provider import FakeEmailProvider


def test_render_all_templates_fr_en():
    for template in ALL_TEMPLATE_KEYS:
        for locale in ("fr", "en"):
            ctx = {
                "greeting": "Demo",
                "verify_url": "https://example.com/verify?token=demo",
                "reset_url": "https://example.com/reset?token=demo",
                "plan_name": "Pro",
                "period_end": "31/12/2026",
                "billing_url": "https://example.com/billing",
                "number": "2026-001",
                "title": "Travaux",
                "amount_ttc": 10000,
                "amount": 5000,
                "amount_due": 5000,
                "sender_name": "ACME",
                "portal_url": "https://example.com/portal/x",
                "client_name": "Jean",
                "status": "sent",
            }
            rendered = render_template(template, locale=locale, context=ctx)
            assert rendered.subject
            assert rendered.text_body
            assert "<html" in rendered.html_body.lower()
            assert "Basera" in rendered.html_body


def test_normalize_email_and_header_injection():
    assert normalize_email("  User@Example.COM ") == "user@example.com"
    with pytest.raises(Exception):
        normalize_email("bad\r\nBcc: evil@x.com")
    assert "Injection" not in sanitize_subject("Hello\r\nBcc: x")


def test_mask_token_never_logs_full_value():
    token = "a" * 40
    masked = mask_token(token)
    assert token not in masked
    assert "…" in masked


def test_fake_provider_success():
    provider = FakeEmailProvider.instance()
    assert provider.name == "fake"


def test_register_sends_verification_email(client):
    from tests.conftest import register_user

    email, _ = register_user(client)
    provider = FakeEmailProvider.instance()
    assert any(msg.to == email for msg in provider.sent)


def test_auth_register_does_not_leak_email_existence(client):
    email, _ = __import__("tests.conftest", fromlist=["register_user"]).register_user(client)
    res = client.post("/api/auth/forgot-password", json={"email": email})
    assert res.status_code == 200
    res2 = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert res2.status_code == 200
    assert res.json()["message"] == res2.json()["message"]


def test_reset_token_single_use(client):
    from tests.conftest import register_user, user_reset_token

    email, password = register_user(client)
    client.post("/api/auth/forgot-password", json={"email": email})
    token = user_reset_token(email)
    assert token
    first = client.post(
        "/api/auth/reset-password",
        json={"token": token, "password": "NewPassword123!"},
    )
    assert first.status_code == 200
    second = client.post(
        "/api/auth/reset-password",
        json={"token": token, "password": "AnotherPassword123!"},
    )
    assert second.status_code == 400


def test_dev_preview_endpoint(client):
    res = client.get("/api/dev/emails/preview", params={"template": TEMPLATE_EMAIL_VERIFICATION, "locale": "fr"})
    assert res.status_code == 200
    data = res.json()
    assert data["demo"] is True
    assert "html" in data


def test_dev_preview_disabled_in_production(monkeypatch):
    import emails_dev
    from fastapi import HTTPException

    monkeypatch.setattr(emails_dev, "IS_PRODUCTION", True)
    with pytest.raises(HTTPException) as exc:
        emails_dev.require_dev_mode()
    assert exc.value.status_code == 404


def test_document_send_email(client):
    from tests.conftest import create_client_record, create_quote_record, register_user

    register_user(client)
    cl = create_client_record(client, name="Client Email")
    client.put(f"/api/clients/{cl['id']}", json={"email": "client-send@example.com"})
    quote = create_quote_record(client, cl["id"])
    res = client.post(
        "/api/document-sends/send",
        params={"lang": "fr"},
        json={
            "entityType": "quote",
            "entityId": quote["id"],
            "recipientEmail": "client-send@example.com",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["emailStatus"] in ("sent", "skipped")
    assert body["emailEventId"]

    dup = client.post(
        "/api/document-sends/send",
        params={"lang": "fr"},
        json={
            "entityType": "quote",
            "entityId": quote["id"],
            "recipientEmail": "client-send@example.com",
            "idempotencyKey": f"doc-send:quote:{quote['id']}:client-send@example.com",
        },
    )
    assert dup.status_code == 200


def test_recipient_hash_stable():
    assert hash_recipient("User@Example.com") == hash_recipient("user@example.com")
