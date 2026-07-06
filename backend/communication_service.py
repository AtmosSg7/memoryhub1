from typing import List, Optional

from communication_models import (
    CommunicationCategory,
    CommunicationChannel,
    CommunicationListResponse,
    CommunicationPublic,
)

# Event types surfaced in the communications center (extensible via email_messages later).
NOTE_EVENT_TYPES = {"note_created", "note_updated"}
PAYMENT_EVENT_TYPES = {"invoice_paid", "invoice_payment_recorded"}
QUOTE_ACCEPTANCE_EVENT_TYPES = {"quote_accepted"}
FOLLOW_UP_EVENT_TYPES = {"follow_up_recorded"}
DOCUMENT_SEND_EVENT_TYPES = {"document_send_prepared"}
COMMERCIAL_EVENT_TYPES = {"quote_created", "invoice_created", "quote_converted", "quote_updated"}

ALL_COMMUNICATION_EVENT_TYPES = (
    NOTE_EVENT_TYPES
    | PAYMENT_EVENT_TYPES
    | QUOTE_ACCEPTANCE_EVENT_TYPES
    | FOLLOW_UP_EVENT_TYPES
    | DOCUMENT_SEND_EVENT_TYPES
    | COMMERCIAL_EVENT_TYPES
)


def _event_channel(metadata: dict) -> CommunicationChannel:
    if metadata.get("source") == "portal":
        return "portal"
    channel = metadata.get("channel")
    if channel == "email":
        return "email"
    if channel == "manual":
        return "manual"
    return "app"


def _build_title(event_type: str, metadata: dict) -> str:
    if event_type == "document_send_prepared":
        doc = metadata.get("documentNumber") or metadata.get("quoteNumber") or metadata.get("invoiceNumber")
        return doc or "Envoi"
    if event_type == "follow_up_recorded":
        doc = metadata.get("documentNumber") or metadata.get("quoteNumber") or metadata.get("invoiceNumber")
        return doc or "Relance"
    if event_type in NOTE_EVENT_TYPES:
        return metadata.get("noteTitle") or "Note"
    if event_type in PAYMENT_EVENT_TYPES:
        return metadata.get("invoiceNumber") or "Facture"
    if event_type in QUOTE_ACCEPTANCE_EVENT_TYPES:
        return metadata.get("quoteNumber") or "Devis"
    if event_type in FOLLOW_UP_EVENT_TYPES:
        return metadata.get("quoteNumber") or "Devis"
    if event_type == "quote_created":
        return metadata.get("quoteNumber") or "Devis"
    if event_type == "invoice_created":
        return metadata.get("invoiceNumber") or "Facture"
    if event_type == "quote_converted":
        return metadata.get("invoiceNumber") or metadata.get("quoteNumber") or "Conversion"
    return metadata.get("clientName") or "Communication"


def _build_summary(event_type: str, metadata: dict) -> str:
    parts = []
    client = metadata.get("clientName")
    if client:
        parts.append(client)
    if event_type == "document_send_prepared":
        excerpt = metadata.get("excerpt")
        if excerpt:
            parts.append(excerpt[:120])
    elif event_type == "follow_up_recorded":
        excerpt = metadata.get("excerpt")
        if excerpt:
            parts.append(excerpt[:120])
    elif event_type in PAYMENT_EVENT_TYPES:
        if metadata.get("paymentMethod"):
            parts.append(str(metadata["paymentMethod"]))
        if metadata.get("amountDue") is not None:
            parts.append(f"reste {metadata['amountDue']}")
    elif event_type in QUOTE_ACCEPTANCE_EVENT_TYPES:
        title = metadata.get("title")
        if title:
            parts.append(title)
    elif event_type in NOTE_EVENT_TYPES:
        excerpt = metadata.get("excerpt")
        if excerpt:
            parts.append(excerpt[:120])
    elif event_type in FOLLOW_UP_EVENT_TYPES:
        title = metadata.get("title")
        if title:
            parts.append(title)
    else:
        title = metadata.get("title")
        number = metadata.get("quoteNumber") or metadata.get("invoiceNumber")
        if number:
            parts.append(number)
        if title:
            parts.append(title)
    return " · ".join(parts)


def _event_amount(event_type: str, metadata: dict) -> Optional[int]:
    if event_type in PAYMENT_EVENT_TYPES and metadata.get("paymentAmount") is not None:
        return metadata.get("paymentAmount")
    if metadata.get("amountTTC") is not None:
        return metadata.get("amountTTC")
    return None


def _event_category(event_type: str, metadata: dict) -> Optional[CommunicationCategory]:
    if event_type == "document_send_prepared":
        return "document_send"
    if event_type == "follow_up_recorded":
        return "follow_up"
    if event_type in NOTE_EVENT_TYPES:
        return "note"
    if event_type in PAYMENT_EVENT_TYPES:
        return "payment"
    if event_type in QUOTE_ACCEPTANCE_EVENT_TYPES:
        return "quote_acceptance"
    if event_type in FOLLOW_UP_EVENT_TYPES:
        return "follow_up"
    if event_type in COMMERCIAL_EVENT_TYPES:
        return "commercial"
    return None


def event_to_communication(doc: dict) -> Optional[CommunicationPublic]:
    event_type = doc.get("type")
    metadata = doc.get("metadata") or {}
    category = _event_category(event_type, metadata)
    if not category:
        return None

    return CommunicationPublic(
        id=doc["id"],
        category=category,
        channel=_event_channel(metadata),
        clientId=doc.get("clientId"),
        clientName=metadata.get("clientName"),
        title=_build_title(event_type, metadata),
        summary=_build_summary(event_type, metadata),
        amount=_event_amount(event_type, metadata),
        eventType=event_type,
        entityType=doc.get("entityType"),
        entityId=doc.get("entityId"),
        metadata=metadata,
        occurredAt=doc.get("createdAt", ""),
    )


async def load_email_communications(db, user_id: str, client_id: Optional[str] = None) -> List[CommunicationPublic]:
    """Reserved for Gmail/Outlook sync — returns stored outbound emails when integrated."""
    query = {"userId": user_id}
    if client_id:
        query["clientId"] = client_id
    items: List[CommunicationPublic] = []
    async for doc in db.email_messages.find(query, {"_id": 0}).sort("sentAt", -1).limit(100):
        items.append(
            CommunicationPublic(
                id=doc["id"],
                category="email",
                channel="email",
                clientId=doc.get("clientId"),
                clientName=doc.get("clientName"),
                title=doc.get("subject") or "Email",
                summary=doc.get("preview") or doc.get("toEmail") or "",
                eventType=None,
                entityType=None,
                entityId=doc.get("id"),
                metadata={
                    "toEmail": doc.get("toEmail"),
                    "provider": doc.get("provider"),
                    "status": doc.get("status"),
                },
                occurredAt=doc.get("sentAt") or doc.get("createdAt", ""),
            )
        )
    return items


async def list_communications(
    db,
    user_id: str,
    *,
    client_id: Optional[str] = None,
    category: Optional[CommunicationCategory] = None,
    limit: int = 100,
) -> CommunicationListResponse:
    query = {"userId": user_id, "type": {"$in": list(ALL_COMMUNICATION_EVENT_TYPES)}}
    if client_id:
        query["clientId"] = client_id

    cursor = db.events.find(query, {"_id": 0, "userId": 0}).sort("createdAt", -1).limit(limit * 2)
    items: List[CommunicationPublic] = []
    async for doc in cursor:
        comm = event_to_communication(doc)
        if not comm:
            continue
        if category and comm.category != category:
            continue
        items.append(comm)

    email_items = await load_email_communications(db, user_id, client_id)
    for comm in email_items:
        if category and comm.category != category:
            continue
        items.append(comm)

    items.sort(key=lambda item: item.occurredAt or "", reverse=True)
    items = items[:limit]

    total_query = {"userId": user_id, "type": {"$in": list(ALL_COMMUNICATION_EVENT_TYPES)}}
    if client_id:
        total_query["clientId"] = client_id
    total = await db.events.count_documents(total_query) + await db.email_messages.count_documents(
        {"userId": user_id, **({"clientId": client_id} if client_id else {})}
    )

    return CommunicationListResponse(items=items, total=total, emailIntegrationReady=True)
