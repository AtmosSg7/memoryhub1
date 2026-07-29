"""Portal public access security tests."""

import os
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient

from tests.conftest import create_client_record, create_quote_record, register_user

DECISION_BODY = {"signerName": "Jean Dupont", "comment": "Merci pour le devis."}


def _portal_setup(client):
    register_user(client)
    owned_client = create_client_record(client, name="Portal Client")
    quote = create_quote_record(client, owned_client["id"])
    portal = client.post(f"/api/clients/{owned_client['id']}/portal")
    assert portal.status_code in (200, 201)
    token = portal.json()["token"]
    return token, quote, owned_client


def _mongo_portal(token: str):
    mongo = MongoClient(os.environ["MONGO_URL"])
    return mongo[os.environ["DB_NAME"]].client_portals.find_one({"token": token})


def test_invalid_portal_token_returns_404(client):
    res = client.get("/api/portal/invalid-token-value")
    assert res.status_code == 404


def test_portal_overview_with_valid_token(client):
    token, _, _ = _portal_setup(client)
    res = client.get(f"/api/portal/{token}")
    assert res.status_code == 200
    body = res.json()
    assert "client" in body
    assert body["capabilities"]["quoteRejection"] is True


def test_portal_disabled_after_admin_disable(client):
    token, _, owned_client = _portal_setup(client)
    disable = client.delete(f"/api/clients/{owned_client['id']}/portal")
    assert disable.status_code == 204

    res = client.get(f"/api/portal/{token}")
    assert res.status_code == 404


def test_accept_quote_via_portal_stores_proof(client):
    token, quote, _ = _portal_setup(client)
    accept = client.post(
        f"/api/portal/{token}/quotes/{quote['id']}/accept",
        json=DECISION_BODY,
        headers={"User-Agent": "PortalTest/1.0", "X-Forwarded-For": "203.0.113.10"},
    )
    assert accept.status_code == 200
    payload = accept.json()["quote"]
    assert payload["status"] == "accepted"
    assert payload["clientSignerName"] == "Jean Dupont"
    assert payload["clientComment"] == "Merci pour le devis."
    assert payload["canAccept"] is False
    assert payload["canReject"] is False

    mongo = MongoClient(os.environ["MONGO_URL"])
    stored = mongo[os.environ["DB_NAME"]].quotes.find_one({"id": quote["id"]})
    proof = stored.get("portalDecision") or {}
    assert proof.get("action") == "accepted"
    assert proof.get("signerName") == "Jean Dupont"
    assert proof.get("userAgent") == "PortalTest/1.0"
    assert proof.get("ipAddress") == "203.0.113.10"
    assert proof.get("quoteVersion", {}).get("number") == quote["number"]
    assert "disclaimer" in proof


def test_cannot_accept_quote_twice(client):
    token, quote, _ = _portal_setup(client)
    first = client.post(
        f"/api/portal/{token}/quotes/{quote['id']}/accept",
        json=DECISION_BODY,
    )
    assert first.status_code == 200
    second = client.post(
        f"/api/portal/{token}/quotes/{quote['id']}/accept",
        json=DECISION_BODY,
    )
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "quote_already_accepted"


def test_reject_quote_via_portal(client):
    token, quote, _ = _portal_setup(client)
    reject = client.post(
        f"/api/portal/{token}/quotes/{quote['id']}/reject",
        json={"signerName": "Marie Martin", "comment": "Budget trop élevé."},
    )
    assert reject.status_code == 200
    payload = reject.json()["quote"]
    assert payload["status"] == "rejected"
    assert payload["clientSignerName"] == "Marie Martin"


def test_cannot_reject_quote_twice(client):
    token, quote, _ = _portal_setup(client)
    first = client.post(
        f"/api/portal/{token}/quotes/{quote['id']}/reject",
        json={"signerName": "Marie Martin"},
    )
    assert first.status_code == 200
    second = client.post(
        f"/api/portal/{token}/quotes/{quote['id']}/reject",
        json={"signerName": "Marie Martin"},
    )
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "quote_already_rejected"


def test_accept_requires_signer_name(client):
    token, quote, _ = _portal_setup(client)
    res = client.post(
        f"/api/portal/{token}/quotes/{quote['id']}/accept",
        json={"signerName": ""},
    )
    assert res.status_code == 422


def test_portal_pdf_requires_valid_token(client):
    token, quote, _ = _portal_setup(client)
    ok = client.get(f"/api/portal/{token}/quotes/{quote['id']}/pdf")
    assert ok.status_code == 200
    assert ok.headers.get("content-type", "").startswith("application/pdf")

    bad = client.get(f"/api/portal/bad-token/quotes/{quote['id']}/pdf")
    assert bad.status_code == 404


def test_portal_invoice_pdf(client):
    token, quote, owned_client = _portal_setup(client)
    client.put(f"/api/quotes/{quote['id']}", json={"status": "accepted"})
    convert = client.post(f"/api/quotes/{quote['id']}/convert-to-invoice")
    assert convert.status_code == 201
    invoice = convert.json()

    res = client.get(f"/api/portal/{token}/invoices/{invoice['id']}/pdf")
    assert res.status_code == 200
    assert res.headers.get("content-type", "").startswith("application/pdf")

    overview = client.get(f"/api/portal/{token}")
    assert overview.status_code == 200
    invoices = overview.json()["invoices"]
    assert len(invoices) == 1
    assert invoices[0]["amountDue"] == invoice["amountTTC"]
    assert invoices[0]["isPaid"] is False


def test_portal_cannot_access_other_portal_quote(client):
    token_a, quote_a, _ = _portal_setup(client)
    client_b = create_client_record(client, name="Other Client B")
    quote_b = create_quote_record(client, client_b["id"])
    portal_b = client.post(f"/api/clients/{client_b['id']}/portal")
    token_b = portal_b.json()["token"]

    cross = client.post(
        f"/api/portal/{token_b}/quotes/{quote_a['id']}/accept",
        json=DECISION_BODY,
    )
    assert cross.status_code == 404


def test_portal_overview_hides_internal_notes(client):
    token, quote, _ = _portal_setup(client)
    client.put(
        f"/api/quotes/{quote['id']}",
        json={"internalNotes": "Note interne confidentielle"},
    )
    res = client.get(f"/api/portal/{token}")
    assert res.status_code == 200
    raw = res.text
    assert "Note interne confidentielle" not in raw
    quote_payload = res.json()["quotes"][0]
    assert "internalNotes" not in quote_payload


def test_draft_quote_hidden_from_portal(client):
    token, _, owned_client = _portal_setup(client)
    draft = client.post(
        "/api/quotes",
        json={
            "clientId": owned_client["id"],
            "title": "Brouillon",
            "amountHT": 5000,
            "vatRate": 20,
            "status": "draft",
        },
    )
    assert draft.status_code in (200, 201)

    res = client.get(f"/api/portal/{token}")
    assert res.status_code == 200
    quote_ids = [q["id"] for q in res.json()["quotes"]]
    assert draft.json()["id"] not in quote_ids


def test_expired_portal_token(client):
    token, _, _ = _portal_setup(client)
    mongo = MongoClient(os.environ["MONGO_URL"])
    expired_at = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    mongo[os.environ["DB_NAME"]].client_portals.update_one(
        {"token": token},
        {"$set": {"expiresAt": expired_at}},
    )
    res = client.get(f"/api/portal/{token}")
    assert res.status_code == 404


def test_reject_quote_records_timeline_event(client):
    token, quote, _ = _portal_setup(client)
    reject = client.post(
        f"/api/portal/{token}/quotes/{quote['id']}/reject",
        json={"signerName": "Client Test"},
    )
    assert reject.status_code == 200

    mongo = MongoClient(os.environ["MONGO_URL"])
    event = mongo[os.environ["DB_NAME"]].events.find_one(
        {"entityType": "quote", "entityId": quote["id"], "type": "quote_rejected"}
    )
    assert event is not None
    assert event.get("metadata", {}).get("source") == "portal"
