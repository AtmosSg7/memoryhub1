from typing import Dict, List, Literal, Optional

from fastapi import HTTPException

from email_templates import (
    EmailLang,
    build_invoice_follow_up_email,
    build_quote_follow_up_email,
    format_amount,
    resolve_sender_name,
)
from events import record_event
from follow_up_models import FollowUpHistoryItem, FollowUpLastItem
from invoice_payments import compute_amount_due, get_amount_paid
from portal_service import build_portal_url

FollowUpLang = Literal["fr", "en"]


def _normalize_invoice_status(status: Optional[str]) -> str:
    if not status or status in ("draft", "sent"):
        return "in_progress"
    if status in ("in_progress", "paid", "overdue", "cancelled"):
        return status
    return "in_progress"


def _format_amount(cents: int, lang: FollowUpLang) -> str:
    return format_amount(cents, lang)


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


async def _load_portal_url(db, user_id: str, client_id: str) -> Optional[str]:
    portal = await db.client_portals.find_one(
        {"userId": user_id, "clientId": client_id, "isActive": True},
        {"_id": 0, "token": 1},
    )
    if not portal:
        return None
    return build_portal_url(portal["token"])


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


def _resolve_sender(
    company_name: str,
    lang: EmailLang,
    *,
    first_name: str = "",
    last_name: str = "",
) -> str:
    return resolve_sender_name(company_name, lang, first_name=first_name, last_name=last_name)


async def build_follow_up_preview(
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
    sender = _resolve_sender(
        company_name,
        lang,
        first_name=sender_first_name,
        last_name=sender_last_name,
    )

    if entity_type == "quote":
        quote = await _load_quote(db, user_id, entity_id)
        _validate_quote_follow_up(quote)
        client = await _load_client(db, user_id, quote["clientId"])
        portal_url = await _load_portal_url(db, user_id, quote["clientId"])
        greeting = _client_greeting(client, quote.get("clientName", ""))
        email = build_quote_follow_up_email(
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
            "subject": email.subject,
            "preheader": email.preheader,
            "message": email.body,
            "documentNumber": quote.get("number", ""),
            "portalUrl": portal_url,
        }

    if entity_type == "invoice":
        invoice = await _load_invoice(db, user_id, entity_id)
        _validate_invoice_follow_up(invoice)
        client = await _load_client(db, user_id, invoice["clientId"])
        greeting = _client_greeting(client, invoice.get("clientName", ""))
        amount_due = compute_amount_due(invoice.get("amountTTC", 0), get_amount_paid(invoice))
        email = build_invoice_follow_up_email(
            lang=lang,
            greeting=greeting,
            number=invoice.get("number", ""),
            amount_ttc=invoice.get("amountTTC", 0),
            amount_due=amount_due,
            sender_name=sender,
        )
        return {
            "entityType": "invoice",
            "entityId": invoice["id"],
            "clientId": invoice["clientId"],
            "clientName": invoice.get("clientName", ""),
            "subject": email.subject,
            "preheader": email.preheader,
            "message": email.body,
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
    company_name: str = "",
    sender_first_name: str = "",
    sender_last_name: str = "",
) -> dict:
    preview = await build_follow_up_preview(
        db,
        user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        lang=lang,
        company_name=company_name,
        sender_first_name=sender_first_name,
        sender_last_name=sender_last_name,
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
