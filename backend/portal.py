from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.responses import Response

from auth import get_current_user, get_db
from invoices import invoice_public
from pdf_documents import build_invoice_pdf, build_quote_pdf
from portal_models import PortalAccessPublic, PortalOverviewResponse, PortalQuoteAcceptResponse
from portal_service import (
    accept_portal_quote,
    build_portal_url,
    ensure_client_portal,
    get_active_portal,
    get_portal_invoice_for_pdf,
    get_portal_quote_for_pdf,
    load_portal_overview,
    public_pdf_payload,
    touch_portal_access,
)
from quotes import quote_public

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
async def get_portal_overview(token: str, db=Depends(get_db)):
    portal = await get_active_portal(db, token)
    overview = await load_portal_overview(db, portal)
    await touch_portal_access(db, portal["id"])
    return overview


@portal_router.post("/{token}/quotes/{quote_id}/accept", response_model=PortalQuoteAcceptResponse)
async def accept_quote_from_portal(token: str, quote_id: str, db=Depends(get_db)):
    portal = await get_active_portal(db, token)
    quote = await accept_portal_quote(db, portal, quote_id)
    await touch_portal_access(db, portal["id"])
    return PortalQuoteAcceptResponse(quote=quote)


@portal_router.get("/{token}/quotes/{quote_id}/pdf")
async def download_portal_quote_pdf(
    token: str,
    quote_id: str,
    lang: Optional[str] = Query("fr"),
    db=Depends(get_db),
):
    portal = await get_active_portal(db, token)
    doc = await get_portal_quote_for_pdf(db, portal, quote_id)
    public = quote_public(doc)
    pdf_bytes = build_quote_pdf(
        public_pdf_payload(public),
        lang=lang if lang in ("fr", "en") else "fr",
    )
    await touch_portal_access(db, portal["id"])
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{doc["number"]}.pdf"'},
    )


@portal_router.get("/{token}/invoices/{invoice_id}/pdf")
async def download_portal_invoice_pdf(
    token: str,
    invoice_id: str,
    lang: Optional[str] = Query("fr"),
    db=Depends(get_db),
):
    portal = await get_active_portal(db, token)
    doc = await get_portal_invoice_for_pdf(db, portal, invoice_id)
    public = invoice_public(doc)
    pdf_bytes = build_invoice_pdf(
        public_pdf_payload(public),
        lang=lang if lang in ("fr", "en") else "fr",
    )
    await touch_portal_access(db, portal["id"])
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{doc["number"]}.pdf"'},
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
