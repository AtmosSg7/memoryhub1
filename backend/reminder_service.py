import os

from datetime import datetime, timedelta, timezone

from typing import List, Optional



from reminder_models import PRIORITY_ORDER, ReminderPublic, ReminderPriority, ReminderType

from invoice_payments import compute_amount_due, get_amount_paid



UNPAID_INVOICE_DAYS = int(os.environ.get("REMINDER_UNPAID_INVOICE_DAYS", "30"))

QUOTE_NO_RESPONSE_DAYS = int(os.environ.get("REMINDER_QUOTE_NO_RESPONSE_DAYS", "7"))

QUOTE_VALIDITY_DAYS = int(os.environ.get("REMINDER_QUOTE_VALIDITY_DAYS", "30"))

QUOTE_EXPIRING_WARNING_DAYS = int(os.environ.get("REMINDER_QUOTE_EXPIRING_WARNING_DAYS", "7"))

INVOICE_PAYMENT_DAYS = int(os.environ.get("REMINDER_INVOICE_PAYMENT_DAYS", "30"))

INVOICE_DUE_SOON_DAYS = int(os.environ.get("REMINDER_INVOICE_DUE_SOON_DAYS", "7"))

INVOICE_SIGNIFICANT_AMOUNT_CENTS = int(

    os.environ.get("REMINDER_INVOICE_SIGNIFICANT_AMOUNT_CENTS", "50000")

)



INVOICE_PROJECTION = {"_id": 0, "userId": 0}

QUOTE_PROJECTION = {"_id": 0, "userId": 0}





def _user_filter(user_id: str) -> dict:

    return {"userId": user_id}





def _parse_iso(value: Optional[str]) -> Optional[datetime]:

    if not value or not str(value).strip():

        return None

    try:

        normalized = str(value).strip().replace("Z", "+00:00")

        dt = datetime.fromisoformat(normalized)

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

    reference = now or _utc_now()

    return (reference - dt).days





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





def _invoice_reference_date(doc: dict) -> str:

    return doc.get("invoiceDate") or doc.get("createdAt", "")





def _quote_reference_date(doc: dict) -> str:

    return doc.get("quoteDate") or doc.get("createdAt", "")





def _quote_activity_date(doc: dict) -> str:

    return doc.get("updatedAt") or _quote_reference_date(doc)





def _format_amount_eur(cents: int) -> str:

    return f"{cents / 100:,.0f}".replace(",", " ").replace(".", ",")





async def _invoice_overdue_reminders(db, user_id: str) -> List[ReminderPublic]:

    reminders = []

    query = {**_user_filter(user_id), "status": "overdue"}

    async for doc in db.invoices.find(query, INVOICE_PROJECTION):

        ref_date = _invoice_reference_date(doc)

        amount = doc.get("amountTTC", 0)

        reminders.append(

            _build_reminder(

                reminder_type="invoice_overdue",

                entity_id=doc["id"],

                priority="critical",

                title="Facture en retard",

                description=(

                    f"Facture {doc['number']} — {doc.get('clientName', '')} — "

                    f"{_format_amount_eur(amount)} € TTC en attente."

                ),

                link="/dashboard/invoices",

                date=ref_date,

            )

        )

    return reminders





async def _invoice_unpaid_reminders(db, user_id: str) -> List[ReminderPublic]:

    reminders = []

    query = {**_user_filter(user_id), "status": {"$in": ["in_progress", "sent"]}}

    async for doc in db.invoices.find(query, INVOICE_PROJECTION):

        ref_date = _invoice_reference_date(doc)

        days = _days_since(ref_date)

        if days is None or days < UNPAID_INVOICE_DAYS:

            continue

        amount_due = compute_amount_due(doc.get("amountTTC", 0), get_amount_paid(doc))

        if amount_due <= 0:

            continue

        reminders.append(

            _build_reminder(

                reminder_type="invoice_unpaid",

                entity_id=doc["id"],

                priority="high",

                title="Facture impayée",

                description=(

                    f"Facture {doc['number']} — {doc.get('clientName', '')} — "

                    f"impayée depuis {days} jours ({_format_amount_eur(amount_due)} € restants)."

                ),

                link="/dashboard/invoices",

                date=ref_date,

            )

        )

    return reminders





async def _invoice_due_soon_reminders(db, user_id: str) -> List[ReminderPublic]:

    reminders = []

    now = _utc_now()

    query = {**_user_filter(user_id), "status": {"$in": ["in_progress", "sent"]}}

    async for doc in db.invoices.find(query, INVOICE_PROJECTION):

        invoice_date = _parse_iso(_invoice_reference_date(doc))

        if not invoice_date:

            continue

        amount = doc.get("amountTTC", 0)

        if amount < INVOICE_SIGNIFICANT_AMOUNT_CENTS:

            continue

        due_date = invoice_date + timedelta(days=INVOICE_PAYMENT_DAYS)

        if due_date <= now:

            continue

        days_until_due = (due_date - now).days

        if days_until_due > INVOICE_DUE_SOON_DAYS:

            continue

        reminders.append(

            _build_reminder(

                reminder_type="invoice_due_soon",

                entity_id=doc["id"],

                priority="high" if days_until_due <= 3 else "medium",

                title="Échéance proche",

                description=(

                    f"Facture {doc['number']} — {doc.get('clientName', '')} — "

                    f"{_format_amount_eur(amount)} € due dans {days_until_due} jour(s)."

                ),

                link="/dashboard/invoices",

                date=due_date.isoformat(),

            )

        )

    return reminders





async def _quote_no_response_reminders(db, user_id: str) -> List[ReminderPublic]:

    reminders = []

    query = {**_user_filter(user_id), "status": "sent"}

    async for doc in db.quotes.find(query, QUOTE_PROJECTION):

        ref_date = _quote_activity_date(doc)

        days = _days_since(ref_date)

        if days is None or days < QUOTE_NO_RESPONSE_DAYS:

            continue

        amount = doc.get("amountTTC", 0)

        reminders.append(

            _build_reminder(

                reminder_type="quote_no_response",

                entity_id=doc["id"],

                priority="medium",

                title="Devis sans réponse",

                description=(

                    f"Devis {doc['number']} — {doc.get('clientName', '')} — "

                    f"aucune réponse depuis {days} jours ({_format_amount_eur(amount)} €)."

                ),

                link="/dashboard/quotes",

                date=ref_date,

            )

        )

    return reminders





async def _quote_expiring_soon_reminders(db, user_id: str) -> List[ReminderPublic]:

    reminders = []

    now = _utc_now()

    warning_threshold = now + timedelta(days=QUOTE_EXPIRING_WARNING_DAYS)

    query = {**_user_filter(user_id), "status": "sent"}

    async for doc in db.quotes.find(query, QUOTE_PROJECTION):

        quote_date = _parse_iso(_quote_reference_date(doc))

        if not quote_date:

            continue

        expiry_date = quote_date + timedelta(days=QUOTE_VALIDITY_DAYS)

        if expiry_date <= now or expiry_date > warning_threshold:

            continue

        days_left = (expiry_date - now).days

        amount = doc.get("amountTTC", 0)

        reminders.append(

            _build_reminder(

                reminder_type="quote_expiring_soon",

                entity_id=doc["id"],

                priority="high" if days_left <= 3 else "medium",

                title="Devis expire bientôt",

                description=(

                    f"Devis {doc['number']} — {doc.get('clientName', '')} — "

                    f"expire dans {days_left} jour(s) ({_format_amount_eur(amount)} €)."

                ),

                link="/dashboard/quotes",

                date=expiry_date.isoformat(),

            )

        )

    return reminders


async def _quote_accepted_pending_invoice_reminders(db, user_id: str) -> List[ReminderPublic]:
    reminders = []
    query = {**_user_filter(user_id), "status": "accepted"}
    async for doc in db.quotes.find(query, QUOTE_PROJECTION):
        if doc.get("invoiceId"):
            continue
        ref_date = doc.get("portalAcceptedAt") or _quote_activity_date(doc)
        amount = doc.get("amountTTC", 0)
        via_portal = bool(doc.get("portalAcceptedAt"))
        reminders.append(
            _build_reminder(
                reminder_type="quote_accepted_pending_invoice",
                entity_id=doc["id"],
                priority="critical" if via_portal else "high",
                title="Créer la facture" if via_portal else "Devis accepté",
                description=(
                    f"Devis {doc['number']} — {doc.get('clientName', '')} — "
                    f"{'accepté via le portail client' if via_portal else 'accepté, facture à créer'} "
                    f"({_format_amount_eur(amount)} €)."
                ),
                link=f"/dashboard/quotes?open={doc['id']}",
                date=ref_date,
            )
        )
    return reminders


def _sort_reminders(reminders: List[ReminderPublic]) -> List[ReminderPublic]:

    return sorted(

        reminders,

        key=lambda item: (

            PRIORITY_ORDER.get(item.priority, 99),

            -(_parse_iso(item.date) or datetime.min.replace(tzinfo=timezone.utc)).timestamp(),

        ),

    )





async def generate_reminders(db, user_id: str) -> List[ReminderPublic]:

    """Build actionable reminders that protect time, money or client relationships."""

    generators = [

        _invoice_overdue_reminders,

        _invoice_unpaid_reminders,

        _invoice_due_soon_reminders,

        _quote_no_response_reminders,

        _quote_expiring_soon_reminders,

        _quote_accepted_pending_invoice_reminders,

    ]

    reminders: List[ReminderPublic] = []

    for generator in generators:

        reminders.extend(await generator(db, user_id))

    return _sort_reminders(reminders)

