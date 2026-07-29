"""Follow-up rule engine — staged reminders for quotes and invoices."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from commercial_lifecycle import active_document_filter
from commercial_lifecycle_constants import (
    INVOICE_DUE_SOON_DAYS,
    INVOICE_FOLLOW_UP_INTERVAL_DAYS,
    INVOICE_PAYMENT_DAYS,
    MAX_FOLLOW_UP_STAGE,
    QUOTE_FOLLOW_UP_INTERVAL_DAYS,
    QUOTE_NO_RESPONSE_DAYS,
    QUOTE_VIEWED_NO_RESPONSE_DAYS,
)
from invoice_payments import compute_amount_due, get_amount_paid
from reminder_models import ReminderPublic, ReminderPriority, ReminderType

INVOICE_PROJECTION = {"_id": 0, "userId": 0}
QUOTE_PROJECTION = {"_id": 0, "userId": 0}
REMINDER_SCAN_LIMIT = 150


def _user_filter(user_id: str) -> dict:
    return {"userId": user_id}


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value or not str(value).strip():
        return None
    try:
        dt = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _days_since(value: Optional[str], *, now: Optional[datetime] = None) -> Optional[int]:
    dt = _parse_iso(value)
    if not dt:
        return None
    return ((now or _utc_now()) - dt).days


def _format_amount_eur(cents: int) -> str:
    return f"{cents / 100:,.0f}".replace(",", " ").replace(".", ",")


def _reminder_id(reminder_type: ReminderType, entity_id: str) -> str:
    return f"{reminder_type}:{entity_id}"


def _build_reminder(
    *,
    reminder_type: ReminderType,
    entity_id: str,
    priority: ReminderPriority,
    title: str,
    description: str,
    link: str,
    date: str,
) -> ReminderPublic:
    return ReminderPublic(
        id=_reminder_id(reminder_type, entity_id),
        type=reminder_type,
        priority=priority,
        title=title,
        description=description,
        link=link,
        date=date,
        resolved=False,
    )


async def count_entity_follow_ups(db, user_id: str, entity_type: str, entity_id: str) -> int:
    return await db.events.count_documents(
        {
            "userId": user_id,
            "entityType": entity_type,
            "entityId": entity_id,
            "type": "follow_up_recorded",
        }
    )


async def last_follow_up_at(db, user_id: str, entity_type: str, entity_id: str) -> Optional[str]:
    doc = await db.events.find_one(
        {
            "userId": user_id,
            "entityType": entity_type,
            "entityId": entity_id,
            "type": "follow_up_recorded",
        },
        {"_id": 0, "createdAt": 1},
        sort=[("createdAt", -1)],
    )
    return doc.get("createdAt") if doc else None


def _follow_up_stage_label(stage: int) -> str:
    if stage <= 1:
        return "première relance"
    if stage == 2:
        return "deuxième relance"
    return "troisième relance"


async def quote_follow_up_engine_reminders(db, user_id: str) -> List[ReminderPublic]:
    reminders: List[ReminderPublic] = []
    query = {**_user_filter(user_id), "status": "sent", **active_document_filter()}

    async for doc in db.quotes.find(query, QUOTE_PROJECTION).limit(REMINDER_SCAN_LIMIT):
        ref_date = doc.get("sentAt") or doc.get("updatedAt") or doc.get("quoteDate")
        days = _days_since(ref_date)
        if days is None:
            continue

        follow_ups = await count_entity_follow_ups(db, user_id, "quote", doc["id"])
        last_follow_up = await last_follow_up_at(db, user_id, "quote", doc["id"])
        days_since_follow_up = _days_since(last_follow_up) if last_follow_up else days

        amount = doc.get("amountTTC", 0)
        number = doc.get("number", "")
        client = doc.get("clientName", "")

        if doc.get("portalFirstViewedAt"):
            viewed_days = _days_since(doc.get("portalFirstViewedAt"))
            if viewed_days is not None and viewed_days >= QUOTE_VIEWED_NO_RESPONSE_DAYS:
                reminders.append(
                    _build_reminder(
                        reminder_type="quote_viewed_no_response",
                        entity_id=doc["id"],
                        priority="high",
                        title="Devis consulté sans réponse",
                        description=(
                            f"Devis {number} — {client} — ouvert il y a {viewed_days} jour(s), "
                            f"aucune décision ({_format_amount_eur(amount)} €)."
                        ),
                        link=f"/dashboard/quotes?open={doc['id']}",
                        date=doc["portalFirstViewedAt"],
                    )
                )

        if follow_ups == 0 and days >= QUOTE_NO_RESPONSE_DAYS:
            continue

        if follow_ups >= MAX_FOLLOW_UP_STAGE:
            continue

        if follow_ups > 0 and (days_since_follow_up is None or days_since_follow_up < QUOTE_FOLLOW_UP_INTERVAL_DAYS):
            continue

        stage = follow_ups + 1
        reminder_type: ReminderType
        if stage == 2:
            reminder_type = "quote_follow_up_second"
        elif stage >= 3:
            reminder_type = "quote_follow_up_third"
        else:
            continue

        reminders.append(
            _build_reminder(
                reminder_type=reminder_type,
                entity_id=doc["id"],
                priority="high" if stage >= 3 else "medium",
                title=f"Devis — {_follow_up_stage_label(stage)}",
                description=(
                    f"Devis {number} — {client} — relance n°{stage} suggérée "
                    f"({_format_amount_eur(amount)} €)."
                ),
                link=f"/dashboard/quotes?open={doc['id']}",
                date=last_follow_up or ref_date,
            )
        )

    return reminders


async def invoice_follow_up_engine_reminders(db, user_id: str) -> List[ReminderPublic]:
    reminders: List[ReminderPublic] = []
    query = {
        **_user_filter(user_id),
        "status": {"$in": ["overdue", "in_progress", "sent"]},
        **active_document_filter(),
    }

    async for doc in db.invoices.find(query, INVOICE_PROJECTION).limit(REMINDER_SCAN_LIMIT):
        amount_due = compute_amount_due(doc.get("amountTTC", 0), get_amount_paid(doc))
        if amount_due <= 0:
            continue

        status = doc.get("status", "in_progress")
        ref_date = doc.get("sentAt") or doc.get("invoiceDate") or doc.get("createdAt")
        follow_ups = await count_entity_follow_ups(db, user_id, "invoice", doc["id"])
        last_follow_up = await last_follow_up_at(db, user_id, "invoice", doc["id"])
        days_since_follow_up = _days_since(last_follow_up)

        number = doc.get("number", "")
        client = doc.get("clientName", "")

        if status == "overdue" and follow_ups > 0:
            if days_since_follow_up is not None and days_since_follow_up >= INVOICE_FOLLOW_UP_INTERVAL_DAYS:
                stage = min(follow_ups + 1, MAX_FOLLOW_UP_STAGE)
                if stage == 2:
                    rtype: ReminderType = "invoice_follow_up_second"
                elif stage >= 3:
                    rtype = "invoice_follow_up_third"
                else:
                    rtype = "invoice_follow_up_second"
                reminders.append(
                    _build_reminder(
                        reminder_type=rtype,
                        entity_id=doc["id"],
                        priority="critical" if stage >= 3 else "high",
                        title=f"Facture — {_follow_up_stage_label(stage)}",
                        description=(
                            f"Facture {number} — {client} — relance n°{stage} "
                            f"({_format_amount_eur(amount_due)} € restants)."
                        ),
                        link=f"/dashboard/invoices?open={doc['id']}",
                        date=last_follow_up or ref_date,
                    )
                )

        invoice_date = _parse_iso(doc.get("invoiceDate") or doc.get("createdAt"))
        if invoice_date and status in ("in_progress", "sent"):
            due_date = invoice_date + timedelta(days=INVOICE_PAYMENT_DAYS)
            days_until_due = (due_date - _utc_now()).days
            if 0 < days_until_due <= INVOICE_DUE_SOON_DAYS:
                reminders.append(
                    _build_reminder(
                        reminder_type="invoice_due_soon",
                        entity_id=doc["id"],
                        priority="high" if days_until_due <= 3 else "medium",
                        title="Échéance proche",
                        description=(
                            f"Facture {number} — {client} — échéance dans {days_until_due} jour(s) "
                            f"({_format_amount_eur(amount_due)} €)."
                        ),
                        link=f"/dashboard/invoices?open={doc['id']}",
                        date=due_date.isoformat(),
                    )
                )

    return reminders


async def automation_reminders(db, user_id: str) -> List[ReminderPublic]:
    """Action-oriented reminders after lifecycle milestones."""
    reminders: List[ReminderPublic] = []

    invoice_query = {**_user_filter(user_id), "status": "paid", **active_document_filter()}
    async for doc in db.invoices.find(invoice_query, INVOICE_PROJECTION).limit(REMINDER_SCAN_LIMIT):
        reminders.append(
            _build_reminder(
                reminder_type="automation_archive_invoice",
                entity_id=doc["id"],
                priority="low",
                title="Archiver la facture",
                description=f"Facture {doc.get('number')} réglée — archiver le dossier.",
                link=f"/dashboard/invoices?open={doc['id']}&action=archive",
                date=doc.get("paidAt") or doc.get("updatedAt"),
            )
        )

    overdue_query = {**_user_filter(user_id), "status": "overdue", **active_document_filter()}
    async for doc in db.invoices.find(overdue_query, INVOICE_PROJECTION).limit(REMINDER_SCAN_LIMIT):
        follow_ups = await count_entity_follow_ups(db, user_id, "invoice", doc["id"])
        if follow_ups > 0:
            continue
        amount_due = compute_amount_due(doc.get("amountTTC", 0), get_amount_paid(doc))
        reminders.append(
            _build_reminder(
                reminder_type="automation_follow_up_invoice",
                entity_id=doc["id"],
                priority="critical",
                title="Relancer la facture",
                description=(
                    f"Facture {doc.get('number')} en retard — première relance suggérée "
                    f"({_format_amount_eur(amount_due)} €)."
                ),
                link=f"/dashboard/invoices?open={doc['id']}&action=follow-up",
                date=doc.get("invoiceDate") or doc.get("updatedAt"),
            )
        )

    return reminders
