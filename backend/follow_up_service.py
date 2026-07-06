from typing import Dict, List, Literal, Optional, Tuple

from fastapi import HTTPException

from events import record_event
from follow_up_models import FollowUpHistoryItem, FollowUpLastItem
from invoice_payments import compute_amount_due, get_amount_paid

FollowUpLang = Literal["fr", "en"]


def _normalize_invoice_status(status: Optional[str]) -> str:
    if not status or status in ("draft", "sent"):
        return "in_progress"
    if status in ("in_progress", "paid", "overdue", "cancelled"):
        return status
    return "in_progress"


def _format_amount(cents: int, lang: FollowUpLang) -> str:
    value = (cents or 0) / 100
    if lang == "fr":
        return f"{value:.2f}".replace(".", ",") + " €"
    return f"€{value:,.2f}"


def _client_greeting(client: dict, fallback_name: str = "") -> str:
    return (client or {}).get("contactName") or (client or {}).get("name") or fallback_name or ""


async def _load_client(db, user_id: str, client_id: str) -> dict:
    client = await db.clients.find_one({"userId": user_id, "id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})
    return client


async def _load_quote(db, user_id: str, quote_id: str) -> dict:
    quote = await db.quotes.find_one({"userId": user_id, "id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail={"message": "Quote not found."})
    return quote


async def _load_invoice(db, user_id: str, invoice_id: str) -> dict:
    invoice = await db.invoices.find_one({"userId": user_id, "id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail={"message": "Invoice not found."})
    return invoice


def _validate_quote_follow_up(quote: dict) -> None:
    if quote.get("status") != "sent":
        raise HTTPException(
            status_code=400,
            detail={"message": "Follow-up is only available for quotes awaiting a response."},
        )


def _validate_invoice_follow_up(invoice: dict) -> None:
    status = _normalize_invoice_status(invoice.get("status"))
    if status == "cancelled":
        raise HTTPException(status_code=400, detail={"message": "Cannot follow up on a cancelled invoice."})
    amount_due = compute_amount_due(invoice.get("amountTTC", 0), get_amount_paid(invoice))
    if amount_due <= 0:
        raise HTTPException(status_code=400, detail={"message": "This invoice has no amount due."})


def _build_quote_message(
    *,
    lang: FollowUpLang,
    greeting: str,
    number: str,
    title: str,
    amount_ttc: int,
    company_name: str,
) -> Tuple[str, str]:
    amount = _format_amount(amount_ttc, lang)
    title_part = f" (« {title} »)" if title else ""
    if lang == "en":
        subject = f"Follow-up on quote {number}"
        message = (
            f"Hello {greeting},\n\n"
            f"I am following up regarding quote {number}{title_part} for {amount}.\n\n"
            f"Have you had a chance to review it? Please let me know if you have any questions.\n\n"
            f"Best regards,\n{company_name}"
        )
    else:
        subject = f"Relance devis {number}"
        message = (
            f"Bonjour {greeting},\n\n"
            f"Je me permets de revenir vers vous concernant le devis {number}{title_part}, "
            f"d'un montant de {amount}.\n\n"
            f"Avez-vous eu l'occasion de l'examiner ? Je reste à votre disposition pour toute question.\n\n"
            f"Cordialement,\n{company_name}"
        )
    return subject, message


def _build_invoice_message(
    *,
    lang: FollowUpLang,
    greeting: str,
    number: str,
    amount_ttc: int,
    amount_due: int,
    company_name: str,
) -> Tuple[str, str]:
    total = _format_amount(amount_ttc, lang)
    due = _format_amount(amount_due, lang)
    partial = amount_due < amount_ttc
    if lang == "en":
        subject = f"Payment reminder — invoice {number}"
        if partial:
            body = (
                f"Hello {greeting},\n\n"
                f"Unless we are mistaken, invoice {number} (total {total}) still has an outstanding balance of {due}.\n\n"
                f"Please let us know when payment is expected, or contact us if you need assistance.\n\n"
                f"Best regards,\n{company_name}"
            )
        else:
            body = (
                f"Hello {greeting},\n\n"
                f"Unless we are mistaken, invoice {number} for {total} remains unpaid.\n\n"
                f"Please let us know when payment is expected, or contact us if you need assistance.\n\n"
                f"Best regards,\n{company_name}"
            )
    else:
        subject = f"Relance facture {number}"
        if partial:
            body = (
                f"Bonjour {greeting},\n\n"
                f"Sauf erreur de notre part, la facture {number} (montant total {total}) "
                f"présente un reste à régler de {due}.\n\n"
                f"Merci de nous indiquer la date prévue de règlement ou de nous contacter en cas de difficulté.\n\n"
                f"Cordialement,\n{company_name}"
            )
        else:
            body = (
                f"Bonjour {greeting},\n\n"
                f"Sauf erreur de notre part, la facture {number} d'un montant de {total} reste impayée.\n\n"
                f"Merci de nous indiquer la date prévue de règlement ou de nous contacter en cas de difficulté.\n\n"
                f"Cordialement,\n{company_name}"
            )
    return subject, body


async def build_follow_up_preview(
    db,
    user_id: str,
    *,
    entity_type: str,
    entity_id: str,
    lang: FollowUpLang = "fr",
    company_name: str = "MemoryHub",
) -> dict:
    if entity_type == "quote":
        quote = await _load_quote(db, user_id, entity_id)
        _validate_quote_follow_up(quote)
        client = await _load_client(db, user_id, quote["clientId"])
        greeting = _client_greeting(client, quote.get("clientName", ""))
        subject, message = _build_quote_message(
            lang=lang,
            greeting=greeting,
            number=quote.get("number", ""),
            title=quote.get("title") or "",
            amount_ttc=quote.get("amountTTC", 0),
            company_name=company_name,
        )
        return {
            "entityType": "quote",
            "entityId": quote["id"],
            "clientId": quote["clientId"],
            "clientName": quote.get("clientName", ""),
            "subject": subject,
            "message": message,
            "documentNumber": quote.get("number", ""),
        }

    if entity_type == "invoice":
        invoice = await _load_invoice(db, user_id, entity_id)
        _validate_invoice_follow_up(invoice)
        client = await _load_client(db, user_id, invoice["clientId"])
        greeting = _client_greeting(client, invoice.get("clientName", ""))
        amount_due = compute_amount_due(invoice.get("amountTTC", 0), get_amount_paid(invoice))
        subject, message = _build_invoice_message(
            lang=lang,
            greeting=greeting,
            number=invoice.get("number", ""),
            amount_ttc=invoice.get("amountTTC", 0),
            amount_due=amount_due,
            company_name=company_name,
        )
        return {
            "entityType": "invoice",
            "entityId": invoice["id"],
            "clientId": invoice["clientId"],
            "clientName": invoice.get("clientName", ""),
            "subject": subject,
            "message": message,
            "documentNumber": invoice.get("number", ""),
        }

    raise HTTPException(status_code=400, detail={"message": "Invalid entity type."})


async def record_follow_up(
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
    preview = await build_follow_up_preview(
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
        "channel": "manual",
        "followUpType": entity_type,
        "subject": final_subject,
        "excerpt": excerpt,
        "documentNumber": preview["documentNumber"],
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
        "follow_up_recorded",
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


def _event_to_follow_up(doc: dict) -> FollowUpHistoryItem:
    metadata = doc.get("metadata") or {}
    entity_type = doc.get("entityType")
    if entity_type not in ("quote", "invoice"):
        entity_type = metadata.get("followUpType") or "quote"
    return FollowUpHistoryItem(
        id=doc["id"],
        entityType=entity_type,
        entityId=doc["entityId"],
        clientId=doc.get("clientId") or "",
        clientName=metadata.get("clientName") or "",
        documentNumber=metadata.get("documentNumber")
        or metadata.get("quoteNumber")
        or metadata.get("invoiceNumber")
        or "",
        subject=metadata.get("subject") or "",
        excerpt=metadata.get("excerpt") or "",
        recordedAt=doc.get("createdAt", ""),
    )


async def list_follow_ups(
    db,
    user_id: str,
    *,
    client_id: Optional[str] = None,
    limit: int = 50,
) -> tuple[List[FollowUpHistoryItem], int]:
    query = {"userId": user_id, "type": "follow_up_recorded"}
    if client_id:
        query["clientId"] = client_id
    total = await db.events.count_documents(query)
    cursor = db.events.find(query, {"_id": 0, "userId": 0}).sort("createdAt", -1).limit(limit)
    items = [_event_to_follow_up(doc) async for doc in cursor]
    return items, total


async def get_last_follow_ups_map(
    db,
    user_id: str,
    *,
    entity_type: str,
    entity_ids: List[str],
) -> Dict[str, FollowUpLastItem]:
    if not entity_ids:
        return {}
    query = {
        "userId": user_id,
        "type": "follow_up_recorded",
        "entityType": entity_type,
        "entityId": {"$in": entity_ids},
    }
    pipeline = [
        {"$match": query},
        {"$sort": {"createdAt": -1}},
        {
            "$group": {
                "_id": "$entityId",
                "count": {"$sum": 1},
                "recordedAt": {"$first": "$createdAt"},
                "documentNumber": {"$first": "$metadata.documentNumber"},
                "excerpt": {"$first": "$metadata.excerpt"},
            }
        },
    ]
    result: Dict[str, FollowUpLastItem] = {}
    async for row in db.events.aggregate(pipeline):
        entity_id = row["_id"]
        result[entity_id] = FollowUpLastItem(
            recordedAt=row.get("recordedAt") or "",
            documentNumber=row.get("documentNumber") or "",
            excerpt=row.get("excerpt") or "",
            count=row.get("count") or 1,
        )
    return result
