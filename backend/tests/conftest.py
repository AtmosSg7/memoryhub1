"""Shared pytest configuration for backend tests."""

import os
import uuid

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "memoryhub_test")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-at-least-32-characters-long")
os.environ.setdefault("ENV", "development")
os.environ.setdefault("E2E_DISABLE_RATE_LIMIT", "1")
os.environ.setdefault("EMAIL_PROVIDER", "fake")
os.environ.setdefault("CREDITS_ENFORCED", "false")
os.environ["ANALYZER_PROVIDER"] = "mock"

from analysis.factory import reset_analyzer_for_tests  # noqa: E402

reset_analyzer_for_tests()

import server  # noqa: E402
from email_provider import reset_provider_for_tests, set_provider_for_tests  # noqa: E402
from fake_email_provider import FakeEmailProvider  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(server.app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def _fake_email_provider():
    FakeEmailProvider.reset()
    set_provider_for_tests(FakeEmailProvider.instance())
    yield
    FakeEmailProvider.reset()
    reset_provider_for_tests()


@pytest.fixture(autouse=True)
def _clear_auth_cookie(client):
    client.post("/api/auth/logout")
    yield


def register_user(
    client: TestClient,
    *,
    suffix: str = None,
    email: str = None,
    password: str = "PyTestPassword123!",
    first_name: str = "Py",
    last_name: str = "Test",
    company_name: str = "PyTest Co",
):
    suffix = suffix or uuid.uuid4().hex
    resolved_email = email or f"pytest-{suffix}@example.com"
    res = client.post(
        "/api/auth/register",
        json={
            "firstName": first_name,
            "lastName": last_name,
            "companyName": company_name,
            "email": resolved_email,
            "password": password,
        },
    )
    assert res.status_code in (200, 201), f"Register failed: {res.status_code} {res.text}"
    return resolved_email, password


def login_user(client: TestClient, email: str, password: str) -> None:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed: {res.status_code} {res.text}"


def create_client_record(client: TestClient, name: str = "Client Test"):
    res = client.post("/api/clients", json={"name": name, "status": "active"})
    assert res.status_code in (200, 201), res.text
    return res.json()


def create_quote_record(client: TestClient, client_id: str):
    res = client.post(
        "/api/quotes",
        json={
            "clientId": client_id,
            "title": "Devis test",
            "amountHT": 10000,
            "vatRate": 20,
            "status": "sent",
        },
    )
    assert res.status_code in (200, 201), res.text
    return res.json()


def user_reset_token(email: str):
    mongo = MongoClient(os.environ["MONGO_URL"])
    doc = mongo[os.environ["DB_NAME"]].users.find_one({"email": email.lower()})
    return doc.get("passwordResetToken") if doc else None
