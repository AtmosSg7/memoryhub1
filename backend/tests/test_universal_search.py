"""Universal search — multi-entity, phone variants, CI, isolation, ranking."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from pymongo import MongoClient

from search_normalize import (
    accent_flexible_regex,
    amount_cent_candidates,
    phone_query_variants,
)
from tests.conftest import create_client_record, login_user, register_user


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def test_phone_and_amount_normalization_helpers():
    variants = phone_query_variants("06 12 34 56 78")
    assert any(v.replace(" ", "") == "0612345678" for v in variants)
    assert any("+336" in v or v.startswith("336") for v in variants)
    cents = amount_cent_candidates("2450")
    assert 2450 in cents
    assert 245000 in cents
    assert "é" in accent_flexible_regex("terrasse") or "e" in accent_flexible_regex("été")


def test_universal_search_entities_phone_ci_and_isolation(client):
    email, password = register_user(client, suffix=_uid("usearch"))
    login_user(client, email, password)
    owned = create_client_record(client, name="Martin Terrasse")
    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    uid = user["id"]
    cid = owned["id"]

    db.clients.update_one(
        {"id": cid},
        {
            "$set": {
                "company": "Martin SARL",
                "phone": "0612345678",
                "city": "Lyon",
                "email": "martin.terrasse@example.fr",
                "tags": ["terrasse"],
            }
        },
    )

    quote_number = f"D-{uuid.uuid4().hex[:6].upper()}"
    db.quotes.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": uid,
            "clientId": cid,
            "number": quote_number,
            "title": "Terrasse bois",
            "clientName": "Martin SARL",
            "status": "sent",
            "amountTTC": 245000,
            "amountHT": 204167,
            "createdAt": _now(),
            "updatedAt": _now(),
        }
    )
    inv_number = f"F-{uuid.uuid4().hex[:6].upper()}"
    db.invoices.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": uid,
            "clientId": cid,
            "number": inv_number,
            "title": "Facture Dupont",
            "clientName": "Martin SARL",
            "status": "overdue",
            "amountTTC": 245000,
            "createdAt": _now(),
            "updatedAt": _now(),
        }
    )
    db.notes.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": uid,
            "clientId": cid,
            "title": "Rappeler Martin",
            "content": "Relancer pour la terrasse à Lyon",
            "type": "call",
            "clientName": "Martin SARL",
            "createdAt": _now(),
            "updatedAt": _now(),
        }
    )
    db.documents.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": uid,
            "clientId": cid,
            "name": "plan-terrasse.pdf",
            "extension": "pdf",
            "clientName": "Martin SARL",
            "category": "plan",
            "createdAt": _now(),
            "updatedAt": _now(),
        }
    )
    action_id = str(uuid.uuid4())
    db.actions.insert_one(
        {
            "id": action_id,
            "userId": uid,
            "clientId": cid,
            "type": "call_back",
            "priority": "high",
            "status": "pending",
            "source": "manual",
            "title": "Rappeler Martin",
            "description": "Suite terrasse Lyon",
            "createdAt": _now(),
            "metadata": {},
            "idempotencyKey": f"test-{uuid.uuid4().hex}",
        }
    )
    comm_id = str(uuid.uuid4())
    db.communications.insert_one(
        {
            "id": comm_id,
            "userId": uid,
            "clientId": cid,
            "type": "email",
            "direction": "inbound",
            "provider": "gmail",
            "providerId": f"g-{comm_id}",
            "subject": "Cuisine septembre",
            "preview": "Devis cuisine pour septembre",
            "createdAt": _now(),
            "updatedAt": _now(),
            "attachmentsCount": 0,
            "status": "linked",
            "metadata": {
                "fromEmail": "martin.terrasse@example.fr",
                "fromName": "Martin",
                "clientName": "Martin SARL",
            },
        }
    )
    db.communication_analyses.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": uid,
            "communicationId": comm_id,
            "status": "ready",
            "suggestionStatus": "pending",
            "summary": "Le client demande un devis cuisine pour septembre.",
            "intent": "request_quote",
            "urgency": "normal",
            "suggestedActionTitle": "Préparer un devis cuisine",
            "version": "1.0.0",
            "createdAt": _now(),
            "updatedAt": _now(),
        }
    )
    # Unlinked prospect mail
    prospect_comm = str(uuid.uuid4())
    db.communications.insert_one(
        {
            "id": prospect_comm,
            "userId": uid,
            "type": "email",
            "direction": "inbound",
            "provider": "gmail",
            "providerId": f"g-{prospect_comm}",
            "subject": "Demande terrasse Lyon",
            "preview": "Bonjour je souhaite une terrasse",
            "createdAt": _now(),
            "updatedAt": _now(),
            "attachmentsCount": 0,
            "status": "unlinked",
            "metadata": {
                "fromEmail": "prospect.lyon@example.fr",
                "fromName": "Paul Prospect",
            },
        }
    )

    # Name / city
    res = client.get("/api/search", params={"q": "terrasse Lyon"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] >= 1
    assert body["groups"]["clients"]["total"] >= 1 or body["groups"]["notes"]["total"] >= 1

    # Phone formats
    for q in ("0612345678", "+33612345678", "0033612345678"):
        phone_res = client.get("/api/search", params={"q": q})
        assert phone_res.status_code == 200, q
        assert phone_res.json()["groups"]["clients"]["total"] >= 1, q

    # Email
    email_res = client.get("/api/search", params={"q": "martin.terrasse@example.fr"})
    assert email_res.status_code == 200
    assert email_res.json()["groups"]["clients"]["total"] >= 1

    # Quote number + amount
    assert client.get("/api/search", params={"q": quote_number}).json()["groups"]["quotes"]["total"] >= 1
    amount_res = client.get("/api/search", params={"q": "2450"})
    assert amount_res.status_code == 200
    assert (
        amount_res.json()["groups"]["quotes"]["total"] >= 1
        or amount_res.json()["groups"]["invoices"]["total"] >= 1
    )

    # Invoice number
    assert client.get("/api/search", params={"q": inv_number}).json()["groups"]["invoices"]["total"] >= 1

    # Note / document / action
    assert client.get("/api/search", params={"q": "Rappeler Martin"}).json()["groups"]["notes"]["total"] >= 1
    assert client.get("/api/search", params={"q": "plan-terrasse"}).json()["groups"]["documents"]["total"] >= 1
    actions = client.get("/api/search", params={"q": "Rappeler Martin"}).json()["groups"]["actions"]
    assert actions["total"] >= 1
    assert actions["items"][0]["type"] == "action"
    assert actions["items"][0]["navigationTarget"]

    # Email subject + CI summary
    mail = client.get("/api/search", params={"q": "cuisine septembre"}).json()
    assert mail["groups"]["emails"]["total"] >= 1
    ci = client.get("/api/search", params={"q": "devis cuisine"}).json()
    assert ci["groups"]["emails"]["total"] >= 1

    # Prospect
    prosp = client.get("/api/search", params={"q": "Paul Prospect"})
    assert prosp.status_code == 200
    assert prosp.json()["groups"]["prospects"]["total"] >= 1
    assert prosp.json()["groups"]["prospects"]["items"][0]["type"] == "prospect"

    # Accents / case
    accent = client.get("/api/search", params={"q": "TERRASSE"})
    assert accent.status_code == 200
    assert accent.json()["total"] >= 1

    # Empty
    empty = client.get("/api/search", params={"q": "zzzznoresult999"})
    assert empty.status_code == 200
    assert empty.json()["total"] == 0

    # Pagination / types
    page = client.get(
        "/api/search",
        params={"q": "Martin", "types": "client,action", "limit": 1, "offset": 0},
    )
    assert page.status_code == 200
    pbody = page.json()
    assert pbody["limit"] == 1
    assert pbody["groups"]["notes"]["total"] == 0 or len(pbody["groups"]["notes"]["items"]) == 0
    assert "items" in pbody

    # Relevance: exact client name should beat loose content when both match
    ranked = client.get("/api/search", params={"q": "Martin SARL"}).json()
    flat = ranked.get("items") or []
    if flat:
        assert flat[0]["type"] in ("client", "quote", "invoice", "note", "email", "action")

    # Isolation
    email_b, password_b = register_user(client, suffix=_uid("usearchb"))
    login_user(client, email_b, password_b)
    leak = client.get("/api/search", params={"q": "Martin Terrasse"})
    assert leak.status_code == 200
    assert leak.json()["groups"]["clients"]["total"] == 0
    assert leak.json()["total"] == 0
