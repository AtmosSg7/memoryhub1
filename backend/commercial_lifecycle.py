"""Commercial document lifecycle — display status, views, archive, expiry."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from commercial_lifecycle_constants import INVOICE_PAYMENT_DAYS, QUOTE_VALIDITY_DAYS
from invoice_payments import compute_amount_due, get_amount_paid

QuoteDisplayStatus = Literal[
    "draft",
    "sent",
    "viewed",
    "accepted",
    "rejected",
    "expired",
    "converted",
    "archived",
]

InvoiceDisplayStatus = Literal[
    "issued",
    "viewed",
    "partial",
    "paid",
    "overdue",
    "cancelled",
    "archived",
]

LEGACY_INVOICE_STATUSES = {"draft", "sent"}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def invoice_reference_date(doc: dict) -> str:
    return doc.get("invoiceDate") or doc.get("createdAt") or ""


def compute_invoice_due_at(doc: dict) -> Optional[datetime]:
    ref = _parse_iso(invoice_reference_date(doc))
    if not ref:
        return None
    return ref + timedelta(days=INVOICE_PAYMENT_DAYS)


def is_invoice_past_due(doc: dict, *, now: Optional[datetime] = None) -> bool:
    """True when the invoice due date has passed (day after due date)."""
    due_at = compute_invoice_due_at(doc)
    if not due_at:
        return False
    reference = (now or datetime.now(timezone.utc)).date()
    return reference > due_at.date()


def _normalize_invoice_status(status: Optional[str]) -> str:
    if not status or status in LEGACY_INVOICE_STATUSES:
        return "in_progress"
    if status in ("in_progress", "paid", "overdue", "cancelled"):
        return status
    return "in_progress"


def derive_quote_display_status(doc: dict) -> QuoteDisplayStatus:
    if doc.get("isArchived"):
        return "archived"
    if doc.get("invoiceId"):
        return "converted"
    status = doc.get("status", "draft")
    if status == "expired":
        return "expired"
    if status == "rejected":
        return "rejected"
    if status == "accepted":
        return "accepted"
    if status == "sent" and doc.get("portalFirstViewedAt"):
        return "viewed"
    if status == "sent":
        return "sent"
    return "draft"


def derive_invoice_display_status(doc: dict) -> InvoiceDisplayStatus:
    if doc.get("isArchived"):
        return "archived"
    status = _normalize_invoice_status(doc.get("status"))
    if status == "cancelled":
        return "cancelled"
    amount_paid = get_amount_paid(doc)
    amount_ttc = int(doc.get("amountTTC") or 0)
    amount_due = compute_amount_due(amount_ttc, amount_paid)
    if status == "paid" or (amount_due == 0 and amount_paid > 0):
        return "paid"
    if amount_paid > 0 and amount_due > 0:
        return "partial"
    if status == "overdue":
        return "overdue"
    if doc.get("portalFirstViewedAt"):
        return "viewed"
    return "issued"


def lifecycle_fields_for_quote(doc: dict) -> dict:
    return {
        "displayStatus": derive_quote_display_status(doc),
        "sentAt": doc.get("sentAt"),
        "portalFirstViewedAt": doc.get("portalFirstViewedAt"),
        "portalLastViewedAt": doc.get("portalLastViewedAt"),
        "portalViewCount": int(doc.get("portalViewCount") or 0),
        "isArchived": bool(doc.get("isArchived")),
        "archivedAt": doc.get("archivedAt"),
    }


def lifecycle_fields_for_invoice(doc: dict) -> dict:
    return {
        "displayStatus": derive_invoice_display_status(doc),
        "issuedAt": doc.get("issuedAt") or doc.get("createdAt"),
        "sentAt": doc.get("sentAt"),
        "portalFirstViewedAt": doc.get("portalFirstViewedAt"),
        "portalLastViewedAt": doc.get("portalLastViewedAt"),
        "portalViewCount": int(doc.get("portalViewCount") or 0),
        "isArchived": bool(doc.get("isArchived")),
        "archivedAt": doc.get("archivedAt"),
    }


def active_document_filter() -> dict:
    return {"$or": [{"isArchived": {"$exists": False}}, {"isArchived": False}]}


async def mark_quote_sent(
    db,
    user_id: str,
    quote: dict,
    *,
    via: str = "manual",
) -> bool:
    """Transition quote to sent. Returns True if status changed."""
    from events import record_event

    if quote.get("status") not in ("draft",):
        if not quote.get("sentAt"):
            now = _utc_now_iso()
            await db.quotes.update_one(
                {"userId": user_id, "id": quote["id"]},
                {"$set": {"sentAt": now, "updatedAt": now}},
            )
        return False

    now = _utc_now_iso()
    result = await db.quotes.update_one(
        {"userId": user_id, "id": quote["id"], "status": "draft"},
        {"$set": {"status": "sent", "sentAt": now, "updatedAt": now}},
    )
    if result.modified_count == 0:
        return False

    await record_event(
        db,
        user_id,
        "quote_sent",
        "quote",
        quote["id"],
        client_id=quote.get("clientId"),
        metadata={
            "quoteNumber": quote.get("number"),
            "clientName": quote.get("clientName"),
            "via": via,
        },
    )
    return True


async def mark_invoice_sent(
    db,
    user_id: str,
    invoice: dict,
    *,
    via: str = "document_send",
) -> bool:
    """Record invoice send timestamp and timeline event."""
    from events import record_event

    now = _utc_now_iso()
    first_send = not invoice.get("sentAt")
    await db.invoices.update_one(
        {"userId": user_id, "id": invoice["id"]},
        {"$set": {"sentAt": now, "updatedAt": now}},
    )
    if first_send:
        await record_event(
            db,
            user_id,
            "invoice_sent",
            "invoice",
            invoice["id"],
            client_id=invoice.get("clientId"),
            metadata={
                "invoiceNumber": invoice.get("number"),
                "clientName": invoice.get("clientName"),
                "via": via,
            },
        )
    return first_send


async def record_portal_document_view(
    db,
    portal: dict,
    *,
    document_type: str,
    document_id: str,
) -> bool:
    """Track portal view; returns True on first view."""
    from events import record_event

    collection = "quotes" if document_type == "quote" else "invoices"
    event_type = "quote_viewed" if document_type == "quote" else "invoice_viewed"
    number_field = "quoteNumber" if document_type == "quote" else "invoiceNumber"

    doc = await db[collection].find_one(
        {
            "userId": portal["userId"],
            "clientId": portal["clientId"],
            "id": document_id,
        },
        {"_id": 0},
    )
    if not doc:
        return False

    now = _utc_now_iso()
    is_first = not doc.get("portalFirstViewedAt")
    update = {
        "portalLastViewedAt": now,
        "portalViewCount": int(doc.get("portalViewCount") or 0) + 1,
        "updatedAt": now,
    }
    if is_first:
        update["portalFirstViewedAt"] = now

    await db[collection].update_one(
        {"userId": portal["userId"], "id": document_id},
        {"$set": update},
    )

    if is_first:
        number_key = "number"
        await record_event(
            db,
            portal["userId"],
            event_type,
            document_type,
            document_id,
            client_id=portal.get("clientId"),
            metadata={
                number_field: doc.get(number_key),
                "clientName": doc.get("clientName"),
                "source": "portal",
                "portalId": portal.get("id"),
            },
        )
    return is_first


async def archive_quote(db, user_id: str, quote_id: str) -> dict:
    from events import record_event
    from fastapi import HTTPException

    doc = await db.quotes.find_one({"userId": user_id, "id": quote_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Quote not found."})
    if doc.get("isArchived"):
        return doc

    now = _utc_now_iso()
    await db.quotes.update_one(
        {"userId": user_id, "id": quote_id},
        {"$set": {"isArchived": True, "archivedAt": now, "updatedAt": now}},
    )
    doc.update({"isArchived": True, "archivedAt": now, "updatedAt": now})
    await record_event(
        db,
        user_id,
        "quote_archived",
        "quote",
        quote_id,
        client_id=doc.get("clientId"),
        metadata={"quoteNumber": doc.get("number"), "clientName": doc.get("clientName")},
    )
    return doc


async def archive_invoice(db, user_id: str, invoice_id: str) -> dict:
    from events import record_event
    from fastapi import HTTPException

    doc = await db.invoices.find_one({"userId": user_id, "id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Invoice not found."})
    if doc.get("isArchived"):
        return doc

    now = _utc_now_iso()
    await db.invoices.update_one(
        {"userId": user_id, "id": invoice_id},
        {"$set": {"isArchived": True, "archivedAt": now, "updatedAt": now}},
    )
    doc.update({"isArchived": True, "archivedAt": now, "updatedAt": now})
    await record_event(
        db,
        user_id,
        "invoice_archived",
        "invoice",
        invoice_id,
        client_id=doc.get("clientId"),
        metadata={"invoiceNumber": doc.get("number"), "clientName": doc.get("clientName")},
    )
    return doc


async def expire_stale_quotes(db, user_id: Optional[str] = None) -> int:
    """Auto-expire sent quotes past validity window."""
    from analytics import invalidate_user
    from events import record_event

    now = datetime.now(timezone.utc)
    query: dict = {"status": "sent", **active_document_filter()}
    if user_id:
        query["userId"] = user_id

    expired_count = 0
    touched_users = set()
    async for doc in db.quotes.find(query, {"_id": 0}):
        quote_date = _parse_iso(doc.get("quoteDate") or doc.get("createdAt"))
        if not quote_date:
            continue
        if now <= quote_date + timedelta(days=QUOTE_VALIDITY_DAYS):
            continue

        ts = _utc_now_iso()
        result = await db.quotes.update_one(
            {"userId": doc["userId"], "id": doc["id"], "status": "sent"},
            {"$set": {"status": "expired", "expiredAt": ts, "updatedAt": ts}},
        )
        if result.modified_count == 0:
            continue
        expired_count += 1
        touched_users.add(doc["userId"])
        await record_event(
            db,
            doc["userId"],
            "quote_expired",
            "quote",
            doc["id"],
            client_id=doc.get("clientId"),
            metadata={
                "quoteNumber": doc.get("number"),
                "clientName": doc.get("clientName"),
                "validityDays": QUOTE_VALIDITY_DAYS,
            },
        )
    for uid in touched_users:
        invalidate_user(uid)
    return expired_count


def _overdue_candidate_cutoff_iso(now: datetime) -> str:
    """Conservative pre-filter: invoice dates before this may be past due."""
    cutoff_date = now.date() - timedelta(days=INVOICE_PAYMENT_DAYS)
    cutoff = datetime.combine(cutoff_date, datetime.min.time(), tzinfo=timezone.utc)
    return cutoff.isoformat()


async def sync_overdue_invoices(db, user_id: Optional[str] = None) -> int:
    """Mark issued unpaid invoices as overdue once their due date has passed."""
    from analytics import invalidate_user
    from events import record_event

    now = datetime.now(timezone.utc)
    cutoff_iso = _overdue_candidate_cutoff_iso(now)
    query: dict = {
        "status": {"$in": ["in_progress", "sent"]},
        **active_document_filter(),
        "$or": [
            {"invoiceDate": {"$lt": cutoff_iso}},
            {"invoiceDate": {"$exists": False}, "createdAt": {"$lt": cutoff_iso}},
        ],
    }
    if user_id:
        query["userId"] = user_id

    overdue_count = 0
    touched_users = set()
    async for doc in db.invoices.find(query, {"_id": 0}):
        status = _normalize_invoice_status(doc.get("status"))
        if status != "in_progress":
            continue
        amount_due = compute_amount_due(doc.get("amountTTC", 0), get_amount_paid(doc))
        if amount_due <= 0:
            continue
        if not is_invoice_past_due(doc, now=now):
            continue

        ts = _utc_now_iso()
        result = await db.invoices.update_one(
            {"userId": doc["userId"], "id": doc["id"], "status": {"$in": ["in_progress", "sent"]}},
            {"$set": {"status": "overdue", "overdueAt": ts, "updatedAt": ts}},
        )
        if result.modified_count == 0:
            continue

        overdue_count += 1
        touched_users.add(doc["userId"])
        number = doc.get("number") or ""
        await record_event(
            db,
            doc["userId"],
            "invoice_overdue",
            "invoice",
            doc["id"],
            client_id=doc.get("clientId"),
            metadata={
                "invoiceNumber": number,
                "clientName": doc.get("clientName"),
                "amountDue": amount_due,
                "paymentDays": INVOICE_PAYMENT_DAYS,
                "message": f"Facture {number} passée en retard." if number else "Facture passée en retard.",
            },
        )
    for uid in touched_users:
        invalidate_user(uid)
    return overdue_count
