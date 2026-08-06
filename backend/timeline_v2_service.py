"""Client Timeline V2 — fuse ledger, communications, actions + CI (no model rewrite)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from action_engine.constants import ACTION_STATUS_PENDING
from events import EventPublic, event_public
from timeline_service import list_universal_client_timeline
from timeline_v2_models import (
    ClientRelationSummary,
    LastImportantCommunicationPublic,
    NextReminderPublic,
    TimelineIntelligencePublic,
    TimelineItemV2,
    TimelineV2Response,
    TopOpenActionPublic,
)

_MONTHS_FR = (
    "",
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
)

_PRIORITY_RANK = {"urgent": 0, "high": 1, "normal": 2, "low": 3}

_ACTIVE_QUOTE_STATUSES = frozenset({"draft", "sent", "viewed", "in_progress"})
_INTENT_REQUEST_LABELS = {
    "request_quote": "demande de devis",
    "request_callback": "demande de rappel",
    "appointment_request": "demande de rendez-vous",
    "complaint": "réclamation",
    "payment_question": "question de paiement",
    "question": "question",
    "quote_accepted": "acceptation de devis",
    "follow_up": "suivi",
}

COMM_TYPES = frozenset(
    {
        "email_sent",
        "email_received",
        "whatsapp_message",
        "call_logged",
        "calendar_event_synced",
    }
)
COMMERCIAL_TYPES = frozenset(
    {
        "quote_created",
        "quote_updated",
        "quote_accepted",
        "quote_rejected",
        "quote_deleted",
        "quote_converted",
        "quote_sent",
        "quote_viewed",
        "quote_expired",
        "quote_archived",
        "invoice_created",
        "invoice_updated",
        "invoice_deleted",
        "invoice_paid",
        "invoice_payment_recorded",
        "invoice_reopened",
        "invoice_issued",
        "invoice_sent",
        "invoice_viewed",
        "invoice_archived",
        "invoice_overdue",
        "invoice_validated",
        "invoice_validation_failed",
        "invoice_ready_for_export",
        "invoice_exported",
        "document_send_prepared",
        "follow_up_recorded",
    }
)
NOTE_TYPES = frozenset({"note_created", "note_updated", "note_deleted"})
DOCUMENT_TYPES = frozenset({"document_uploaded", "document_deleted"})
ACTION_EVENT_TYPES = frozenset({"action_created", "action_completed", "action_dismissed"})

TITLE_FR = {
    "email_received": "E-mail reçu",
    "email_sent": "E-mail envoyé",
    "whatsapp_message": "WhatsApp",
    "call_logged": "Appel",
    "calendar_event_synced": "Événement calendrier",
    "quote_created": "Devis créé",
    "quote_sent": "Devis envoyé",
    "quote_accepted": "Devis accepté",
    "quote_rejected": "Devis refusé",
    "quote_viewed": "Devis consulté",
    "invoice_created": "Facture créée",
    "invoice_sent": "Facture envoyée",
    "invoice_paid": "Facture payée",
    "invoice_overdue": "Facture en retard",
    "invoice_payment_recorded": "Paiement enregistré",
    "note_created": "Note",
    "note_updated": "Note mise à jour",
    "document_uploaded": "Document ajouté",
    "document_deleted": "Document supprimé",
    "follow_up_recorded": "Relance",
    "action_created": "Action à faire",
    "action_completed": "Action terminée",
    "client_created": "Client créé",
}


def categorize_event_type(event_type: str, *, kind: str = "event") -> str:
    if kind == "action" or event_type in ACTION_EVENT_TYPES:
        return "actions"
    if event_type in COMM_TYPES:
        return "communications"
    if event_type in COMMERCIAL_TYPES:
        return "commercial"
    if event_type in NOTE_TYPES:
        return "notes"
    if event_type in DOCUMENT_TYPES:
        return "documents"
    return "all"


def _human_title(event_type: str, metadata: dict) -> str:
    if event_type.startswith("action_"):
        return str(metadata.get("title") or TITLE_FR.get(event_type) or "Action")
    if event_type in NOTE_TYPES:
        return str(
            metadata.get("noteTitle")
            or metadata.get("title")
            or TITLE_FR.get(event_type)
            or "Note"
        )
    subject = metadata.get("subject")
    if event_type in COMM_TYPES and subject:
        return str(subject)
    number = metadata.get("number") or metadata.get("quoteNumber") or metadata.get("invoiceNumber")
    base = TITLE_FR.get(event_type) or event_type.replace("_", " ").capitalize()
    if number:
        return f"{base} {number}"
    return base


def _human_summary(event: EventPublic, *, intelligence: Optional[dict] = None) -> str:
    meta = event.metadata or {}
    if intelligence and intelligence.get("summary"):
        return str(intelligence["summary"])
    for key in ("excerpt", "content", "preview", "body", "description", "message"):
        val = meta.get(key)
        if val and str(val).strip():
            text = " ".join(str(val).split())
            return text[:280] + ("…" if len(text) > 280 else "")
    if meta.get("fileName"):
        return str(meta["fileName"])
    if meta.get("fromEmail") or meta.get("fromName"):
        who = meta.get("fromName") or meta.get("fromEmail")
        return f"De {who}"
    return ""


def _amount_cents(meta: dict) -> Optional[int]:
    for key in ("amountTTC", "amountCents", "amount_ttc", "amount"):
        val = meta.get(key)
        if val is None:
            continue
        try:
            n = int(val)
            # Heuristic: values < 1000 with decimals already in euros are rare in our ledger (centimes).
            return n
        except (TypeError, ValueError):
            continue
    return None


def _badges_for(
    event: EventPublic,
    *,
    kind: str,
    intelligence: Optional[dict],
    client_is_prospect: bool,
) -> List[str]:
    badges: List[str] = []
    if event.type in COMM_TYPES:
        badges.append("prospect" if client_is_prospect else "client")
        if event.type == "email_received":
            badges.append("inbound")
        elif event.type == "email_sent":
            badges.append("outbound")
    if intelligence and intelligence.get("urgency") in ("high", "urgent"):
        badges.append(str(intelligence["urgency"]))
    if intelligence and intelligence.get("intent"):
        badges.append(f"intent:{intelligence['intent']}")
    if event.type == "invoice_overdue" or (event.metadata or {}).get("status") == "overdue":
        badges.append("overdue")
    if kind == "action":
        badges.append(str((event.metadata or {}).get("priority") or "normal"))
    return badges


def _searchable(event: EventPublic, title: str, summary: str, intelligence: Optional[dict]) -> str:
    meta = event.metadata or {}
    parts = [
        title,
        summary,
        event.type,
        str(meta.get("fromEmail") or ""),
        str(meta.get("fromName") or ""),
        str(meta.get("number") or ""),
        str(meta.get("fileName") or ""),
        str((intelligence or {}).get("summary") or ""),
        str((intelligence or {}).get("intent") or ""),
        str((intelligence or {}).get("suggestedActionTitle") or ""),
    ]
    return " ".join(p for p in parts if p).strip().lower()


def _action_to_event(doc: dict) -> EventPublic:
    status = doc.get("status") or ACTION_STATUS_PENDING
    if status == "completed":
        event_type = "action_completed"
        created = doc.get("completedAt") or doc.get("updatedAt") or doc.get("createdAt") or ""
    elif status == "dismissed":
        event_type = "action_dismissed"
        created = doc.get("completedAt") or doc.get("updatedAt") or doc.get("createdAt") or ""
    else:
        event_type = "action_created"
        created = doc.get("createdAt") or ""
    meta = {
        "title": doc.get("title"),
        "description": doc.get("description"),
        "priority": doc.get("priority"),
        "actionStatus": status,
        "actionType": doc.get("type"),
        "communicationId": doc.get("communicationId"),
        "fromIntelligence": bool((doc.get("metadata") or {}).get("fromIntelligence")),
    }
    return EventPublic(
        id=f"action-{doc['id']}-{event_type}",
        type=event_type,
        entityType="action",
        entityId=str(doc.get("id") or ""),
        clientId=doc.get("clientId"),
        metadata=meta,
        createdAt=created,
    )


async def _load_actions_as_events(db, user_id: str, client_id: str, *, window: int) -> List[EventPublic]:
    cursor = (
        db.actions.find({"userId": user_id, "clientId": client_id}, {"_id": 0})
        .sort("createdAt", -1)
        .limit(window)
    )
    out: List[EventPublic] = []
    async for doc in cursor:
        out.append(_action_to_event(doc))
    return out


async def _batch_intelligence(
    db, user_id: str, communication_ids: List[str]
) -> Dict[str, dict]:
    if not communication_ids:
        return {}
    cursor = db.communication_analyses.find(
        {
            "userId": user_id,
            "communicationId": {"$in": communication_ids},
            "status": "ready",
        },
        {"_id": 0},
    )
    out: Dict[str, dict] = {}
    async for doc in cursor:
        cid = doc.get("communicationId")
        if cid:
            out[str(cid)] = doc
    return out


def event_to_item_v2(
    event: EventPublic,
    *,
    intelligence: Optional[dict] = None,
    client_is_prospect: bool = False,
    kind: str = "event",
) -> TimelineItemV2:
    meta = dict(event.metadata or {})
    category = categorize_event_type(event.type, kind=kind)
    if event.type in COMM_TYPES:
        kind = "communication"
    elif event.entityType == "action" or event.type in ACTION_EVENT_TYPES:
        kind = "action"
        category = "actions"

    intel_pub = None
    if intelligence:
        intel_pub = TimelineIntelligencePublic(
            summary=intelligence.get("summary"),
            intent=intelligence.get("intent"),
            urgency=intelligence.get("urgency"),
            suggestedActionTitle=intelligence.get("suggestedActionTitle"),
            suggestedActionType=intelligence.get("suggestedActionType"),
            suggestionStatus=intelligence.get("suggestionStatus"),
            status=intelligence.get("status"),
            confidence=intelligence.get("confidence"),
        )

    title = _human_title(event.type, meta)
    summary = _human_summary(event, intelligence=intelligence)
    badges = _badges_for(
        event, kind=kind, intelligence=intelligence, client_is_prospect=client_is_prospect
    )

    return TimelineItemV2(
        id=event.id,
        type=event.type,
        entityType=event.entityType,
        entityId=event.entityId,
        clientId=event.clientId,
        metadata=meta,
        createdAt=event.createdAt,
        category=category,
        kind=kind,
        title=title,
        summary=summary,
        badges=badges,
        amountCents=_amount_cents(meta),
        status=meta.get("status") or meta.get("actionStatus"),
        priority=meta.get("priority"),
        actionStatus=meta.get("actionStatus"),
        intelligence=intel_pub,
        externalUrl=meta.get("gmailUrl") or meta.get("externalUrl"),
        searchableText=_searchable(event, title, summary, intelligence),
    )


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _client_since_label(created: Optional[str]) -> tuple[Optional[int], Optional[str]]:
    dt = _parse_dt(created)
    if not dt:
        return None, None
    month = _MONTHS_FR[dt.month] if 1 <= dt.month <= 12 else ""
    label = f"{month} {dt.year}".strip() if month else str(dt.year)
    return dt.year, label


def _relative_fr(iso: Optional[str], *, now: Optional[datetime] = None) -> Optional[str]:
    dt = _parse_dt(iso)
    if not dt:
        return None
    now = now or datetime.now(timezone.utc)
    days = (now.date() - dt.date()).days
    if days == 0:
        return "aujourd'hui"
    if days == 1:
        return "hier"
    if days < 7:
        return f"il y a {days} jours"
    return dt.strftime("%d/%m/%Y")


def build_deterministic_narrative(summary: ClientRelationSummary) -> Optional[str]:
    """French narrative from real counters only — empty if almost no signal."""
    parts: List[str] = []
    if summary.clientSinceLabel:
        parts.append(f"Client depuis {summary.clientSinceLabel}.")
    elif summary.clientSinceYear:
        parts.append(f"Client depuis {summary.clientSinceYear}.")

    quote_bits = []
    if summary.sentQuotesCount or summary.activeQuotesCount:
        n = summary.activeQuotesCount or summary.sentQuotesCount
        if n == 1:
            quote_bits.append("un devis en cours")
        elif n > 1:
            quote_bits.append(f"{n} devis en cours")
    if summary.acceptedQuotesCount == 1:
        quote_bits.append("dont un accepté" if quote_bits else "un devis accepté")
    elif summary.acceptedQuotesCount > 1:
        quote_bits.append(
            f"dont {summary.acceptedQuotesCount} acceptés"
            if quote_bits
            else f"{summary.acceptedQuotesCount} devis acceptés"
        )
    if quote_bits:
        parts.append(" ".join(quote_bits).capitalize() + ".")

    if summary.lastExchangeAt:
        when = _relative_fr(summary.lastExchangeAt) or "récemment"
        topic = summary.primarySubject or summary.lastRequestLabel or summary.lastExchangeLabel
        if topic and summary.aiLastExchangeSummary:
            parts.append(f"Dernier échange {when} : {summary.aiLastExchangeSummary.rstrip('.')}.")
        elif topic:
            parts.append(f"Dernier échange {when} au sujet de « {topic} ».")
        else:
            parts.append(f"Dernier échange {when}.")

    if summary.openActionsCount == 1:
        parts.append("Une action est encore ouverte.")
    elif summary.openActionsCount > 1:
        parts.append(f"{summary.openActionsCount} actions sont encore ouvertes.")

    if summary.overdueInvoicesCount == 1:
        parts.append("Une facture est en retard.")
    elif summary.overdueInvoicesCount > 1:
        parts.append(f"{summary.overdueInvoicesCount} factures sont en retard.")

    if not parts:
        return None
    return " ".join(parts)


async def build_relation_summary(
    db,
    user_id: str,
    client_id: str,
    *,
    client_doc: Optional[dict],
    items_sample: List[TimelineItemV2],
) -> ClientRelationSummary:
    from kpi_definitions import compute_client_collected_revenue

    client = client_doc or {}
    since_year, since_label = _client_since_label(client.get("createdAt"))

    invoices_count = await db.invoices.count_documents(
        {"userId": user_id, "clientId": client_id}
    )
    unpaid_count = await db.invoices.count_documents(
        {
            "userId": user_id,
            "clientId": client_id,
            "status": {"$in": ["sent", "issued", "overdue", "partially_paid", "in_progress"]},
        }
    )
    overdue_count = await db.invoices.count_documents(
        {"userId": user_id, "clientId": client_id, "status": "overdue"}
    )
    active_quotes = await db.quotes.count_documents(
        {
            "userId": user_id,
            "clientId": client_id,
            "status": {"$in": list(_ACTIVE_QUOTE_STATUSES)},
        }
    )
    accepted_quotes = await db.quotes.count_documents(
        {"userId": user_id, "clientId": client_id, "status": "accepted"}
    )
    sent_quotes = await db.quotes.count_documents(
        {"userId": user_id, "clientId": client_id, "status": {"$in": ["sent", "viewed"]}}
    )
    quotes_count = await db.quotes.count_documents(
        {"userId": user_id, "clientId": client_id}
    )
    communication_count = await db.communications.count_documents(
        {"userId": user_id, "clientId": client_id}
    )
    total_revenue = await compute_client_collected_revenue(db, user_id, client_id)

    from action_engine.service import list_actions

    actions_page = await list_actions(
        db,
        user_id,
        client_id=client_id,
        status=ACTION_STATUS_PENDING,
        limit=50,
        offset=0,
        include_snoozed=False,
    )
    pending_sorted = sorted(
        actions_page.items,
        key=lambda a: (
            _PRIORITY_RANK.get(a.priority or "normal", 9),
            str(a.dueAt or "9999"),
            str(a.createdAt or ""),
        ),
    )
    top_actions = [
        TopOpenActionPublic(
            id=a.id,
            title=str(a.title or "Action"),
            priority=str(a.priority or "normal"),
            dueAt=a.dueAt,
            type=a.type,
            communicationId=a.communicationId,
            status=ACTION_STATUS_PENDING,
        )
        for a in pending_sorted[:3]
    ]
    open_actions_count = int(actions_page.total)

    next_rem_doc = await db.personal_reminders.find_one(
        {
            "userId": user_id,
            "clientId": client_id,
            "status": "pending",
        },
        {"_id": 0},
        sort=[("remindAt", 1)],
    )
    next_reminder = None
    if next_rem_doc and next_rem_doc.get("remindAt"):
        next_reminder = NextReminderPublic(
            id=str(next_rem_doc.get("id") or ""),
            remindAt=str(next_rem_doc["remindAt"]),
            message=next_rem_doc.get("message") or next_rem_doc.get("title"),
            noteId=next_rem_doc.get("noteId"),
        )

    is_prospect = bool(client.get("isProspect")) or (
        invoices_count == 0 and quotes_count == 0 and not client.get("company")
    )
    if invoices_count > 0 or quotes_count > 0:
        is_prospect = False

    last_exchange_at = None
    last_exchange_label = None
    last_action_label = None
    ai_relation = None
    ai_last = None
    last_important = None
    last_document_label = None
    primary_subject = None
    last_request = None
    recommended = None

    for item in items_sample:
        if item.category == "communications" and not last_exchange_at:
            last_exchange_at = item.createdAt
            last_exchange_label = item.title
            primary_subject = item.title
            if item.intelligence and item.intelligence.summary:
                ai_last = item.intelligence.summary
            if item.intelligence and item.intelligence.intent:
                last_request = _INTENT_REQUEST_LABELS.get(item.intelligence.intent)
            if item.intelligence and item.intelligence.suggestedActionTitle:
                if item.intelligence.suggestionStatus == "pending":
                    recommended = item.intelligence.suggestedActionTitle
            last_important = LastImportantCommunicationPublic(
                id=str(item.entityId or item.id),
                subject=item.title,
                createdAt=item.createdAt,
                direction=(item.metadata or {}).get("direction"),
                summary=(item.intelligence.summary if item.intelligence else item.summary),
                intent=(item.intelligence.intent if item.intelligence else None),
                urgency=(item.intelligence.urgency if item.intelligence else None),
                externalUrl=item.externalUrl,
            )
        if item.category in ("commercial", "actions") and not last_action_label:
            last_action_label = item.title
        if item.category in ("commercial", "documents") and not last_document_label:
            last_document_label = item.title

    if not recommended and top_actions:
        recommended = top_actions[0].title

    intents: Dict[str, int] = {}
    for item in items_sample:
        if item.intelligence and item.intelligence.intent:
            intents[item.intelligence.intent] = intents.get(item.intelligence.intent, 0) + 1
    if intents:
        top = max(intents.items(), key=lambda kv: kv[1])[0]
        intent_labels = {
            "request_quote": "des demandes de devis",
            "request_callback": "des demandes de rappel",
            "appointment_request": "des demandes de rendez-vous",
            "complaint": "des réclamations",
            "payment_question": "des questions de paiement",
            "question": "des questions",
            "follow_up": "des suivis",
        }
        label = intent_labels.get(top)
        if label and top != "other":
            ai_relation = f"Ce client génère principalement {label}."

    summary = ClientRelationSummary(
        clientSinceYear=since_year,
        clientSinceLabel=since_label,
        lastExchangeAt=last_exchange_at,
        lastExchangeLabel=last_exchange_label,
        lastActionLabel=last_action_label,
        invoicesCount=int(invoices_count),
        unpaidCount=int(unpaid_count),
        openActionsCount=open_actions_count,
        isProspect=bool(is_prospect),
        aiRelationSummary=ai_relation,
        aiLastExchangeSummary=ai_last,
        topOpenActions=top_actions,
        nextReminder=next_reminder,
        lastImportantCommunication=last_important,
        latestIntelligenceSummary=ai_last,
        activeQuotesCount=int(active_quotes),
        acceptedQuotesCount=int(accepted_quotes),
        sentQuotesCount=int(sent_quotes),
        overdueInvoicesCount=int(overdue_count),
        totalRevenue=int(total_revenue or 0),
        communicationCount=int(communication_count),
        lastDocumentLabel=last_document_label,
        recommendedActionTitle=recommended,
        primarySubject=primary_subject,
        lastRequestLabel=last_request,
    )
    summary.narrative = build_deterministic_narrative(summary)
    return summary


async def list_client_timeline_v2(
    db,
    user_id: str,
    client_id: str,
    *,
    limit: int = 40,
    offset: int = 0,
    category: str = "all",
) -> TimelineV2Response:
    limit = max(1, min(int(limit), 100))
    offset = max(0, int(offset))
    category = (category or "all").strip().lower()
    if category not in {
        "all",
        "communications",
        "commercial",
        "actions",
        "notes",
        "documents",
    }:
        category = "all"

    client_doc = await db.clients.find_one(
        {"userId": user_id, "id": client_id},
        {"_id": 0},
    )

    # Oversample then filter — supports thousands with progressive load
    window = max(limit + offset, limit) * 4
    base = await list_universal_client_timeline(
        db, user_id, client_id, limit=window, offset=0
    )
    action_events = await _load_actions_as_events(db, user_id, client_id, window=window)

    merged_events: List[EventPublic] = list(base.items) + action_events
    # Dedupe by id
    seen: Set[str] = set()
    unique: List[EventPublic] = []
    for ev in merged_events:
        if ev.id in seen:
            continue
        seen.add(ev.id)
        unique.append(ev)
    unique.sort(key=lambda e: e.createdAt or "", reverse=True)

    comm_ids = []
    for ev in unique:
        cid = (ev.metadata or {}).get("communicationId")
        if cid and ev.type in COMM_TYPES:
            comm_ids.append(str(cid))
    intel_map = await _batch_intelligence(db, user_id, list(dict.fromkeys(comm_ids)))

    # Prospect heuristic for badges
    invoices_count = await db.invoices.count_documents(
        {"userId": user_id, "clientId": client_id}
    )
    quotes_count = await db.quotes.count_documents(
        {"userId": user_id, "clientId": client_id}
    )
    client_is_prospect = invoices_count == 0 and quotes_count == 0

    items_all: List[TimelineItemV2] = []
    for ev in unique:
        cid = str((ev.metadata or {}).get("communicationId") or "")
        intel = intel_map.get(cid)
        kind = "action" if ev.entityType == "action" else "event"
        items_all.append(
            event_to_item_v2(
                ev,
                intelligence=intel,
                client_is_prospect=client_is_prospect,
                kind=kind,
            )
        )

    if category != "all":
        filtered = [i for i in items_all if i.category == category]
    else:
        filtered = items_all

    total = len(filtered)
    page = filtered[offset : offset + limit]

    summary = await build_relation_summary(
        db,
        user_id,
        client_id,
        client_doc=client_doc,
        items_sample=items_all[:80],
    )

    return TimelineV2Response(
        items=page,
        total=total,
        limit=limit,
        offset=offset,
        category=category,
        summary=summary,
    )
