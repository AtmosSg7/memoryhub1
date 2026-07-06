import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from commercial_engine import parse_line_items
from invoices import DEFAULT_TITLE as INVOICE_DEFAULT_TITLE, _normalize_status, _resolve_invoice_date
from portal_models import (
    PortalArtisanPublic,
    PortalCapabilities,
    PortalClientPublic,
    PortalInvoicePublic,
    PortalOverviewResponse,
    PortalQuotePublic,
)
from events import record_event
from quotes import DEFAULT_TITLE as QUOTE_DEFAULT_TITLE, _resolve_quote_date

PORTAL_VISIBLE_QUOTE_STATUSES = {"sent", "accepted", "rejected", "expired"}
PORTAL_ACCEPTABLE_QUOTE_STATUSES = {"sent"}
PORTAL_HIDDEN_INVOICE_STATUSES = {"cancelled", "draft", "sent"}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate_portal_token() -> str:
    return secrets.token_urlsafe(32)


def build_portal_url(token: str) -> str:
    base = (os.environ.get("PORTAL_BASE_URL") or os.environ.get("FRONTEND_URL") or "").rstrip("/")
    if base:
        return f"{base}/portal/{token}"
    return f"/portal/{token}"


async def get_active_portal(db, token: str) -> dict:
    portal = await db.client_portals.find_one(
        {"token": token, "isActive": True},
        {"_id": 0},
    )
    if not portal:
        raise HTTPException(status_code=404, detail={"message": "Portal link not found or expired."})
    return portal


async def touch_portal_access(db, portal_id: str) -> None:
    await db.client_portals.update_one(
        {"id": portal_id},
        {"$set": {"lastAccessedAt": _utc_now_iso()}},
    )


def portal_client_public(client: dict) -> PortalClientPublic:
    return PortalClientPublic(
        name=client["name"],
        contactName=client.get("contactName"),
        email=client.get("email"),
        phone=client.get("phone"),
        company=client.get("company"),
        address=client.get("address"),
        city=client.get("city"),
    )


def portal_artisan_public(user: dict) -> PortalArtisanPublic:
    first = (user.get("firstName") or "").strip()
    last = (user.get("lastName") or "").strip()
    contact = f"{first} {last}".strip() or None
    return PortalArtisanPublic(
        companyName=user.get("companyName") or "MemoryHub",
        contactName=contact,
    )


def portal_quote_public(doc: dict) -> Optional[PortalQuotePublic]:
    status = doc.get("status", "draft")
    if status not in PORTAL_VISIBLE_QUOTE_STATUSES:
        return None
    return PortalQuotePublic(
        id=doc["id"],
        number=doc["number"],
        title=doc.get("title") or QUOTE_DEFAULT_TITLE,
        status=status,
        quoteDate=_resolve_quote_date(doc),
        amountHT=doc["amountHT"],
        vatRate=doc.get("vatRate", 20),
        amountTTC=doc["amountTTC"],
        lineItems=parse_line_items(doc.get("lineItems")) or None,
        invoiceNumber=doc.get("invoiceNumber"),
        canAccept=status in PORTAL_ACCEPTABLE_QUOTE_STATUSES,
    )


def portal_invoice_public(doc: dict) -> Optional[PortalInvoicePublic]:
    status = _normalize_status(doc.get("status"))
    if status in PORTAL_HIDDEN_INVOICE_STATUSES:
        return None
    return PortalInvoicePublic(
        id=doc["id"],
        number=doc["number"],
        title=doc.get("title") or INVOICE_DEFAULT_TITLE,
        status=status,
        invoiceDate=_resolve_invoice_date(doc),
        amountHT=doc["amountHT"],
        vatRate=doc.get("vatRate", 20),
        amountTTC=doc["amountTTC"],
        lineItems=parse_line_items(doc.get("lineItems")) or None,
        quoteNumber=doc.get("quoteNumber"),
        paidAt=doc.get("paidAt"),
    )


async def load_portal_overview(db, portal: dict) -> PortalOverviewResponse:
    user_id = portal["userId"]
    client_id = portal["clientId"]

    client = await db.clients.find_one(
        {"userId": user_id, "id": client_id},
        {"_id": 0, "userId": 0, "notes": 0, "status": 0},
    )
    if not client:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})

    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "passwordHash": 0, "emailVerificationToken": 0, "passwordResetToken": 0, "passwordResetExpires": 0},
    )
    if not user:
        raise HTTPException(status_code=404, detail={"message": "Portal not available."})

    quote_docs = await db.quotes.find(
        {"userId": user_id, "clientId": client_id},
        {"_id": 0, "userId": 0, "internalNotes": 0},
    ).sort("quoteDate", -1).to_list(500)

    invoice_docs = await db.invoices.find(
        {"userId": user_id, "clientId": client_id},
        {"_id": 0, "userId": 0, "internalNotes": 0},
    ).sort("invoiceDate", -1).to_list(500)

    quotes = [item for doc in quote_docs if (item := portal_quote_public(doc))]
    invoices = [item for doc in invoice_docs if (item := portal_invoice_public(doc))]

    return PortalOverviewResponse(
        client=portal_client_public(client),
        artisan=portal_artisan_public(user),
        quotes=quotes,
        invoices=invoices,
        capabilities=PortalCapabilities(quoteAcceptance=True),
    )


async def accept_portal_quote(db, portal: dict, quote_id: str) -> PortalQuotePublic:
    doc = await db.quotes.find_one(
        {"userId": portal["userId"], "clientId": portal["clientId"], "id": quote_id},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Quote not found."})

    status = doc.get("status", "draft")
    if status not in PORTAL_ACCEPTABLE_QUOTE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail={"message": "This quote can no longer be accepted."},
        )

    now = _utc_now_iso()
    update_result = await db.quotes.update_one(
        {
            "userId": portal["userId"],
            "clientId": portal["clientId"],
            "id": quote_id,
            "status": "sent",
        },
        {
            "$set": {
                "status": "accepted",
                "updatedAt": now,
                "portalAcceptedAt": now,
            }
        },
    )
    if update_result.modified_count == 0:
        raise HTTPException(
            status_code=409,
            detail={"message": "This quote can no longer be accepted."},
        )

    doc["status"] = "accepted"
    doc["updatedAt"] = now
    doc["portalAcceptedAt"] = now

    await record_event(
        db,
        portal["userId"],
        "quote_accepted",
        "quote",
        quote_id,
        client_id=portal["clientId"],
        metadata={
            "quoteNumber": doc["number"],
            "title": doc.get("title") or QUOTE_DEFAULT_TITLE,
            "amountTTC": doc.get("amountTTC", 0),
            "clientName": doc.get("clientName"),
            "source": "portal",
            "portalId": portal["id"],
        },
    )

    public = portal_quote_public(doc)
    if not public:
        raise HTTPException(status_code=500, detail={"message": "Failed to accept quote."})
    return public


async def get_portal_quote_for_pdf(db, portal: dict, quote_id: str) -> dict:
    doc = await db.quotes.find_one(
        {"userId": portal["userId"], "clientId": portal["clientId"], "id": quote_id},
        {"_id": 0},
    )
    if not doc or doc.get("status") not in PORTAL_VISIBLE_QUOTE_STATUSES:
        raise HTTPException(status_code=404, detail={"message": "Quote not found."})
    return doc


async def get_portal_invoice_for_pdf(db, portal: dict, invoice_id: str) -> dict:
    doc = await db.invoices.find_one(
        {"userId": portal["userId"], "clientId": portal["clientId"], "id": invoice_id},
        {"_id": 0},
    )
    if not doc or _normalize_status(doc.get("status")) in PORTAL_HIDDEN_INVOICE_STATUSES:
        raise HTTPException(status_code=404, detail={"message": "Invoice not found."})
    return doc


def public_pdf_payload(public_model) -> dict:
    data = public_model.model_dump()
    data["internalNotes"] = None
    return data


async def ensure_client_portal(db, user_id: str, client_id: str) -> dict:
    client = await db.clients.find_one({"userId": user_id, "id": client_id}, {"_id": 0, "id": 1})
    if not client:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})

    existing = await db.client_portals.find_one(
        {"userId": user_id, "clientId": client_id},
        {"_id": 0},
    )
    now = _utc_now_iso()
    if existing:
        if not existing.get("isActive"):
            token = generate_portal_token()
            await db.client_portals.update_one(
                {"id": existing["id"]},
                {"$set": {"token": token, "isActive": True, "updatedAt": now}},
            )
            existing["token"] = token
            existing["isActive"] = True
            existing["updatedAt"] = now
        return existing

    portal = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "clientId": client_id,
        "token": generate_portal_token(),
        "isActive": True,
        "createdAt": now,
        "updatedAt": now,
        "lastAccessedAt": None,
    }
    await db.client_portals.insert_one(portal)
    return portal
