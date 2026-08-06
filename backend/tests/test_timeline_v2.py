"""Client Timeline V2 — fuse, filter, summary, isolation."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import pytest
from pymongo import MongoClient

from tests.conftest import create_client_record, login_user, register_user
from timeline_v2_service import categorize_event_type, event_to_item_v2
from events import EventPublic


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def test_categorize_event_types():
    assert categorize_event_type("email_received") == "communications"
    assert categorize_event_type("quote_sent") == "commercial"
    assert categorize_event_type("note_created") == "notes"
    assert categorize_event_type("document_uploaded") == "documents"
    assert categorize_event_type("action_created", kind="action") == "actions"


def test_event_to_item_embeds_intelligence_without_inventing():
    ev = EventPublic(
        id="comm-1",
        type="email_received",
        entityType="email",
        entityId="c1",
        clientId="cli",
        metadata={
            "subject": "Devis terrasse",
            "fromEmail": "a@b.fr",
            "fromName": "Alice",
            "excerpt": "Bonjour",
            "communicationId": "c1",
            "gmailUrl": "https://mail.google.com/x",
        },
        createdAt=_now(),
    )
    item = event_to_item_v2(
        ev,
        intelligence={
            "summary": "Demande un devis pour une terrasse.",
            "intent": "request_quote",
            "urgency": "high",
            "suggestedActionTitle": "Préparer un devis",
            "suggestionStatus": "pending",
            "status": "ready",
        },
        client_is_prospect=True,
    )
    assert item.category == "communications"
    assert item.intelligence.intent == "request_quote"
    assert "prospect" in item.badges
    assert "devis" in item.summary.lower() or "terrasse" in item.summary.lower()
    assert "devis" in item.searchableText


def test_timeline_v2_api_merge_filter_and_isolation(client):
    email, password = register_user(client, suffix=_uid("tlv2"))
    login_user(client, email, password)
    owned = create_client_record(client, name="Timeline Client")
    user = _mongo().users.find_one({"email": email.lower()})
    db = _mongo()

    # Communication linked to client
    comm_id = str(uuid.uuid4())
    db.communications.insert_one(
        {
            "id": comm_id,
            "userId": user["id"],
            "clientId": owned["id"],
            "type": "email",
            "direction": "inbound",
            "provider": "gmail",
            "providerId": f"g-{comm_id}",
            "subject": "Demande de devis",
            "preview": "Bonjour, devis pour cuisine ?",
            "createdAt": _now(),
            "updatedAt": _now(),
            "attachmentsCount": 0,
            "status": "linked",
            "externalUrl": "https://mail.google.com/test",
            "metadata": {
                "fromEmail": "prospect@example.fr",
                "fromName": "Paul",
                "source": "gmail",
            },
        }
    )
    db.communication_analyses.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": user["id"],
            "communicationId": comm_id,
            "status": "ready",
            "suggestionStatus": "pending",
            "summary": "Le contact demande un devis cuisine.",
            "intent": "request_quote",
            "urgency": "high",
            "suggestedActionTitle": "Préparer un devis",
            "version": "1.0.0",
            "createdAt": _now(),
            "updatedAt": _now(),
        }
    )
    db.events.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": user["id"],
            "type": "note_created",
            "entityType": "note",
            "entityId": str(uuid.uuid4()),
            "clientId": owned["id"],
            "metadata": {"title": "Appel", "content": "Rappeler jeudi"},
            "createdAt": _now(),
        }
    )
    db.actions.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": user["id"],
            "clientId": owned["id"],
            "type": "prepare_quote",
            "priority": "high",
            "status": "pending",
            "source": "communication",
            "title": "Préparer un devis",
            "description": "Suite mail",
            "createdAt": _now(),
            "metadata": {},
            "idempotencyKey": f"test-{uuid.uuid4().hex}",
        }
    )

    all_res = client.get(f"/api/clients/{owned['id']}/timeline-v2?limit=50")
    assert all_res.status_code == 200, all_res.text
    body = all_res.json()
    assert body["total"] >= 3
    assert "summary" in body
    assert body["summary"]["openActionsCount"] >= 1
    types = {i["type"] for i in body["items"]}
    assert "email_received" in types
    assert "note_created" in types
    assert any(i["kind"] == "action" or i["category"] == "actions" for i in body["items"])

    email_item = next(i for i in body["items"] if i["type"] == "email_received")
    assert email_item["intelligence"]["intent"] == "request_quote"
    assert email_item["intelligence"]["summary"]

    notes_only = client.get(
        f"/api/clients/{owned['id']}/timeline-v2?category=notes&limit=50"
    )
    assert notes_only.status_code == 200
    assert all(i["category"] == "notes" for i in notes_only.json()["items"])

    # Isolation
    email_b, password_b = register_user(client, suffix=_uid("tlv2b"))
    login_user(client, email_b, password_b)
    forbidden = client.get(f"/api/clients/{owned['id']}/timeline-v2")
    assert forbidden.status_code == 404


def test_timeline_v2_never_invents_ai_summary_without_data(client):
    email, password = register_user(client, suffix=_uid("tlv2-empty"))
    login_user(client, email, password)
    owned = create_client_record(client, name="Empty Timeline")
    res = client.get(f"/api/clients/{owned['id']}/timeline-v2")
    assert res.status_code == 200
    summary = res.json()["summary"]
    assert summary["aiRelationSummary"] in (None, "")
    assert summary["aiLastExchangeSummary"] in (None, "")
    assert summary.get("latestIntelligenceSummary") in (None, "")
    assert summary.get("topOpenActions") == []
    assert summary.get("openActionsCount", 0) == 0
    assert summary.get("communicationCount", 0) == 0


def test_timeline_v2_enriched_brief_narrative_and_actions(client):
    email, password = register_user(client, suffix=_uid("tlv2-brief"))
    login_user(client, email, password)
    owned = create_client_record(client, name="Brief Client")
    user = _mongo().users.find_one({"email": email.lower()})
    db = _mongo()
    uid = user["id"]
    cid = owned["id"]

    db.clients.update_one(
        {"id": cid},
        {"$set": {"createdAt": "2025-03-15T10:00:00+00:00"}},
    )
    quote_id = str(uuid.uuid4())
    db.quotes.insert_one(
        {
            "id": quote_id,
            "userId": uid,
            "clientId": cid,
            "number": f"D-{uuid.uuid4().hex[:8]}",
            "status": "sent",
            "totalCents": 120000,
            "createdAt": _now(),
            "updatedAt": _now(),
        }
    )
    db.quotes.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": uid,
            "clientId": cid,
            "number": f"D-{uuid.uuid4().hex[:8]}",
            "status": "accepted",
            "totalCents": 200000,
            "createdAt": _now(),
            "updatedAt": _now(),
        }
    )
    db.invoices.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": uid,
            "clientId": cid,
            "number": f"F-{uuid.uuid4().hex[:8]}",
            "status": "overdue",
            "totalCents": 50000,
            "amountDueCents": 50000,
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
            "priority": "urgent",
            "status": "pending",
            "source": "manual",
            "title": "Rappeler urgence",
            "description": "Facture en retard",
            "dueAt": _now(),
            "createdAt": _now(),
            "metadata": {},
            "idempotencyKey": f"test-{uuid.uuid4().hex}",
        }
    )
    db.personal_reminders.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": uid,
            "clientId": cid,
            "status": "pending",
            "remindAt": "2026-08-20T09:00:00+00:00",
            "message": "Relancer le chantier",
            "createdAt": _now(),
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
            "subject": "Terrasse bois",
            "preview": "Suite terrasse",
            "createdAt": _now(),
            "updatedAt": _now(),
            "attachmentsCount": 0,
            "status": "linked",
            "metadata": {"fromEmail": "a@b.fr", "source": "gmail"},
        }
    )
    db.communication_analyses.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": uid,
            "communicationId": comm_id,
            "status": "ready",
            "suggestionStatus": "pending",
            "summary": "Le client relance pour la terrasse.",
            "intent": "follow_up",
            "urgency": "normal",
            "suggestedActionTitle": "Planifier un passage",
            "version": "1.0.0",
            "createdAt": _now(),
            "updatedAt": _now(),
        }
    )

    res = client.get(f"/api/clients/{cid}/timeline-v2?limit=50")
    assert res.status_code == 200, res.text
    summary = res.json()["summary"]
    assert summary["activeQuotesCount"] >= 1
    assert summary["acceptedQuotesCount"] >= 1
    assert summary["overdueInvoicesCount"] >= 1
    assert summary["openActionsCount"] >= 1
    assert summary["communicationCount"] >= 1
    assert len(summary["topOpenActions"]) >= 1
    assert summary["topOpenActions"][0]["id"] == action_id
    assert summary["topOpenActions"][0]["priority"] == "urgent"
    assert summary["nextReminder"] is not None
    assert summary["nextReminder"]["remindAt"]
    assert summary["latestIntelligenceSummary"]
    assert summary["narrative"]
    assert "Client depuis" in summary["narrative"]
    assert "action" in summary["narrative"].lower()
    assert summary["lastImportantCommunication"] is not None
    assert summary["lastImportantCommunication"]["subject"]


def test_build_deterministic_narrative_unit():
    from timeline_v2_models import ClientRelationSummary
    from timeline_v2_service import build_deterministic_narrative

    empty = build_deterministic_narrative(ClientRelationSummary())
    assert empty is None

    rich = build_deterministic_narrative(
        ClientRelationSummary(
            clientSinceLabel="mars 2025",
            sentQuotesCount=2,
            activeQuotesCount=2,
            acceptedQuotesCount=1,
            lastExchangeAt=_now(),
            primarySubject="Terrasse",
            openActionsCount=1,
            overdueInvoicesCount=1,
        )
    )
    assert rich is not None
    assert "mars 2025" in rich
    assert "devis" in rich.lower()
    assert "ouverte" in rich.lower()
    assert "retard" in rich.lower()
