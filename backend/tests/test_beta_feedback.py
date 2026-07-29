"""Tests for beta feedback — isolation, validation, no CRM leakage."""

import os
import uuid

from pymongo import MongoClient

from tests.conftest import login_user, register_user


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def test_beta_feedback_create_and_isolation(client):
    email_a, password_a = register_user(client, suffix=f"bfa-{uuid.uuid4().hex[:8]}")
    login_user(client, email_a, password_a)
    res = client.post(
        "/api/beta/feedback",
        json={
            "intent": "Créer un devis",
            "blocker": "Bouton peu visible",
            "suggestion": "Mettre le bouton plus haut",
            "page": "/dashboard/documents?client=secret-should-strip",
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["id"]
    assert "Merci" in body["message"] or "Thank" in body["message"] or body["message"]

    db = _mongo()
    doc = db.beta_feedback.find_one({"id": body["id"]}, {"_id": 0})
    assert doc is not None
    assert doc["page"] == "/dashboard/documents"
    assert "secret" not in (doc.get("page") or "")
    assert "password" not in doc
    assert "token" not in doc
    user_a = db.users.find_one({"email": email_a}, {"_id": 0, "id": 1})
    assert doc["userId"] == user_a["id"]

    client.post("/api/auth/logout")
    email_b, password_b = register_user(client, suffix=f"bfb-{uuid.uuid4().hex[:8]}")
    login_user(client, email_b, password_b)
    # No list endpoint in this sprint — ensure user B cannot infer A's id via create shape only.
    res_b = client.post(
        "/api/beta/feedback",
        json={"intent": "Autre chose", "page": "/dashboard"},
    )
    assert res_b.status_code == 201, res_b.text
    assert res_b.json()["id"] != body["id"]


def test_beta_feedback_requires_auth(client):
    client.post("/api/auth/logout")
    res = client.post("/api/beta/feedback", json={"intent": "test"})
    assert res.status_code == 401


def test_beta_feedback_validation(client):
    email, password = register_user(client, suffix=f"bfv-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)
    res = client.post("/api/beta/feedback", json={"intent": ""})
    assert res.status_code == 422
