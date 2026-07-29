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
QUOTE_ACCEPTANCE_EVENT_TYPES = {"quote_accepted", "quote_rejected"}
FOLLOW_UP_EVENT_TYPES = {"follow_up_recorded"}
DOCUMENT_SEND_EVENT_TYPES = {"document_send_prepared"}
QUOTE_LIFECYCLE_EVENT_TYPES = {
    "quote_sent",
    "quote_viewed",
    "quote_expired",
    "quote_archived",
    "invoice_issued",
    "invoice_sent",
    "invoice_viewed",
    "invoice_archived",
}
COMMERCIAL_EVENT_TYPES = {
    "quote_created",
    "invoice_created",
    "quote_converted",
    "quote_updated",
    *QUOTE_LIFECYCLE_EVENT_TYPES,
}

ALL_COMMUNICATION_EVENT_TYPES = (
    NOTE_EVENT_TYPES
    | PAYMENT_EVENT_TYPES
    | QUOTE_ACCEPTANCE_EVENT_TYPES
    | FOLLOW_UP_EVENT_TYPES
    | DOCUMENT_SEND_EVENT_TYPES
    | COMMERCIAL_EVENT_TYPES
)

# Email activity is read from Communication Center (db.communications), not events —
# avoids duplicate rows after Gmail dual-write.
EMAIL_EVENT_TYPES = {"email_sent", "email_received"}


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
    if event_type == "quote_sent":
        return metadata.get("quoteNumber") or "Devis envoyé"
    if event_type == "quote_viewed":
        return metadata.get("quoteNumber") or "Devis consulté"
    if event_type == "quote_expired":
        return metadata.get("quoteNumber") or "Devis expiré"
    if event_type == "quote_archived":
        return metadata.get("quoteNumber") or "Devis archivé"
    if event_type == "invoice_issued":
        return metadata.get("invoiceNumber") or "Facture émise"
    if event_type == "invoice_sent":
        return metadata.get("invoiceNumber") or "Facture envoyée"
    if event_type == "invoice_viewed":
        return metadata.get("invoiceNumber") or "Facture consultée"
    if event_type == "invoice_archived":
        return metadata.get("invoiceNumber") or "Facture archivée"
    if event_type == "email_sent":
        return metadata.get("subject") or "E-mail envoyé"
    if event_type == "email_received":
        return metadata.get("subject") or "E-mail reçu"
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
    if event_type in {"email_sent", "email_received"}:
        return "email"
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
    """Load emails from Communication Center (canonical layer)."""
    from communication_center import list_center_communications

    center = await list_center_communications(
        db, user_id, client_id=client_id, type_filter="email", limit=100
    )
    items: List[CommunicationPublic] = []
    for row in center.items:
        direction = row.direction or "inbound"
        items.append(
            CommunicationPublic(
                id=row.id,
                category="email",
                channel="email",
                clientId=row.clientId,
                clientName=row.clientName,
                title=row.subject or "Email",
                summary=row.preview or "",
                eventType="email_sent" if direction == "outbound" else "email_received",
                entityType="email",
                entityId=row.id,
                metadata={
                    **(row.metadata or {}),
                    "provider": row.provider,
                    "direction": direction,
                    "gmailUrl": row.externalUrl,
                    "attachmentsCount": row.attachmentsCount,
                    "channel": "email",
                },
                occurredAt=row.createdAt,
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
    seen_ids = set()
    async for doc in cursor:
        # Skip legacy email events — Center is source of truth for email
        if doc.get("type") in EMAIL_EVENT_TYPES:
            continue
        comm = event_to_communication(doc)
        if not comm:
            continue
        if category and comm.category != category:
            continue
        items.append(comm)
        seen_ids.add(comm.id)

    if category in (None, "email"):
        email_items = await load_email_communications(db, user_id, client_id)
        for comm in email_items:
            if category and comm.category != category:
                continue
            if comm.id in seen_ids:
                continue
            items.append(comm)
            seen_ids.add(comm.id)

    items.sort(key=lambda item: item.occurredAt or "", reverse=True)
    items = items[:limit]

    total_query = {"userId": user_id, "type": {"$in": list(ALL_COMMUNICATION_EVENT_TYPES)}}
    if client_id:
        total_query["clientId"] = client_id
    from communication_center import list_center_communications

    center_total = (
        await list_center_communications(
            db, user_id, client_id=client_id, type_filter="email" if category == "email" else None, limit=1
        )
    ).total
    if category == "email":
        total = center_total
    else:
        total = await db.events.count_documents(total_query) + (
            center_total if category is None else 0
        )

    return CommunicationListResponse(items=items, total=total, emailIntegrationReady=True)
