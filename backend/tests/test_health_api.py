"""Smoke tests for backend health and auth endpoints."""

import uuid

from tests.conftest import register_user


def test_health_endpoint_returns_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("status") == "ok"


def test_ready_endpoint_returns_mongo_ok(client):
    response = client.get("/api/ready")
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("status") == "ready"
    assert payload.get("mongo") == "ok"


def test_register_and_login_flow(client):
    email = f"pytest-{uuid.uuid4().hex}@example.com"
    password = "PyTestPassword123!"
    register = client.post(
        "/api/auth/register",
        json={
            "firstName": "Py",
            "lastName": "Test",
            "companyName": "PyTest Co",
            "email": email,
            "password": password,
        },
    )
    assert register.status_code in (200, 201)
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json().get("email") == email


def test_validation_error_uses_message_detail_shape(client):
    response = client.post("/api/auth/login", json={"email": "not-an-email", "password": ""})
    assert response.status_code == 422
    payload = response.json()
    detail = payload.get("detail")
    assert isinstance(detail, dict)
    assert isinstance(detail.get("message"), str)
    assert detail["message"]
