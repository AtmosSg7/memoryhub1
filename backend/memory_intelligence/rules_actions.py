"""Action rules — Action Center items from facts + workspace state."""

from __future__ import annotations

from typing import List, Optional

from memory_intelligence import config
from memory_intelligence.engine import Rule, RuleContext, register_rule
from memory_intelligence.models import MemorySignal


def _action(
    rule_id: str,
    *,
    title: str,
    reason: str,
    priority: str,
    category: str,
    link: str,
    date: str,
    client_id: Optional[str] = None,
    client_name: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> MemorySignal:
    suffix = client_id or "workspace"
    return MemorySignal(
        id=f"action:{rule_id}:{suffix}",
        kind="action",
        ruleId=rule_id,
        priority=priority,  # type: ignore[arg-type]
        category=category,  # type: ignore[arg-type]
        title=title,
        reason=reason,
        date=date,
        link=link,
        clientId=client_id,
        clientName=client_name,
        metadata=metadata or {},
    )


def _rule_follow_up_action(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c or c.daysSinceActivity is None:
        return []
    d = c.daysSinceActivity
    if d < config.FOLLOW_UP_MIN_DAYS:
        return []
    priority = "high" if d >= config.INACTIVE_DAYS else "medium"
    return [
        _action(
            "follow_up_client",
            title=f"Relancer {c.displayName}",
            reason=f"Dernier contact il y a {d} jours",
            priority=priority,
            category="relationship",
            link=f"/dashboard/clients/{c.clientId}",
            date=ctx.now_iso,
            client_id=c.clientId,
            client_name=c.displayName,
            metadata={"daysSinceActivity": d},
        )
    ]


def _rule_complete_phone(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c or c.hasPhone:
        return []
    if c.exchangesTotal == 0 and c.documentsCount == 0 and not c.isFavorite:
        return []
    return [
        _action(
            "complete_phone",
            title=f"Compléter le téléphone — {c.displayName}",
            reason="Aucun numéro sur la fiche",
            priority="low",
            category="data_quality",
            link=f"/dashboard/clients/{c.clientId}?section=contacts",
            date=ctx.now_iso,
            client_id=c.clientId,
            client_name=c.displayName,
        )
    ]


def _rule_complete_address(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c or c.hasAddress:
        return []
    if c.quotesCount + c.invoicesCount == 0:
        return []
    return [
        _action(
            "complete_address",
            title=f"Ajouter une adresse — {c.displayName}",
            reason="Utile pour vos documents commerciaux",
            priority="low",
            category="data_quality",
            link=f"/dashboard/clients/{c.clientId}?section=contacts",
            date=ctx.now_iso,
            client_id=c.clientId,
            client_name=c.displayName,
        )
    ]


def _rule_unlinked_emails(ctx: RuleContext) -> List[MemorySignal]:
    ws = ctx.workspace
    if not ws or ws.unlinkedEmailCount <= 0:
        return []
    n = ws.unlinkedEmailCount
    return [
        _action(
            "classify_unlinked_emails",
            title="Classer les e-mails non rattachés" if n > 1 else "Classer un e-mail non rattaché",
            reason=f"{n} e-mail(s) sans client",
            priority="high" if n >= 5 else "medium",
            category="communication",
            link="/dashboard/communications?scope=unlinked",
            date=ctx.now_iso,
            metadata={"count": n},
        )
    ]


def _rule_sync_integrations(ctx: RuleContext) -> List[MemorySignal]:
    ws = ctx.workspace
    if not ws:
        return []
    out: List[MemorySignal] = []
    if not ws.googleContactsConnected:
        out.append(
            _action(
                "connect_google_contacts",
                title="Importer les contacts Google",
                reason="Google Contacts n'est pas connecté",
                priority="medium",
                category="sync",
                link="/dashboard/integrations",
                date=ctx.now_iso,
            )
        )
    if not ws.gmailConnected:
        out.append(
            _action(
                "connect_gmail",
                title="Synchroniser Gmail",
                reason="Gmail n'est pas connecté",
                priority="medium",
                category="sync",
                link="/dashboard/integrations",
                date=ctx.now_iso,
            )
        )
    elif not ws.gmailLastSyncedAt:
        out.append(
            _action(
                "sync_gmail",
                title="Synchroniser Gmail",
                reason="Compte connecté — lancez une synchro",
                priority="low",
                category="sync",
                link="/dashboard/integrations",
                date=ctx.now_iso,
            )
        )
    return out


def _rule_reply_email_hint(ctx: RuleContext) -> List[MemorySignal]:
    c = ctx.client
    if not c:
        return []
    if c.emailsReceived >= 2 and c.emailsSent == 0 and (c.daysSinceActivity or 99) <= 14:
        return [
            _action(
                "reply_to_email",
                title=f"Répondre — {c.displayName}",
                reason="Des e-mails reçus sans réponse enregistrée",
                priority="medium",
                category="communication",
                link=f"/dashboard/clients/{c.clientId}?section=emails",
                date=ctx.now_iso,
                client_id=c.clientId,
                client_name=c.displayName,
            )
        ]
    return []


def register_action_rules() -> None:
    for rule_id, category, priority, fn, channels in [
        ("follow_up_client", "relationship", "medium", _rule_follow_up_action, ("crm",)),
        ("complete_phone", "data_quality", "low", _rule_complete_phone, ("crm",)),
        ("complete_address", "data_quality", "low", _rule_complete_address, ("crm",)),
        ("reply_to_email", "communication", "medium", _rule_reply_email_hint, ("email",)),
        ("classify_unlinked_emails", "communication", "high", _rule_unlinked_emails, ("email", "workspace")),
        ("sync_integrations", "sync", "medium", _rule_sync_integrations, ("workspace",)),
    ]:
        register_rule(
            Rule(
                id=rule_id,
                kind="action",
                category=category,
                priority=priority,
                description=rule_id,
                channels=channels,
                evaluate=fn,
            )
        )
