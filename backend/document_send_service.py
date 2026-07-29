from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import HTTPException

from email_templates import (
    EmailLang,
    build_invoice_send_email,
    build_quote_send_email,
    format_amount,
    resolve_sender_name,
)
from events import record_event
from follow_up_service import (
    FollowUpLang,
    _client_greeting,
    _load_client,
    _load_invoice,
    _load_portal_url,
    _load_quote,
)
from invoice_payments import compute_amount_due, get_amount_paid
from transactional_email_service import (
    resolve_artisan_locale,
    send_invoice_email,
    send_quote_email,
)

BLOCKED_QUOTE_STATUSES = {"rejected", "expired"}


def _normalize_invoice_status(status: Optional[str]) -> str:
    if not status or status in ("draft", "sent"):
        return "in_progress"
    if status in ("in_progress", "paid", "overdue", "cancelled"):
        return status
    return "in_progress"


def _format_amount(cents: int, lang: FollowUpLang) -> str:
    return format_amount(cents, lang)


def _validate_quote_send(quote: dict) -> None:
    if quote.get("status") in BLOCKED_QUOTE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail={"message": "This quote can no longer be sent to the client."},
        )


def _validate_invoice_send(invoice: dict) -> None:
    if _normalize_invoice_status(invoice.get("status")) == "cancelled":
        raise HTTPException(
            status_code=400,
            detail={"message": "Cannot send a cancelled invoice."},
        )


def _resolve_sender(
    company_name: str,
    lang: EmailLang,
    *,
    first_name: str = "",
    last_name: str = "",
    email_signature: str = "",
) -> str:
    if (email_signature or "").strip():
        return email_signature.strip()
    return resolve_sender_name(company_name, lang, first_name=first_name, last_name=last_name)


async def build_document_send_preview(
    db,
    user_id: str,
    *,
    entity_type: str,
    entity_id: str,
    lang: FollowUpLang = "fr",
    company_name: str = "",
    sender_first_name: str = "",
    sender_last_name: str = "",
) -> dict:
    from company_profile_service import get_user_with_profile, resolve_sender_display

    user = await get_user_with_profile(db, user_id)
    sender = resolve_sender_display(user, user["companyProfile"], lang=lang)

    if entity_type == "quote":
        quote = await _load_quote(db, user_id, entity_id)
        _validate_quote_send(quote)
        client = await _load_client(db, user_id, quote["clientId"])
        portal_url = await _load_portal_url(db, user_id, quote["clientId"])
        greeting = _client_greeting(client, quote.get("clientName", ""))
        email = build_quote_send_email(
            lang=lang,
            greeting=greeting,
            number=quote.get("number", ""),
            title=quote.get("title") or "",
            amount_ttc=quote.get("amountTTC", 0),
            sender_name=sender,
            portal_url=portal_url,
        )
        return {
            "entityType": "quote",
            "entityId": quote["id"],
            "clientId": quote["clientId"],
            "clientName": quote.get("clientName", ""),
            "clientEmail": client.get("email"),
            "subject": email.subject,
            "preheader": email.preheader,
            "message": email.body,
            "documentNumber": quote.get("number", ""),
            "portalUrl": portal_url,
        }

    if entity_type == "invoice":
        invoice = await _load_invoice(db, user_id, entity_id)
        _validate_invoice_send(invoice)
        client = await _load_client(db, user_id, invoice["clientId"])
        portal_url = await _load_portal_url(db, user_id, invoice["clientId"])
        greeting = _client_greeting(client, invoice.get("clientName", ""))
        email = build_invoice_send_email(
            lang=lang,
            greeting=greeting,
            number=invoice.get("number", ""),
            amount_ttc=invoice.get("amountTTC", 0),
            sender_name=sender,
            portal_url=portal_url,
        )
        return {
            "entityType": "invoice",
            "entityId": invoice["id"],
            "clientId": invoice["clientId"],
            "clientName": invoice.get("clientName", ""),
            "clientEmail": client.get("email"),
            "subject": email.subject,
            "preheader": email.preheader,
            "message": email.body,
            "documentNumber": invoice.get("number", ""),
            "portalUrl": portal_url,
        }

    raise HTTPException(status_code=400, detail={"message": "Invalid entity type."})


async def _mark_quote_sent_if_draft(db, user_id: str, quote_id: str) -> None:
    from commercial_lifecycle import mark_quote_sent

    quote = await _load_quote(db, user_id, quote_id)
    await mark_quote_sent(db, user_id, quote, via="document_send")


async def record_document_send_prepared(
    db,
    user_id: str,
    *,
    entity_type: str,
    entity_id: str,
    message: str,
    subject: Optional[str] = None,
    lang: FollowUpLang = "fr",
    company_name: str = "",
    sender_first_name: str = "",
    sender_last_name: str = "",
) -> dict:
    preview = await build_document_send_preview(
        db,
        user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        lang=lang,
        company_name=company_name,
        sender_first_name=sender_first_name,
        sender_last_name=sender_last_name,
    )

    if entity_type == "quote":
        await _mark_quote_sent_if_draft(db, user_id, entity_id)

    final_subject = (subject or preview["subject"]).strip()
    final_message = message.strip()
    excerpt = final_message.replace("\n", " ")[:160]

    metadata = {
        "clientName": preview["clientName"],
        "clientEmail": preview.get("clientEmail"),
        "channel": "manual",
        "sendType": entity_type,
        "subject": final_subject,
        "excerpt": excerpt,
        "documentNumber": preview["documentNumber"],
        "portalUrl": preview.get("portalUrl"),
    }

    if entity_type == "quote":
        metadata["quoteNumber"] = preview["documentNumber"]
        entity_type_event = "quote"
    else:
        metadata["invoiceNumber"] = preview["documentNumber"]
        entity_type_event = "invoice"

    event = await record_event(
        db,
        user_id,
        "document_send_prepared",
        entity_type_event,
        entity_id,
        client_id=preview["clientId"],
        metadata=metadata,
    )

    return {
        "id": event["id"],
        "entityType": entity_type,
        "entityId": entity_id,
        "subject": final_subject,
        "message": final_message,
        "recordedAt": event["createdAt"],
    }


async def send_document_email(
    db,
    user_id: str,
    *,
    entity_type: str,
    entity_id: str,
    recipient_email: str,
    lang: FollowUpLang = "fr",
    company_name: str = "",
    sender_first_name: str = "",
    sender_last_name: str = "",
    idempotency_key: Optional[str] = None,
) -> dict:
    """Send quote/invoice email to client; records send event either way."""
    from email_utils import normalize_email

    try:
        to = normalize_email(recipient_email)
    except Exception:
        raise HTTPException(status_code=422, detail={"message": "Invalid client email address."})

    preview = await build_document_send_preview(
        db,
        user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        lang=lang,
        company_name=company_name,
        sender_first_name=sender_first_name,
        sender_last_name=sender_last_name,
    )

    artisan_locale = await resolve_artisan_locale(db, user_id)
    client_lang: EmailLang = lang if lang in ("fr", "en") else artisan_locale

    from company_profile_service import get_user_with_profile, resolve_sender_display

    owner = await get_user_with_profile(db, user_id)
    sender = resolve_sender_display(owner, owner["companyProfile"], lang=client_lang)
    greeting = _client_greeting(
        await _load_client(db, user_id, preview["clientId"]),
        preview.get("clientName", ""),
    )

    key = idempotency_key or f"doc-send:{entity_type}:{entity_id}:{to}"

    if entity_type == "quote":
        await _mark_quote_sent_if_draft(db, user_id, entity_id)
        quote = await _load_quote(db, user_id, entity_id)
        delivery = await send_quote_email(
            db,
            user_id=user_id,
            to=to,
            greeting=greeting,
            number=quote.get("number", ""),
            title=quote.get("title") or "",
            amount_ttc=int(quote.get("amountTTC") or 0),
            sender_name=sender,
            portal_url=preview.get("portalUrl"),
            locale=client_lang,
            entity_id=entity_id,
            idempotency_key=key,
            status=quote.get("status", "sent"),
        )
    elif entity_type == "invoice":
        invoice = await _load_invoice(db, user_id, entity_id)
        from commercial_lifecycle import mark_invoice_sent

        await mark_invoice_sent(db, user_id, invoice, via="document_send")
        invoice = await _load_invoice(db, user_id, entity_id)
        amount_paid = get_amount_paid(invoice)
        amount_due = compute_amount_due(int(invoice.get("amountTTC") or 0), amount_paid)
        delivery = await send_invoice_email(
            db,
            user_id=user_id,
            to=to,
            greeting=greeting,
            number=invoice.get("number", ""),
            amount_ttc=int(invoice.get("amountTTC") or 0),
            amount_due=amount_due,
            sender_name=sender,
            portal_url=preview.get("portalUrl"),
            locale=client_lang,
            entity_id=entity_id,
            idempotency_key=key,
        )
    else:
        raise HTTPException(status_code=400, detail={"message": "Invalid entity type."})

    excerpt = preview.get("message", "")[:160]
    metadata = {
        "clientName": preview["clientName"],
        "clientEmail": to,
        "channel": "email",
        "sendType": entity_type,
        "subject": preview["subject"],
        "excerpt": excerpt,
        "documentNumber": preview["documentNumber"],
        "portalUrl": preview.get("portalUrl"),
        "emailStatus": delivery.status,
        "emailEventId": delivery.event_id,
    }
    entity_type_event = "quote" if entity_type == "quote" else "invoice"
    event = await record_event(
        db,
        user_id,
        "document_send_prepared",
        entity_type_event,
        entity_id,
        client_id=preview["clientId"],
        metadata=metadata,
    )

    return {
        "id": event["id"],
        "entityType": entity_type,
        "entityId": entity_id,
        "emailStatus": delivery.status,
        "emailDelivered": delivery.delivered,
        "emailEventId": delivery.event_id,
        "recordedAt": event["createdAt"],
    }
