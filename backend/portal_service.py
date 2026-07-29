import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Request

from commercial_engine import parse_line_items
from invoice_payments import compute_amount_due, get_amount_paid
from invoices import DEFAULT_TITLE as INVOICE_DEFAULT_TITLE, _normalize_status, _resolve_invoice_date
from portal_decision import build_portal_decision_proof, extract_client_request_meta
from portal_models import (
    PortalArtisanPublic,
    PortalCapabilities,
    PortalClientPublic,
    PortalInvoicePublic,
    PortalOverviewResponse,
    PortalQuoteDecisionRequest,
    PortalQuotePublic,
)
from events import record_event
from quotes import DEFAULT_TITLE as QUOTE_DEFAULT_TITLE, _resolve_quote_date
from observability import get_logger
from transactional_email_service import notify_artisan_quote_decision

logger = get_logger(__name__)

PORTAL_VISIBLE_QUOTE_STATUSES = {"sent", "accepted", "rejected", "expired"}
PORTAL_ACCEPTABLE_QUOTE_STATUSES = {"sent"}
PORTAL_REJECTABLE_QUOTE_STATUSES = {"sent"}
PORTAL_HIDDEN_INVOICE_STATUSES = {"cancelled", "draft", "sent"}
PORTAL_LINK_TTL_DAYS = max(0, int(os.environ.get("PORTAL_LINK_TTL_DAYS", "0")))


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate_portal_token() -> str:
    return secrets.token_urlsafe(32)


def build_portal_url(token: str) -> str:
    base = (os.environ.get("PORTAL_BASE_URL") or os.environ.get("FRONTEND_URL") or "").rstrip("/")
    if base:
        return f"{base}/portal/{token}"
    return f"/portal/{token}"


def _portal_expires_at_iso() -> Optional[str]:
    if PORTAL_LINK_TTL_DAYS <= 0:
        return None
    return (datetime.now(timezone.utc) + timedelta(days=PORTAL_LINK_TTL_DAYS)).isoformat()


def _portal_is_expired(portal: dict) -> bool:
    expires_at = portal.get("expiresAt")
    if not expires_at:
        return False
    try:
        exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) > exp_dt
    except ValueError:
        return False


async def get_active_portal(db, token: str) -> dict:
    portal = await db.client_portals.find_one(
        {"token": token, "isActive": True},
        {"_id": 0},
    )
    if not portal or _portal_is_expired(portal):
        raise HTTPException(status_code=404, detail={"message": "Portal link not found or expired."})
    return portal


async def touch_portal_access(db, portal_id: str) -> None:
    await db.client_portals.update_one(
        {"id": portal_id, "isActive": True},
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
    from company_profile_service import get_seller_dict, migrate_profile_from_user

    profile = migrate_profile_from_user(user)
    seller = get_seller_dict(user, profile)
    first = (user.get("firstName") or "").strip()
    last = (user.get("lastName") or "").strip()
    contact = f"{first} {last}".strip() or None
    display = (seller.get("tradeName") or seller.get("legalName") or user.get("companyName") or "MemoryHub").strip()
    return PortalArtisanPublic(
        companyName=display,
        contactName=contact,
    )


def portal_quote_public(doc: dict) -> Optional[PortalQuotePublic]:
    status = doc.get("status", "draft")
    if status not in PORTAL_VISIBLE_QUOTE_STATUSES:
        return None

    decision = doc.get("portalDecision") if isinstance(doc.get("portalDecision"), dict) else {}
    responded_at = doc.get("portalAcceptedAt") or doc.get("portalRejectedAt") or decision.get("at")

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
        canReject=status in PORTAL_REJECTABLE_QUOTE_STATUSES,
        respondedAt=responded_at,
        clientSignerName=decision.get("signerName"),
        clientComment=decision.get("comment"),
    )


def portal_invoice_public(doc: dict) -> Optional[PortalInvoicePublic]:
    status = _normalize_status(doc.get("status"))
    if status in PORTAL_HIDDEN_INVOICE_STATUSES:
        return None
    amount_paid = get_amount_paid(doc)
    amount_ttc = doc.get("amountTTC", 0)
    amount_due = compute_amount_due(amount_ttc, amount_paid)
    return PortalInvoicePublic(
        id=doc["id"],
        number=doc["number"],
        title=doc.get("title") or INVOICE_DEFAULT_TITLE,
        status=status,
        invoiceDate=_resolve_invoice_date(doc),
        amountHT=doc["amountHT"],
        vatRate=doc.get("vatRate", 20),
        amountTTC=amount_ttc,
        amountPaid=amount_paid,
        amountDue=amount_due,
        isPaid=amount_due == 0 and amount_paid > 0,
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
        capabilities=PortalCapabilities(quoteAcceptance=True, quoteRejection=True),
    )


async def _apply_portal_quote_decision(
    db,
    portal: dict,
    quote_id: str,
    *,
    target_status: str,
    accepted: bool,
    payload: PortalQuoteDecisionRequest,
    request: Optional[Request],
) -> PortalQuotePublic:
    doc = await db.quotes.find_one(
        {"userId": portal["userId"], "clientId": portal["clientId"], "id": quote_id},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Quote not found."})

    current_status = doc.get("status", "draft")
    allowed = PORTAL_ACCEPTABLE_QUOTE_STATUSES if accepted else PORTAL_REJECTABLE_QUOTE_STATUSES
    if current_status not in allowed:
        if current_status == "accepted" and accepted:
            raise HTTPException(status_code=409, detail={"message": "This quote has already been accepted.", "code": "quote_already_accepted"})
        if current_status == "rejected" and not accepted:
            raise HTTPException(status_code=409, detail={"message": "This quote has already been declined.", "code": "quote_already_rejected"})
        raise HTTPException(
            status_code=409,
            detail={"message": "This quote can no longer be updated from the portal."},
        )

    signer_name = payload.signerName.strip()
    if not signer_name:
        raise HTTPException(status_code=422, detail={"message": "Signer name is required."})

    now = _utc_now_iso()
    request_meta = extract_client_request_meta(request)
    decision_proof = build_portal_decision_proof(
        action="accepted" if accepted else "rejected",
        at_iso=now,
        signer_name=signer_name,
        comment=payload.comment,
        request_meta=request_meta,
        quote_doc=doc,
    )

    update_fields = {
        "status": target_status,
        "updatedAt": now,
        "portalDecision": decision_proof,
    }
    if accepted:
        update_fields["portalAcceptedAt"] = now
        update_fields["portalRejectedAt"] = None
    else:
        update_fields["portalRejectedAt"] = now

    update_result = await db.quotes.update_one(
        {
            "userId": portal["userId"],
            "clientId": portal["clientId"],
            "id": quote_id,
            "status": "sent",
        },
        {"$set": update_fields},
    )
    if update_result.modified_count == 0:
        raise HTTPException(
            status_code=409,
            detail={"message": "This quote can no longer be updated from the portal."},
        )

    doc.update(update_fields)
    event_type = "quote_accepted" if accepted else "quote_rejected"
    await record_event(
        db,
        portal["userId"],
        event_type,
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
            "signerName": signer_name,
            "comment": decision_proof.get("comment"),
        },
    )

    await notify_artisan_quote_decision(
        db,
        user_id=portal["userId"],
        quote=doc,
        accepted=accepted,
    )

    public = portal_quote_public(doc)
    if not public:
        raise HTTPException(status_code=500, detail={"message": "Failed to update quote."})
    return public


async def accept_portal_quote(
    db,
    portal: dict,
    quote_id: str,
    payload: PortalQuoteDecisionRequest,
    request: Optional[Request] = None,
) -> PortalQuotePublic:
    return await _apply_portal_quote_decision(
        db,
        portal,
        quote_id,
        target_status="accepted",
        accepted=True,
        payload=payload,
        request=request,
    )


async def reject_portal_quote(
    db,
    portal: dict,
    quote_id: str,
    payload: PortalQuoteDecisionRequest,
    request: Optional[Request] = None,
) -> PortalQuotePublic:
    return await _apply_portal_quote_decision(
        db,
        portal,
        quote_id,
        target_status="rejected",
        accepted=False,
        payload=payload,
        request=request,
    )


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
                {
                    "$set": {
                        "token": token,
                        "isActive": True,
                        "updatedAt": now,
                        "expiresAt": _portal_expires_at_iso(),
                    }
                },
            )
            existing["token"] = token
            existing["isActive"] = True
            existing["updatedAt"] = now
            existing["expiresAt"] = _portal_expires_at_iso()
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
        "expiresAt": _portal_expires_at_iso(),
    }
    await db.client_portals.insert_one(portal)
    return portal
