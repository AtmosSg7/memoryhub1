"""Scheduled transactional emails — invoice reminders and overdue notices."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from commercial_lifecycle import compute_invoice_due_at, is_invoice_past_due
from commercial_lifecycle_constants import INVOICE_DUE_SOON_DAYS
from company_profile_service import get_user_with_profile, resolve_sender_display
from email_templates import EmailLang
from email_utils import normalize_email
from email_constants import EMAIL_STATUS_PENDING, EMAIL_STATUS_RETRYING, EMAIL_STATUS_SENT, EMAIL_STATUS_SKIPPED
from email_event_service import find_by_idempotency
from invoice_payments import compute_amount_due, get_amount_paid
from observability import get_logger
from transactional_email_service import (
    resolve_artisan_locale,
    send_invoice_follow_up_email,
)

logger = get_logger(__name__)

INVOICE_PROJECTION = {"_id": 0}
REMINDER_SCAN_LIMIT = 500


def _client_greeting(client: dict, fallback_name: str = "") -> str:
    return (client or {}).get("contactName") or (client or {}).get("name") or fallback_name or ""


async def _resolve_client_email(db, user_id: str, client_id: str) -> Optional[str]:
    client = await db.clients.find_one(
        {"userId": user_id, "id": client_id},
        {"_id": 0, "email": 1},
    )
    if not client or not client.get("email"):
        return None
    try:
        return normalize_email(client["email"])
    except Exception:
        return None


async def _resolve_sender_name(db, user_id: str, lang: EmailLang) -> str:
    owner = await get_user_with_profile(db, user_id)
    return resolve_sender_display(owner, owner["companyProfile"], lang=lang)


async def _send_invoice_reminder(
    db,
    *,
    user_id: str,
    invoice: dict,
    idempotency_key: str,
) -> bool:
    client_id = invoice.get("clientId")
    if not client_id:
        return False

    to = await _resolve_client_email(db, user_id, client_id)
    if not to:
        return False

    artisan_locale = await resolve_artisan_locale(db, user_id)
    sender_name = await _resolve_sender_name(db, user_id, artisan_locale)
    client = await db.clients.find_one(
        {"userId": user_id, "id": client_id},
        {"_id": 0, "contactName": 1, "name": 1},
    )
    greeting = _client_greeting(client, invoice.get("clientName", ""))
    amount_ttc = int(invoice.get("amountTTC") or 0)
    amount_due = compute_amount_due(amount_ttc, get_amount_paid(invoice))

    existing = await find_by_idempotency(db, idempotency_key)
    if existing and existing.get("status") in (
        EMAIL_STATUS_SENT,
        EMAIL_STATUS_RETRYING,
        EMAIL_STATUS_SKIPPED,
        EMAIL_STATUS_PENDING,
    ):
        return False

    try:
        await send_invoice_follow_up_email(
            db,
            user_id=user_id,
            to=to,
            greeting=greeting,
            number=invoice.get("number", ""),
            amount_ttc=amount_ttc,
            amount_due=amount_due,
            sender_name=sender_name,
            locale=artisan_locale,
            invoice_id=invoice["id"],
            idempotency_key=idempotency_key,
        )
        return True
    except Exception:
        logger.exception(
            "Failed to send invoice reminder email for invoice %s (user %s)",
            invoice.get("id"),
            user_id,
        )
        return False


async def send_invoice_due_soon_emails(db, *, user_id: Optional[str] = None) -> int:
    """Send payment reminder emails for invoices approaching their due date."""
    now = datetime.now(timezone.utc)
    query: dict = {"status": {"$in": ["in_progress", "sent"]}}
    if user_id:
        query["userId"] = user_id

    sent = 0
    cursor = db.invoices.find(query, INVOICE_PROJECTION).sort("updatedAt", -1).limit(REMINDER_SCAN_LIMIT)
    async for doc in cursor:
        owner_id = doc.get("userId") or user_id
        if not owner_id:
            continue

        amount = int(doc.get("amountTTC") or 0)
        if amount <= 0:
            continue

        amount_due = compute_amount_due(amount, get_amount_paid(doc))
        if amount_due <= 0:
            continue

        due_at = compute_invoice_due_at(doc)
        if not due_at or due_at <= now:
            continue

        days_until_due = (due_at.date() - now.date()).days
        if days_until_due > INVOICE_DUE_SOON_DAYS:
            continue

        if await _send_invoice_reminder(
            db,
            user_id=owner_id,
            invoice=doc,
            idempotency_key=f"invoice-due-soon:{doc['id']}",
        ):
            sent += 1

    return sent


async def send_invoice_overdue_emails(db, *, user_id: Optional[str] = None) -> int:
    """Send payment reminder emails for overdue invoices with an outstanding balance."""
    now = datetime.now(timezone.utc)
    query: dict = {"status": "overdue"}
    if user_id:
        query["userId"] = user_id

    sent = 0
    cursor = db.invoices.find(query, INVOICE_PROJECTION).sort("updatedAt", -1).limit(REMINDER_SCAN_LIMIT)
    async for doc in cursor:
        owner_id = doc.get("userId") or user_id
        if not owner_id:
            continue

        amount_due = compute_amount_due(int(doc.get("amountTTC") or 0), get_amount_paid(doc))
        if amount_due <= 0:
            continue

        if not is_invoice_past_due(doc, now=now):
            continue

        if await _send_invoice_reminder(
            db,
            user_id=owner_id,
            invoice=doc,
            idempotency_key=f"invoice-overdue:{doc['id']}",
        ):
            sent += 1

    return sent


async def run_scheduled_invoice_emails(db, *, user_id: Optional[str] = None) -> dict:
    """Run all scheduled invoice email tasks (idempotent)."""
    due_soon = await send_invoice_due_soon_emails(db, user_id=user_id)
    overdue = await send_invoice_overdue_emails(db, user_id=user_id)
    return {"invoice_due_soon": due_soon, "invoice_overdue": overdue}
