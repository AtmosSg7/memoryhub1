"""Auth flow tests: register, login, logout, reset password."""

import uuid

from tests.conftest import login_user, register_user, user_reset_token


def test_logout_clears_session(client):
    register_user(client)
    me = client.get("/api/auth/me")
    assert me.status_code == 200

    logout = client.post("/api/auth/logout")
    assert logout.status_code == 200

    me_after = client.get("/api/auth/me")
    assert me_after.status_code == 401


def test_login_wrong_password(client):
    email, password = register_user(client)
    bad = client.post("/api/auth/login", json={"email": email, "password": "WrongPassword99!"})
    assert bad.status_code == 401


def test_register_duplicate_email(client):
    suffix = uuid.uuid4().hex
    email = f"dup-{suffix}@example.com"
    register_user(client, email=email)
    client.post("/api/auth/logout")
    dup = client.post(
        "/api/auth/register",
        json={
            "firstName": "A",
            "lastName": "B",
            "companyName": "Co",
            "email": email,
            "password": "AnotherPass123!",
        },
    )
    assert dup.status_code == 409


def test_forgot_password_neutral_response(client):
    res = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert res.status_code == 200
    assert "message" in res.json()


def test_reset_password_flow(client):
    email, password = register_user(client)
    forgot = client.post("/api/auth/forgot-password", json={"email": email})
    assert forgot.status_code == 200

    token = user_reset_token(email)
    assert token

    reset = client.post(
        "/api/auth/reset-password",
        json={"token": token, "password": "NewSecurePass456!"},
    )
    assert reset.status_code == 200

    client.post("/api/auth/logout")
    old_login = client.post("/api/auth/login", json={"email": email, "password": password})
    assert old_login.status_code == 401

    login_user(client, email, "NewSecurePass456!")
    me = client.get("/api/auth/me")
    assert me.status_code == 200


def test_reset_password_token_single_use(client):
    email, _ = register_user(client)
    client.post("/api/auth/forgot-password", json={"email": email})

    token = user_reset_token(email)
    assert token

    first = client.post(
        "/api/auth/reset-password",
        json={"token": token, "password": "OnceOnlyPass789!"},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/auth/reset-password",
        json={"token": token, "password": "AgainPass789!!"},
    )
    assert second.status_code == 400


def test_verify_email_invalid_token(client):
    res = client.post("/api/auth/verify-email", json={"token": "invalid-token-value"})
    assert res.status_code == 400
