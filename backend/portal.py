from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from starlette.responses import Response

from auth import get_current_user, get_db
from portal_models import (
    PortalAccessPublic,
    PortalOverviewResponse,
    PortalQuoteAcceptResponse,
    PortalQuoteDecisionRequest,
    PortalQuoteRejectResponse,
    PortalShareEmailRequest,
    PortalShareEmailResponse,
)
from portal_service import (
    accept_portal_quote,
    build_portal_url,
    ensure_client_portal,
    get_active_portal,
    get_portal_invoice_for_pdf,
    get_portal_quote_for_pdf,
    load_portal_overview,
    reject_portal_quote,
    touch_portal_access,
)
from rate_limit import rate_limit

portal_rate_limit = rate_limit(max_requests=60, window_seconds=60)
portal_share_rate_limit = rate_limit(max_requests=10, window_seconds=3600, key_suffix=":share")

portal_router = APIRouter(prefix="/portal", tags=["portal"])
portal_admin_router = APIRouter(prefix="/clients", tags=["portal"])


def portal_access_public(portal: dict) -> PortalAccessPublic:
    token = portal["token"]
    return PortalAccessPublic(
        clientId=portal["clientId"],
        token=token,
        portalUrl=build_portal_url(token),
        isActive=bool(portal.get("isActive")),
        createdAt=portal["createdAt"],
        updatedAt=portal["updatedAt"],
        lastAccessedAt=portal.get("lastAccessedAt"),
    )


@portal_router.get("/{token}", response_model=PortalOverviewResponse)
async def get_portal_overview(token: str, db=Depends(get_db), _rate=Depends(portal_rate_limit)):
    portal = await get_active_portal(db, token)
    overview = await load_portal_overview(db, portal)
    await touch_portal_access(db, portal["id"])
    return overview


@portal_router.post("/{token}/quotes/{quote_id}/accept", response_model=PortalQuoteAcceptResponse)
async def accept_quote_from_portal(
    token: str,
    quote_id: str,
    body: PortalQuoteDecisionRequest,
    request: Request,
    db=Depends(get_db),
    _rate=Depends(portal_rate_limit),
):
    portal = await get_active_portal(db, token)
    quote = await accept_portal_quote(db, portal, quote_id, body, request)
    await touch_portal_access(db, portal["id"])
    return PortalQuoteAcceptResponse(quote=quote)


@portal_router.post("/{token}/quotes/{quote_id}/reject", response_model=PortalQuoteRejectResponse)
async def reject_quote_from_portal(
    token: str,
    quote_id: str,
    body: PortalQuoteDecisionRequest,
    request: Request,
    db=Depends(get_db),
    _rate=Depends(portal_rate_limit),
):
    portal = await get_active_portal(db, token)
    quote = await reject_portal_quote(db, portal, quote_id, body, request)
    await touch_portal_access(db, portal["id"])
    return PortalQuoteRejectResponse(quote=quote)


@portal_router.get("/{token}/quotes/{quote_id}/pdf")
async def download_portal_quote_pdf(
    token: str,
    quote_id: str,
    lang: Optional[str] = Query("fr"),
    db=Depends(get_db),
    _rate=Depends(portal_rate_limit),
):
    portal = await get_active_portal(db, token)
    doc = await get_portal_quote_for_pdf(db, portal, quote_id)
    from commercial_lifecycle import record_portal_document_view

    await record_portal_document_view(db, portal, document_type="quote", document_id=quote_id)
    from document_export.models import ExportFormat
    from document_export.service import export_commercial_document

    result = await export_commercial_document(
        db,
        user_id=portal["userId"],
        document_type="quote",
        document_id=quote_id,
        fmt=ExportFormat.PDF,
        lang=lang if lang in ("fr", "en") else "fr",
        strip_internal_notes=True,
    )
    await touch_portal_access(db, portal["id"])
    return Response(
        content=result.data,
        media_type=result.contentType,
        headers={
            "Content-Disposition": f'attachment; filename="{result.filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@portal_router.get("/{token}/invoices/{invoice_id}/pdf")
async def download_portal_invoice_pdf(
    token: str,
    invoice_id: str,
    lang: Optional[str] = Query("fr"),
    db=Depends(get_db),
    _rate=Depends(portal_rate_limit),
):
    portal = await get_active_portal(db, token)
    doc = await get_portal_invoice_for_pdf(db, portal, invoice_id)
    from commercial_lifecycle import record_portal_document_view

    await record_portal_document_view(db, portal, document_type="invoice", document_id=invoice_id)
    from document_export.models import ExportFormat
    from document_export.service import export_commercial_document

    result = await export_commercial_document(
        db,
        user_id=portal["userId"],
        document_type="invoice",
        document_id=invoice_id,
        fmt=ExportFormat.PDF,
        lang=lang if lang in ("fr", "en") else "fr",
        strip_internal_notes=True,
    )
    await touch_portal_access(db, portal["id"])
    return Response(
        content=result.data,
        media_type=result.contentType,
        headers={
            "Content-Disposition": f'attachment; filename="{result.filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@portal_admin_router.get("/{client_id}/portal", response_model=PortalAccessPublic)
async def get_client_portal(
    client_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    portal = await db.client_portals.find_one(
        {"userId": current_user["id"], "clientId": client_id, "isActive": True},
        {"_id": 0},
    )
    if not portal:
        raise HTTPException(status_code=404, detail={"message": "Portal not enabled for this client."})
    return portal_access_public(portal)


@portal_admin_router.post("/{client_id}/portal", response_model=PortalAccessPublic, status_code=201)
async def enable_client_portal(
    client_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    portal = await ensure_client_portal(db, current_user["id"], client_id)
    return portal_access_public(portal)


@portal_admin_router.post("/{client_id}/portal/share-email", response_model=PortalShareEmailResponse)
async def share_client_portal_email(
    client_id: str,
    body: PortalShareEmailRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(portal_share_rate_limit),
):
    from email_utils import normalize_email
    from follow_up_service import _client_greeting, _load_client
    from email_templates import resolve_sender_name
    from transactional_email_service import send_portal_access_email

    portal = await ensure_client_portal(db, current_user["id"], client_id)
    client = await _load_client(db, current_user["id"], client_id)
    to = body.recipientEmail or client.get("email")
    if not to:
        raise HTTPException(status_code=422, detail={"message": "Client has no email address."})
    try:
        to = normalize_email(to)
    except Exception:
        raise HTTPException(status_code=422, detail={"message": "Invalid client email address."})

    profile = await db.users.find_one(
        {"id": current_user["id"]},
        {"_id": 0, "companyName": 1, "firstName": 1, "lastName": 1},
    )
    lang = body.lang if body.lang in ("fr", "en") else "fr"
    sender = resolve_sender_name(
        (profile or {}).get("companyName"),
        lang,
        first_name=(profile or {}).get("firstName") or "",
        last_name=(profile or {}).get("lastName") or "",
    )
    greeting = _client_greeting(client, client.get("name", ""))
    portal_url = build_portal_url(portal["token"])
    key = body.idempotencyKey or f"portal-share:{client_id}:{to}"

    delivery = await send_portal_access_email(
        db,
        user_id=current_user["id"],
        to=to,
        greeting=greeting,
        sender_name=sender,
        portal_url=portal_url,
        locale=lang,
        client_id=client_id,
        idempotency_key=key,
    )
    return PortalShareEmailResponse(
        emailStatus=delivery.status,
        emailDelivered=delivery.delivered,
        emailEventId=delivery.event_id,
        portalUrl=portal_url,
    )


@portal_admin_router.delete("/{client_id}/portal", status_code=204)
async def disable_client_portal(
    client_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    from datetime import datetime, timezone

    result = await db.client_portals.update_one(
        {"userId": current_user["id"], "clientId": client_id, "isActive": True},
        {"$set": {"isActive": False, "updatedAt": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail={"message": "Portal not enabled for this client."})
