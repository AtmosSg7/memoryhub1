"""Memory Intelligence service — compute, cache, targeted recompute."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from memory_intelligence import config
from memory_intelligence.engine import RuleContext, evaluate_rules, sort_signals
from memory_intelligence.facts import (
    build_all_client_facts,
    build_single_client_facts,
    build_workspace_facts,
)
from memory_intelligence.models import (
    ClientFacts,
    ClientIntelligence,
    ImportantClientPublic,
    IntelligenceOverview,
    MemorySignal,
    RecentItemPublic,
    SyncStatusPublic,
    WorkspaceFacts,
)

_RULES_LOADED = False


def ensure_rules_loaded() -> None:
    global _RULES_LOADED
    if _RULES_LOADED:
        return
    from memory_intelligence.rules_actions import register_action_rules
    from memory_intelligence.rules_insights import register_insight_rules

    register_insight_rules()
    register_action_rules()
    _RULES_LOADED = True


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# Client-scoped data-quality / follow-up rules that spam the Action Center when
# many clients match — group into a single actionable row when count >= 2.
_GROUPABLE_RULES = {
    "complete_phone": {
        "title_fr": "{n} fiches clients sans téléphone",
        "reason_fr": "Complétez les numéros manquants",
        "link": "/dashboard/clients",
    },
    "complete_address": {
        "title_fr": "{n} fiches clients sans adresse",
        "reason_fr": "Utile pour devis et factures",
        "link": "/dashboard/clients",
    },
    "follow_up_client": {
        "title_fr": "{n} clients à relancer",
        "reason_fr": "Sans activité récente",
        "link": "/dashboard/clients",
    },
}


def group_similar_actions(actions: List[MemorySignal]) -> List[MemorySignal]:
    """Collapse repetitive per-client actions into one grouped row."""
    buckets: Dict[str, List[MemorySignal]] = {}
    passthrough: List[MemorySignal] = []
    for action in actions:
        if action.ruleId in _GROUPABLE_RULES and action.clientId:
            buckets.setdefault(action.ruleId, []).append(action)
        else:
            passthrough.append(action)

    grouped: List[MemorySignal] = []
    for rule_id, items in buckets.items():
        if len(items) < 2:
            grouped.extend(items)
            continue
        meta = _GROUPABLE_RULES[rule_id]
        priority = items[0].priority
        for item in items[1:]:
            if item.priority == "critical" or (
                item.priority == "high" and priority not in {"critical"}
            ):
                priority = item.priority
        grouped.append(
            MemorySignal(
                id=f"action:{rule_id}:grouped",
                kind="action",
                ruleId=rule_id,
                priority=priority,
                category=items[0].category,
                title=meta["title_fr"].format(n=len(items)),
                reason=meta["reason_fr"],
                date=items[0].date,
                link=meta["link"],
                metadata={
                    "grouped": True,
                    "count": len(items),
                    "clientIds": [i.clientId for i in items if i.clientId][:20],
                },
            )
        )
    return sort_signals(passthrough + grouped)


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def evaluate_client(
    client: ClientFacts,
    workspace: WorkspaceFacts,
    now_iso: str,
) -> ClientIntelligence:
    ensure_rules_loaded()
    ctx = RuleContext(client=client, workspace=workspace, now_iso=now_iso)
    signals = evaluate_rules(ctx)
    insights = sort_signals([s for s in signals if s.kind == "insight"])
    actions = sort_signals([s for s in signals if s.kind == "action" and s.clientId])
    follow_up = None
    for ins in insights:
        if ins.ruleId == "client_follow_up":
            follow_up = (ins.metadata or {}).get("followUpInDays")
            break
        if ins.ruleId == "client_inactive":
            follow_up = 0
            break
    return ClientIntelligence(
        clientId=client.clientId,
        displayName=client.displayName,
        facts=client,
        insights=insights,
        actions=actions,
        followUpInDays=follow_up,
        integrations={
            "googleContacts": {
                "connected": workspace.googleContactsConnected,
                "lastSyncedAt": workspace.googleContactsLastSyncedAt,
            },
            "gmail": {
                "connected": workspace.gmailConnected,
                "lastSyncedAt": workspace.gmailLastSyncedAt,
            },
        },
    )


def evaluate_workspace_actions(workspace: WorkspaceFacts, now_iso: str) -> List[MemorySignal]:
    ensure_rules_loaded()
    ctx = RuleContext(client=None, workspace=workspace, now_iso=now_iso)
    # Only workspace-channel rules: filter after evaluate
    signals = evaluate_rules(ctx, kinds=["action"])
    return sort_signals(
        [s for s in signals if not s.clientId or s.ruleId in ("classify_unlinked_emails",)]
    )


def _important_from_intel(items: List[ClientIntelligence]) -> List[ImportantClientPublic]:
    important: List[ImportantClientPublic] = []
    want = {"client_loyal", "high_revenue", "client_very_active", "many_exchanges"}
    for intel in items:
        matched = [i for i in intel.insights if i.ruleId in want]
        if not matched and not intel.facts.isFavorite:
            continue
        if not matched and intel.facts.isFavorite:
            reason = "Favori"
            ids = ["favorite"]
        else:
            reason = matched[0].title
            ids = [m.ruleId for m in matched]
        important.append(
            ImportantClientPublic(
                clientId=intel.clientId,
                displayName=intel.displayName,
                reason=reason,
                insightIds=ids,
                link=f"/dashboard/clients/{intel.clientId}",
                lastActivityAt=intel.facts.lastActivityAt,
                totalRevenue=intel.facts.totalRevenue,
                exchangesTotal=intel.facts.exchangesTotal,
            )
        )
    important.sort(key=lambda c: (-c.totalRevenue, -(c.exchangesTotal or 0)))
    return important[: config.MAX_CLIENT_LIST]


def _follow_up_from_intel(items: List[ClientIntelligence]) -> List[ImportantClientPublic]:
    out: List[ImportantClientPublic] = []
    for intel in items:
        matched = [i for i in intel.insights if i.ruleId in ("client_follow_up", "client_inactive")]
        if not matched:
            continue
        out.append(
            ImportantClientPublic(
                clientId=intel.clientId,
                displayName=intel.displayName,
                reason=matched[0].reason,
                insightIds=[m.ruleId for m in matched],
                link=f"/dashboard/clients/{intel.clientId}",
                lastActivityAt=intel.facts.lastActivityAt,
                totalRevenue=intel.facts.totalRevenue,
                exchangesTotal=intel.facts.exchangesTotal,
            )
        )
    out.sort(key=lambda c: c.lastActivityAt or "")
    return out[: config.MAX_CLIENT_LIST]


async def _load_recent(db, user_id: str) -> Dict[str, List[RecentItemPublic]]:
    exchanges: List[RecentItemPublic] = []
    async for doc in (
        db.communications.find(
            {"userId": user_id, "clientId": {"$exists": True, "$nin": [None, ""]}},
            {"_id": 0},
        )
        .sort("createdAt", -1)
        .limit(config.MAX_RECENT)
    ):
        meta = doc.get("metadata") or {}
        exchanges.append(
            RecentItemPublic(
                id=doc["id"],
                title=doc.get("subject") or "E-mail",
                subtitle=meta.get("clientName") or meta.get("fromEmail"),
                clientId=doc.get("clientId"),
                clientName=meta.get("clientName"),
                date=doc.get("createdAt"),
                link=f"/dashboard/clients/{doc['clientId']}?section=emails" if doc.get("clientId") else "/dashboard/communications",
                kind=doc.get("type") or "email",
            )
        )

    documents: List[RecentItemPublic] = []
    async for doc in (
        db.documents.find({"userId": user_id}, {"_id": 0})
        .sort("updatedAt", -1)
        .limit(config.MAX_RECENT)
    ):
        documents.append(
            RecentItemPublic(
                id=doc["id"],
                title=doc.get("name") or "Fichier",
                subtitle=doc.get("clientName"),
                clientId=doc.get("clientId"),
                clientName=doc.get("clientName"),
                date=doc.get("updatedAt") or doc.get("createdAt"),
                link=f"/dashboard/clients/{doc['clientId']}?section=documents"
                if doc.get("clientId")
                else "/dashboard/files",
                kind="file",
            )
        )

    notes: List[RecentItemPublic] = []
    async for doc in (
        db.notes.find({"userId": user_id}, {"_id": 0}).sort("updatedAt", -1).limit(config.MAX_RECENT)
    ):
        notes.append(
            RecentItemPublic(
                id=doc["id"],
                title=doc.get("title") or "Note",
                subtitle=doc.get("clientName"),
                clientId=doc.get("clientId"),
                clientName=doc.get("clientName"),
                date=doc.get("updatedAt") or doc.get("noteDate") or doc.get("createdAt"),
                link=f"/dashboard/clients/{doc['clientId']}?section=notes"
                if doc.get("clientId")
                else "/dashboard/notes",
                kind="note",
            )
        )

    return {"exchanges": exchanges, "documents": documents, "notes": notes}


async def compute_client_intelligence(db, user_id: str, client_id: str) -> Optional[ClientIntelligence]:
    now = _now_iso()
    workspace = await build_workspace_facts(db, user_id)
    facts = await build_single_client_facts(db, user_id, client_id)
    if not facts:
        return None
    return evaluate_client(facts, workspace, now)


async def get_cached_snapshot(db, user_id: str) -> Optional[dict]:
    return await db.memory_intelligence_snapshots.find_one({"userId": user_id}, {"_id": 0})


async def save_snapshot(db, user_id: str, overview: IntelligenceOverview, by_client: Dict[str, Any]) -> None:
    doc = {
        "userId": user_id,
        "computedAt": overview.computedAt,
        "overview": overview.model_dump(),
        "byClient": by_client,
        "updatedAt": _now_iso(),
    }
    await db.memory_intelligence_snapshots.update_one(
        {"userId": user_id},
        {"$set": doc},
        upsert=True,
    )


def _cache_fresh(computed_at: Optional[str]) -> bool:
    dt = _parse_iso(computed_at)
    if not dt:
        return False
    age = (datetime.now(timezone.utc) - dt).total_seconds()
    return age <= config.CACHE_TTL_SECONDS


async def compute_overview(db, user_id: str) -> tuple[IntelligenceOverview, Dict[str, Any]]:
    now = _now_iso()
    workspace = await build_workspace_facts(db, user_id)
    clients = await build_all_client_facts(db, user_id)

    intel_list = [evaluate_client(c, workspace, now) for c in clients]
    by_client = {intel.clientId: intel.model_dump() for intel in intel_list}

    client_actions: List[MemorySignal] = []
    for intel in intel_list:
        client_actions.extend(intel.actions)

    workspace_actions = evaluate_workspace_actions(workspace, now)
    action_map = {a.id: a for a in workspace_actions + client_actions}
    actions = group_similar_actions(sort_signals(list(action_map.values())))[
        : config.MAX_ACTIONS
    ]

    insight_counts: Dict[str, int] = {}
    for intel in intel_list:
        for ins in intel.insights:
            insight_counts[ins.ruleId] = insight_counts.get(ins.ruleId, 0) + 1

    recent = await _load_recent(db, user_id)

    overview = IntelligenceOverview(
        computedAt=now,
        fromCache=False,
        actions=actions,
        importantClients=_important_from_intel(intel_list),
        followUpClients=_follow_up_from_intel(intel_list),
        sync=SyncStatusPublic(
            googleContacts={
                "connected": workspace.googleContactsConnected,
                "lastSyncedAt": workspace.googleContactsLastSyncedAt,
            },
            gmail={
                "connected": workspace.gmailConnected,
                "lastSyncedAt": workspace.gmailLastSyncedAt,
            },
            unlinkedEmailCount=workspace.unlinkedEmailCount,
        ),
        recentExchanges=recent["exchanges"],
        recentDocuments=recent["documents"],
        recentNotes=recent["notes"],
        insightCounts=insight_counts,
    )
    return overview, by_client


async def get_overview(db, user_id: str, *, force: bool = False) -> IntelligenceOverview:
    if not force:
        cached = await get_cached_snapshot(db, user_id)
        if cached and _cache_fresh(cached.get("computedAt")):
            data = cached.get("overview") or {}
            overview = IntelligenceOverview(**data)
            overview.fromCache = True
            return overview

    overview, by_client = await compute_overview(db, user_id)
    await save_snapshot(db, user_id, overview, by_client)
    return overview


async def get_client_insights(
    db, user_id: str, client_id: str, *, force: bool = False
) -> Optional[ClientIntelligence]:
    if not force:
        cached = await get_cached_snapshot(db, user_id)
        if cached and _cache_fresh(cached.get("computedAt")):
            raw = (cached.get("byClient") or {}).get(client_id)
            if raw:
                return ClientIntelligence(**raw)

    intel = await compute_client_intelligence(db, user_id, client_id)
    if not intel:
        return None

    # Merge into snapshot without full recompute
    cached = await get_cached_snapshot(db, user_id) or {
        "userId": user_id,
        "overview": None,
        "byClient": {},
    }
    by_client = dict(cached.get("byClient") or {})
    by_client[client_id] = intel.model_dump()
    await db.memory_intelligence_snapshots.update_one(
        {"userId": user_id},
        {
            "$set": {
                "byClient": by_client,
                "updatedAt": _now_iso(),
                # bump computedAt lightly only for this client path if overview missing
                "computedAt": cached.get("computedAt") or intel.facts.lastActivityAt or _now_iso(),
            }
        },
        upsert=True,
    )
    return intel


async def recompute_client(db, user_id: str, client_id: str) -> Optional[ClientIntelligence]:
    """Targeted recompute after client mutation."""
    return await get_client_insights(db, user_id, client_id, force=True)


async def invalidate_user_cache(db, user_id: str) -> None:
    await db.memory_intelligence_snapshots.delete_one({"userId": user_id})
