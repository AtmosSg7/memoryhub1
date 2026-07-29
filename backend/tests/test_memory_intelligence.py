"""Memory Intelligence — rule engine, insights, actions, cache."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient

from memory_intelligence.engine import RuleContext, clear_rules_for_tests, evaluate_rules
from memory_intelligence.models import ClientFacts, MemorySignal, WorkspaceFacts
from memory_intelligence.service import (
    ensure_rules_loaded,
    evaluate_client,
    get_client_insights,
    get_overview,
    group_similar_actions,
)
from tests.conftest import create_client_record, login_user, register_user


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def test_insight_rules_new_loyal_inactive_follow_up():
    # Reset registry for isolation
    import memory_intelligence.service as svc

    clear_rules_for_tests()
    svc._RULES_LOADED = False
    ensure_rules_loaded()

    now = _now()
    base = ClientFacts(
        clientId="c1",
        displayName="Atelier Martin",
        name="Martin",
        hasEmail=True,
        hasPhone=True,
        hasAddress=True,
        createdAt=_iso(now - timedelta(days=10)),
        daysSinceCreated=10,
        lastActivityAt=_iso(now - timedelta(days=1)),
        daysSinceActivity=1,
        exchangesTotal=2,
    )
    ctx = RuleContext(client=base, workspace=WorkspaceFacts(), now_iso=_iso(now))
    signals = evaluate_rules(ctx, kinds=["insight"])
    ids = {s.ruleId for s in signals}
    assert "client_new" in ids

    loyal = base.model_copy(
        update={
            "daysSinceCreated": 200,
            "exchangesTotal": 20,
            "daysSinceActivity": 3,
        }
    )
    ids = {s.ruleId for s in evaluate_rules(RuleContext(client=loyal, workspace=WorkspaceFacts(), now_iso=_iso(now)), kinds=["insight"])}
    assert "client_loyal" in ids
    assert "many_exchanges" in ids

    inactive = base.model_copy(update={"daysSinceActivity": 90, "daysSinceCreated": 120, "exchangesTotal": 5})
    ids = {s.ruleId for s in evaluate_rules(RuleContext(client=inactive, workspace=WorkspaceFacts(), now_iso=_iso(now)), kinds=["insight"])}
    assert "client_inactive" in ids

    follow = base.model_copy(update={"daysSinceActivity": 20, "daysSinceCreated": 100, "exchangesTotal": 4})
    ids = {s.ruleId for s in evaluate_rules(RuleContext(client=follow, workspace=WorkspaceFacts(), now_iso=_iso(now)), kinds=["insight"])}
    assert "client_follow_up" in ids


def test_phone_only_never_fires_when_disabled():
    clear_rules_for_tests()
    import memory_intelligence.service as svc

    svc._RULES_LOADED = False
    ensure_rules_loaded()
    facts = ClientFacts(
        clientId="c2",
        displayName="Tel",
        phoneCallCount=10,
        exchangesTotal=0,
        daysSinceCreated=40,
        daysSinceActivity=2,
    )
    signals = evaluate_rules(
        RuleContext(client=facts, workspace=WorkspaceFacts(), now_iso=_iso(_now())),
        kinds=["insight"],
        rule_ids=["phone_only"],
    )
    assert signals == []


def test_workspace_actions_unlinked_and_sync():
    clear_rules_for_tests()
    import memory_intelligence.service as svc

    svc._RULES_LOADED = False
    ensure_rules_loaded()
    ws = WorkspaceFacts(unlinkedEmailCount=3, googleContactsConnected=False, gmailConnected=False)
    signals = evaluate_rules(RuleContext(client=None, workspace=ws, now_iso=_iso(_now())), kinds=["action"])
    ids = {s.ruleId for s in signals}
    assert "classify_unlinked_emails" in ids
    assert "connect_google_contacts" in ids
    assert "connect_gmail" in ids


def test_overview_api_and_client_insights(client):
    clear_rules_for_tests()
    import memory_intelligence.service as svc

    svc._RULES_LOADED = False

    email, password = register_user(client, suffix=_uid("mi"))
    login_user(client, email, password)
    created = create_client_record(client, name="Client MI")
    client_id = created["id"]

    db = _mongo()
    user = db.users.find_one({"email": email.lower()})
    # Age the client + add inactivity
    old = _iso(_now() - timedelta(days=40))
    db.clients.update_one(
        {"id": client_id},
        {"$set": {"createdAt": _iso(_now() - timedelta(days=200)), "updatedAt": old}},
    )
    db.communications.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": user["id"],
            "clientId": client_id,
            "type": "email",
            "direction": "inbound",
            "provider": "gmail",
            "providerId": str(uuid.uuid4()),
            "subject": "Ancien",
            "preview": "x",
            "createdAt": old,
            "attachmentsCount": 0,
            "metadata": {},
            "updatedAt": old,
        }
    )

    overview = client.get("/api/intelligence/overview", params={"force": True})
    assert overview.status_code == 200, overview.text
    body = overview.json()
    assert "actions" in body
    assert "importantClients" in body
    assert "followUpClients" in body
    assert "sync" in body
    assert "recentExchanges" in body

    # Cached path
    cached = client.get("/api/intelligence/overview")
    assert cached.status_code == 200
    assert cached.json().get("fromCache") is True

    insights = client.get(f"/api/intelligence/clients/{client_id}", params={"force": True})
    assert insights.status_code == 200, insights.text
    intel = insights.json()
    assert intel["clientId"] == client_id
    assert isinstance(intel["insights"], list)
    assert intel["facts"]["exchangesTotal"] >= 1


def test_isolation_other_user_client_insights(client):
    email_a, password_a = register_user(client, suffix=_uid("mi-a"))
    email_b, password_b = register_user(client, suffix=_uid("mi-b"))
    login_user(client, email_a, password_a)
    created = create_client_record(client, name="Secret")
    client.post("/api/auth/logout")
    login_user(client, email_b, password_b)
    res = client.get(f"/api/intelligence/clients/{created['id']}")
    assert res.status_code == 404


def test_evaluate_client_high_revenue_action_follow_up():
    clear_rules_for_tests()
    import memory_intelligence.service as svc

    svc._RULES_LOADED = False
    ensure_rules_loaded()
    facts = ClientFacts(
        clientId="c9",
        displayName="Gros Client",
        totalRevenue=800000,
        exchangesTotal=12,
        daysSinceCreated=400,
        daysSinceActivity=25,
        hasPhone=False,
        hasEmail=True,
        hasAddress=True,
        documentsCount=3,
        quotesCount=1,
        invoicesCount=2,
    )
    intel = evaluate_client(facts, WorkspaceFacts(), _iso(_now()))
    ids = {i.ruleId for i in intel.insights}
    assert "high_revenue" in ids
    assert "client_follow_up" in ids or "client_loyal" in ids
    action_ids = {a.ruleId for a in intel.actions}
    assert "follow_up_client" in action_ids
    assert "complete_phone" in action_ids


def test_group_similar_actions_collapses_phone_completes():
    now = _iso(_now())
    actions = [
        MemorySignal(
            id=f"action:complete_phone:c{i}",
            kind="action",
            ruleId="complete_phone",
            priority="low",
            category="data_quality",
            title=f"Compléter le téléphone — Client {i}",
            reason="Aucun numéro",
            date=now,
            link=f"/dashboard/clients/c{i}",
            clientId=f"c{i}",
            clientName=f"Client {i}",
        )
        for i in range(3)
    ]
    actions.append(
        MemorySignal(
            id="action:connect_gmail:workspace",
            kind="action",
            ruleId="connect_gmail",
            priority="medium",
            category="sync",
            title="Synchroniser Gmail",
            reason="Gmail n'est pas connecté",
            date=now,
            link="/dashboard/integrations",
        )
    )
    grouped = group_similar_actions(actions)
    phone = [a for a in grouped if a.ruleId == "complete_phone"]
    assert len(phone) == 1
    assert phone[0].metadata.get("grouped") is True
    assert phone[0].metadata.get("count") == 3
    assert any(a.ruleId == "connect_gmail" for a in grouped)
