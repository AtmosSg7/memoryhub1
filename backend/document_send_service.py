from typing import Literal, Optional, Tuple

from fastapi import HTTPException

from events import record_event
from follow_up_service import (
    FollowUpLang,
    _client_greeting,
    _format_amount,
    _load_client,
    _load_invoice,
    _load_quote,
)
from portal_service import build_portal_url

BLOCKED_QUOTE_STATUSES = {"rejected", "expired"}


def _normalize_invoice_status(status: Optional[str]) -> str:
    if not status or status in ("draft", "sent"):
        return "in_progress"
    if status in ("in_progress", "paid", "overdue", "cancelled"):
        return status
    return "in_progress"


async def _load_portal_url(db, user_id: str, client_id: str) -> Optional[str]:
    portal = await db.client_portals.find_one(
        {"userId": user_id, "clientId": client_id, "isActive": True},
        {"_id": 0, "token": 1},
    )
    if not portal:
        return None
    return build_portal_url(portal["token"])


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


def _build_quote_send_message(
    *,
    lang: FollowUpLang,
    greeting: str,
    number: str,
    title: str,
    amount_ttc: int,
    company_name: str,
    portal_url: Optional[str],
) -> Tuple[str, str]:
    amount = _format_amount(amount_ttc, lang)
    title_part = f" « {title} »" if title else ""
    if lang == "en":
        subject = f"Quote {number}"
        body = (
            f"Hello {greeting},\n\n"
            f"Please find attached our quote {number}{title_part} for {amount}.\n"
        )
        if portal_url:
            body += (
                f"\nYou can review and accept it online:\n{portal_url}\n"
            )
        else:
            body += "\nThe PDF is attached to this email.\n"
        body += (
            f"\nPlease let me know if you have any questions.\n\n"
            f"Best regards,\n{company_name}"
        )
    else:
        subject = f"Devis {number}"
        body = (
            f"Bonjour {greeting},\n\n"
            f"Veuillez trouver ci-joint notre devis {number}{title_part}, "
            f"d'un montant de {amount}.\n"
        )
        if portal_url:
            body += (
                f"\nVous pouvez le consulter et le valider en ligne :\n{portal_url}\n"
            )
        else:
            body += "\nLe PDF est joint à cet e-mail.\n"
        body += (
            f"\nJe reste à votre disposition pour toute question.\n\n"
            f"Cordialement,\n{company_name}"
        )
    return subject, body


def _build_invoice_send_message(
    *,
    lang: FollowUpLang,
    greeting: str,
    number: str,
    amount_ttc: int,
    company_name: str,
    portal_url: Optional[str],
) -> Tuple[str, str]:
    amount = _format_amount(amount_ttc, lang)
    if lang == "en":
        subject = f"Invoice {number}"
        body = (
            f"Hello {greeting},\n\n"
            f"Please find attached invoice {number} for {amount}.\n"
        )
        if portal_url:
            body += f"\nYou can also view it online:\n{portal_url}\n"
        else:
            body += "\nThe PDF is attached to this email.\n"
        body += f"\nBest regards,\n{company_name}"
    else:
        subject = f"Facture {number}"
        body = (
            f"Bonjour {greeting},\n\n"
            f"Veuillez trouver ci-joint la facture {number}, "
            f"d'un montant de {amount}.\n"
        )
        if portal_url:
            body += f"\nVous pouvez aussi la consulter en ligne :\n{portal_url}\n"
        else:
            body += "\nLe PDF est joint à cet e-mail.\n"
        body += f"\nCordialement,\n{company_name}"
    return subject, body


async def build_document_send_preview(
    db,
    user_id: str,
    *,
    entity_type: str,
    entity_id: str,
    lang: FollowUpLang = "fr",
    company_name: str = "MemoryHub",
) -> dict:
    portal_url: Optional[str] = None

    if entity_type == "quote":
        quote = await _load_quote(db, user_id, entity_id)
        _validate_quote_send(quote)
        client = await _load_client(db, user_id, quote["clientId"])
        portal_url = await _load_portal_url(db, user_id, quote["clientId"])
        greeting = _client_greeting(client, quote.get("clientName", ""))
        subject, message = _build_quote_send_message(
            lang=lang,
            greeting=greeting,
            number=quote.get("number", ""),
            title=quote.get("title") or "",
            amount_ttc=quote.get("amountTTC", 0),
            company_name=company_name,
            portal_url=portal_url,
        )
        return {
            "entityType": "quote",
            "entityId": quote["id"],
            "clientId": quote["clientId"],
            "clientName": quote.get("clientName", ""),
            "clientEmail": client.get("email"),
            "subject": subject,
            "message": message,
            "documentNumber": quote.get("number", ""),
            "portalUrl": portal_url,
        }

    if entity_type == "invoice":
        invoice = await _load_invoice(db, user_id, entity_id)
        _validate_invoice_send(invoice)
        client = await _load_client(db, user_id, invoice["clientId"])
        portal_url = await _load_portal_url(db, user_id, invoice["clientId"])
        greeting = _client_greeting(client, invoice.get("clientName", ""))
        subject, message = _build_invoice_send_message(
            lang=lang,
            greeting=greeting,
            number=invoice.get("number", ""),
            amount_ttc=invoice.get("amountTTC", 0),
            company_name=company_name,
            portal_url=portal_url,
        )
        return {
            "entityType": "invoice",
            "entityId": invoice["id"],
            "clientId": invoice["clientId"],
            "clientName": invoice.get("clientName", ""),
            "clientEmail": client.get("email"),
            "subject": subject,
            "message": message,
            "documentNumber": invoice.get("number", ""),
            "portalUrl": portal_url,
        }

    raise HTTPException(status_code=400, detail={"message": "Invalid entity type."})


async def record_document_send_prepared(
    db,
    user_id: str,
    *,
    entity_type: str,
    entity_id: str,
    message: str,
    subject: Optional[str] = None,
    lang: FollowUpLang = "fr",
    company_name: str = "MemoryHub",
) -> dict:
    preview = await build_document_send_preview(
        db,
        user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        lang=lang,
        company_name=company_name,
    )

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
