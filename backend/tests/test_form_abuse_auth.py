"""Targeted abuse / auth hardening tests for real-user launch."""

import os
import time
import uuid

import pytest

from tests.conftest import login_user, register_user, user_reset_token


@pytest.fixture
def force_form_abuse(monkeypatch):
    monkeypatch.setenv("FORM_ABUSE_FORCE", "1")
    monkeypatch.setenv("FORM_MIN_SUBMIT_SECONDS", "1.2")
    yield
    monkeypatch.delenv("FORM_ABUSE_FORCE", raising=False)


def test_register_honeypot_rejected(client, force_form_abuse):
    res = client.post(
        "/api/auth/register",
        json={
            "firstName": "Bot",
            "lastName": "Spam",
            "companyName": "SpamCo",
            "email": f"bot-{uuid.uuid4().hex}@example.com",
            "password": "BotPassword123!",
            "website": "https://spam.example",
            "formStartedAt": time.time() - 5,
        },
    )
    assert res.status_code == 400
    assert "password" not in res.text.lower() or "passwordHash" not in res.text


def test_login_honeypot_rejected(client, force_form_abuse):
    email, password = register_user(client, suffix=f"hp-{uuid.uuid4().hex[:8]}")
    client.post("/api/auth/logout")
    res = client.post(
        "/api/auth/login",
        json={
            "email": email,
            "password": password,
            "website": "filled-by-bot",
            "formStartedAt": time.time() - 5,
        },
    )
    assert res.status_code == 400


def test_login_too_fast_rejected(client, force_form_abuse):
    email, password = register_user(client, suffix=f"fast-{uuid.uuid4().hex[:8]}")
    client.post("/api/auth/logout")
    res = client.post(
        "/api/auth/login",
        json={
            "email": email,
            "password": password,
            "website": "",
            "formStartedAt": time.time(),
        },
    )
    assert res.status_code == 400


def test_forgot_password_honeypot_neutral(client, force_form_abuse):
    res = client.post(
        "/api/auth/forgot-password",
        json={
            "email": "nobody@example.com",
            "website": "http://evil.test",
            "formStartedAt": time.time() - 5,
        },
    )
    assert res.status_code == 200
    assert "message" in res.json()


def test_login_unknown_user_no_enumeration(client):
    res = client.post(
        "/api/auth/login",
        json={"email": "does-not-exist@example.com", "password": "Whatever123!"},
    )
    assert res.status_code == 401
    assert res.json()["detail"]["message"] == "Invalid email or password."


def test_register_response_has_no_password_hash(client):
    email = f"safe-{uuid.uuid4().hex}@example.com"
    res = client.post(
        "/api/auth/register",
        json={
            "firstName": "Safe",
            "lastName": "User",
            "companyName": "SafeCo",
            "email": email,
            "password": "SafePassword123!",
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert "password" not in body
    assert "passwordHash" not in body
    assert "passwordHash" not in str(body.get("user", {}))


def test_verify_email_expired_token(client):
    email, _ = register_user(client, suffix=f"exp-{uuid.uuid4().hex[:8]}")
    from pymongo import MongoClient

    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    user = db.users.find_one({"email": email})
    token = user["emailVerificationToken"]
    db.users.update_one(
        {"email": email},
        {"$set": {"emailVerificationExpires": "2000-01-01T00:00:00+00:00"}},
    )
    res = client.post("/api/auth/verify-email", json={"token": token})
    assert res.status_code == 400


def test_resend_verification(client):
    email, password = register_user(client, suffix=f"rsnd-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)
    res = client.post("/api/auth/resend-verification")
    assert res.status_code == 200
    assert "message" in res.json()


def test_beta_feedback_honeypot_rejected(client, force_form_abuse):
    email, password = register_user(client, suffix=f"bfhp-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)
    res = client.post(
        "/api/beta/feedback",
        json={
            "intent": "Spam",
            "website": "http://bot.test",
            "formStartedAt": time.time() - 5,
        },
    )
    assert res.status_code == 400


def test_reset_password_invalid_token(client):
    res = client.post(
        "/api/auth/reset-password",
        json={"token": "not-a-real-token", "password": "NewPassword123!"},
    )
    assert res.status_code == 400
