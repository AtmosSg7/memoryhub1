"""Client insight rules — configurable via memory_intelligence.config."""

from __future__ import annotations

from typing import List

from memory_intelligence import config
from memory_intelligence.engine import Rule, RuleContext, register_rule
from memory_intelligence.models import MemorySignal


def _sig(
    rule_id: str,
    ctx: RuleContext,
    *,
    title: str,
    reason: str,
    priority: str = "medium",
    category: str = "activity",
    metadata: dict | None = None,
) -> MemorySignal:
    client = ctx.client
    assert client is not None
    return MemorySignal(
        id=f"insight:{rule_id}:{client.clientId}",
        kind="insight",
        ruleId=rule_id,
        priority=priority,  # type: ignore[arg-type]
        category=category,  # type: ignore[arg-type]
        title=title,
        reason=reason,
        date=ctx.now_iso,
        link=f"/dashboard/clients/{client.clientId}",
        clientId=client.clientId,
        clientName=client.displayName,
        metadata=metadata or {},
    )


def _rule_very_active(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c:
        return []
    days = c.daysSinceActivity
    if days is not None and days <= config.VERY_ACTIVE_MAX_DAYS and c.exchangesTotal >= config.VERY_ACTIVE_MIN_EXCHANGES:
        return [
            _sig(
                "client_very_active",
                ctx,
                title="Client très actif",
                reason=f"{c.exchangesTotal} échanges, dernier contact il y a {days} j",
                priority="low",
                category="activity",
                metadata={"daysSinceActivity": days, "exchangesTotal": c.exchangesTotal},
            )
        ]
    return []


def _rule_inactive(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c or c.daysSinceActivity is None:
        return []
    if c.daysSinceActivity >= config.INACTIVE_DAYS:
        return [
            _sig(
                "client_inactive",
                ctx,
                title="Client inactif",
                reason=f"Aucun contact depuis {c.daysSinceActivity} jours",
                priority="high",
                category="relationship",
                metadata={"daysSinceActivity": c.daysSinceActivity},
            )
        ]
    return []


def _rule_loyal(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c or c.daysSinceCreated is None:
        return []
    if c.daysSinceCreated >= config.LOYAL_MIN_AGE_DAYS and c.exchangesTotal >= config.LOYAL_MIN_EXCHANGES:
        return [
            _sig(
                "client_loyal",
                ctx,
                title="Client fidèle",
                reason=f"Client depuis {c.daysSinceCreated} j · {c.exchangesTotal} échanges",
                priority="low",
                category="relationship",
            )
        ]
    return []


def _rule_new(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c or c.daysSinceCreated is None:
        return []
    if c.daysSinceCreated <= config.NEW_CLIENT_DAYS:
        return [
            _sig(
                "client_new",
                ctx,
                title="Nouveau client",
                reason=f"Créé il y a {c.daysSinceCreated} jour(s)",
                priority="low",
                category="relationship",
            )
        ]
    return []


def _rule_follow_up(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c or c.daysSinceActivity is None:
        return []
    d = c.daysSinceActivity
    if config.FOLLOW_UP_MIN_DAYS <= d <= config.FOLLOW_UP_MAX_DAYS:
        remaining = max(0, config.INACTIVE_DAYS - d)
        return [
            _sig(
                "client_follow_up",
                ctx,
                title="Client à relancer",
                reason=f"Dernier contact il y a {d} j — à relancer bientôt",
                priority="medium",
                category="relationship",
                metadata={"followUpInDays": remaining, "daysSinceActivity": d},
            )
        ]
    return []


def _rule_many_exchanges(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c or c.exchangesTotal < config.MANY_EXCHANGES:
        return []
    return [
        _sig(
            "many_exchanges",
            ctx,
            title="Beaucoup d'échanges",
            reason=f"{c.exchangesTotal} échanges enregistrés",
            priority="low",
            category="communication",
        )
    ]


def _rule_many_documents(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c or c.documentsCount < config.MANY_DOCUMENTS:
        return []
    return [
        _sig(
            "many_documents",
            ctx,
            title="Beaucoup de documents",
            reason=f"{c.documentsCount} documents liés",
            priority="low",
            category="documents",
        )
    ]


def _rule_no_documents(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c:
        return []
    age = c.daysSinceCreated or 0
    if c.documentsCount == 0 and age >= config.NO_DOCUMENTS_MIN_AGE_DAYS:
        return [
            _sig(
                "no_documents",
                ctx,
                title="Aucun document",
                reason="Pas encore de devis, facture ou fichier",
                priority="medium",
                category="documents",
            )
        ]
    return []


def _rule_emails_only(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c:
        return []
    if (
        c.exchangesTotal >= config.EMAILS_ONLY_MIN_EXCHANGES
        and c.documentsCount == 0
        and c.quotesCount == 0
        and c.invoicesCount == 0
        and (c.emailsReceived + c.emailsSent) >= config.EMAILS_ONLY_MIN_EXCHANGES
    ):
        return [
            _sig(
                "emails_only",
                ctx,
                title="Uniquement des e-mails",
                reason="Relation suivie surtout par e-mail pour l'instant",
                priority="low",
                category="communication",
            )
        ]
    return []


def _rule_phone_only(ctx: RuleContext) -> List[MemorySignal]:
    """Reserved — fires only when phone channel is enabled and has data."""
    if not config.ENABLE_PHONE_CHANNEL:
        return []
    c = ctx.client
    if not c or c.phoneCallCount <= 0:
        return []
    if c.exchangesTotal == 0 and c.phoneCallCount >= 3:
        return [
            _sig(
                "phone_only",
                ctx,
                title="Uniquement téléphone",
                reason=f"{c.phoneCallCount} appels enregistrés",
                priority="low",
                category="future",
            )
        ]
    return []


def _rule_high_revenue(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c or c.totalRevenue < config.HIGH_REVENUE_CENTS:
        return []
    return [
        _sig(
            "high_revenue",
            ctx,
            title="Chiffre d'affaires élevé",
            reason="Client parmi les plus importants en CA",
            priority="medium",
            category="revenue",
            metadata={"totalRevenue": c.totalRevenue},
        )
    ]


def _rule_low_revenue(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c:
        return []
    if c.invoicesCount > 0 and 0 < c.totalRevenue < config.LOW_REVENUE_CENTS:
        return [
            _sig(
                "low_revenue",
                ctx,
                title="Chiffre d'affaires faible",
                reason="Peu de CA encaissé sur ce client",
                priority="low",
                category="revenue",
            )
        ]
    return []


def register_insight_rules() -> None:
    specs = [
        ("client_very_active", "activity", "low", "Client with recent frequent exchanges", _rule_very_active),
        ("client_inactive", "relationship", "high", "No activity for a long time", _rule_inactive),
        ("client_loyal", "relationship", "low", "Long-standing client with many exchanges", _rule_loyal),
        ("client_new", "relationship", "low", "Recently created client", _rule_new),
        ("client_follow_up", "relationship", "medium", "Needs a check-in soon", _rule_follow_up),
        ("many_exchanges", "communication", "low", "High exchange volume", _rule_many_exchanges),
        ("many_documents", "documents", "low", "High document volume", _rule_many_documents),
        ("no_documents", "documents", "medium", "No documents yet", _rule_no_documents),
        ("emails_only", "communication", "low", "Only email interactions", _rule_emails_only),
        ("phone_only", "future", "low", "Phone-only (reserved)", _rule_phone_only),
        ("high_revenue", "revenue", "medium", "High revenue client", _rule_high_revenue),
        ("low_revenue", "revenue", "low", "Low revenue with invoices", _rule_low_revenue),
    ]
    for rule_id, category, priority, desc, fn in specs:
        register_rule(
            Rule(
                id=rule_id,
                kind="insight",
                category=category,
                priority=priority,
                description=desc,
                channels=("crm", "email") if rule_id != "phone_only" else ("phone",),
                evaluate=fn,
            )
        )
