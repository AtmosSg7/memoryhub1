import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo import ReturnDocument

from auth import get_current_user, get_db
from catalog_indexer import index_catalog_line_items
from commercial_engine import (
    compute_global_totals,
    load_import_analysis_line_items,
    parse_line_items,
    resolve_document_amounts,
    resolve_import_document_amounts,
    serialize_line_items,
)
from commercial_models import CommercialLineItem
from events import record_event
from invoices import InvoicePublic, insert_invoice_document, invoice_public
from pdf_documents import build_quote_pdf
from quote_invoice_link import refresh_quote_invoice_link, refresh_quotes_invoice_links

quotes_router = APIRouter(prefix="/quotes", tags=["quotes"])

QuoteStatus = Literal["draft", "sent", "accepted", "rejected", "expired"]
VALID_STATUSES = {"draft", "sent", "accepted", "rejected", "expired"}
DEFAULT_VAT_RATE = 20
DEFAULT_TITLE = "Devis sans titre"

QUOTE_PROJECTION = {"_id": 0, "userId": 0}


class QuoteCreate(BaseModel):
    clientId: str = Field(..., min_length=1)
    title: Optional[str] = Field(None, max_length=200)
    status: QuoteStatus = "draft"
    quoteDate: Optional[str] = None
    amountHT: int = Field(default=0, ge=0)
    vatRate: int = Field(default=DEFAULT_VAT_RATE, ge=0, le=100)
    internalNotes: Optional[str] = Field(None, max_length=5000)
    lineItems: Optional[List[CommercialLineItem]] = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return value.strip() or None


class QuoteUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    clientId: Optional[str] = Field(None, min_length=1)
    title: Optional[str] = Field(None, max_length=200)
    status: Optional[QuoteStatus] = None
    quoteDate: Optional[str] = None
    amountHT: Optional[int] = Field(None, ge=0)
    vatRate: Optional[int] = Field(None, ge=0, le=100)
    internalNotes: Optional[str] = Field(None, max_length=5000)
    lineItems: Optional[List[CommercialLineItem]] = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return value.strip() or None


class QuotePublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    number: str
    clientId: str
    clientName: str
    title: str
    status: QuoteStatus
    quoteDate: str
    amountHT: int
    vatRate: int
    amountTTC: int
    internalNotes: Optional[str] = None
    lineItems: Optional[List[CommercialLineItem]] = None
    invoiceId: Optional[str] = None
    invoiceNumber: Optional[str] = None
    createdAt: str
    updatedAt: str


class QuoteListResponse(BaseModel):
    items: List[QuotePublic]
    total: int


def _user_filter(user_id: str) -> dict:
    return {"userId": user_id}


def _compute_amount_ttc(amount_ht: int, vat_rate: int) -> int:
    return compute_global_totals(amount_ht, vat_rate).amountTTC


def _resolve_title(title: Optional[str]) -> str:
    if title and title.strip():
        return title.strip()
    return DEFAULT_TITLE


def _parse_quote_date(value: Optional[str], fallback: str) -> str:
    if not value or not str(value).strip():
        return fallback
    try:
        normalized = str(value).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except ValueError:
        return fallback


def _resolve_quote_date(doc: dict) -> str:
    return doc.get("quoteDate") or doc.get("createdAt", "")


async def _next_quote_number(db, user_id: str) -> str:
    year = datetime.now(timezone.utc).year
    key = f"quotes:{user_id}:{year}"
    result = await db.counters.find_one_and_update(
        {"_id": key},
        {"$inc": {"seq": 1}, "$setOnInsert": {"userId": user_id, "year": year}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    seq = result["seq"]
    return f"DEV-{year}-{seq:04d}"


async def _resolve_client(db, user_id: str, client_id: str):
    client = await db.clients.find_one(
        {**_user_filter(user_id), "id": client_id},
        {"_id": 0, "company": 1, "name": 1},
    )
    if not client:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})
    client_name = (client.get("company") or "").strip() or client.get("name")
    return client_id, client_name


def _quote_event_metadata(doc: dict) -> dict:
    metadata = {
        "quoteNumber": doc["number"],
        "title": doc.get("title") or DEFAULT_TITLE,
        "status": doc.get("status", "draft"),
        "amountTTC": doc.get("amountTTC", 0),
        "quoteDate": _resolve_quote_date(doc),
        "clientName": doc.get("clientName"),
    }
    return metadata


def quote_public(doc: dict) -> QuotePublic:
    return QuotePublic(
        id=doc["id"],
        number=doc["number"],
        clientId=doc["clientId"],
        clientName=doc.get("clientName", ""),
        title=doc.get("title") or DEFAULT_TITLE,
        status=doc.get("status", "draft"),
        quoteDate=_resolve_quote_date(doc),
        amountHT=doc["amountHT"],
        vatRate=doc.get("vatRate", DEFAULT_VAT_RATE),
        amountTTC=doc["amountTTC"],
        internalNotes=doc.get("internalNotes"),
        lineItems=parse_line_items(doc.get("lineItems")) or None,
        invoiceId=doc.get("invoiceId"),
        invoiceNumber=doc.get("invoiceNumber"),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    )


async def insert_quote_document(
    db,
    user_id: str,
    *,
    client_id: str,
    client_name: str,
    title: str,
    amount_ht: int,
    vat_rate: int,
    quote_date: Optional[str] = None,
    status: str = "draft",
    internal_notes: Optional[str] = None,
    external_number: Optional[str] = None,
    source_document_id: Optional[str] = None,
    import_session_id: Optional[str] = None,
    line_items: Optional[List[CommercialLineItem]] = None,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    parsed_date = _parse_quote_date(quote_date, now)

    resolved_vat_rate = vat_rate
    resolved_line_items: Optional[List[CommercialLineItem]] = None

    if import_session_id:
        raw_analysis_lines = await load_import_analysis_line_items(db, user_id, import_session_id)
        amounts = resolve_import_document_amounts(
            raw_analysis_lines,
            fallback_amount_ht=amount_ht,
            fallback_vat_rate=resolved_vat_rate,
        )
        resolved_line_items = amounts.lineItems
        resolved_amount_ht = amounts.totals.amountHT
        resolved_vat_rate = amounts.totals.vatRate
        amount_ttc = amounts.totals.amountTTC
    elif line_items:
        amounts = resolve_document_amounts(
            line_items,
            fallback_amount_ht=amount_ht,
            fallback_vat_rate=resolved_vat_rate,
        )
        resolved_line_items = amounts.lineItems
        resolved_amount_ht = amounts.totals.amountHT
        resolved_vat_rate = amounts.totals.vatRate
        amount_ttc = amounts.totals.amountTTC
    else:
        totals = compute_global_totals(amount_ht, resolved_vat_rate)
        resolved_amount_ht = totals.amountHT
        resolved_vat_rate = totals.vatRate
        amount_ttc = totals.amountTTC

    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "number": await _next_quote_number(db, user_id),
        "clientId": client_id,
        "clientName": client_name,
        "title": _resolve_title(title),
        "status": status if status in VALID_STATUSES else "draft",
        "quoteDate": parsed_date,
        "amountHT": resolved_amount_ht,
        "vatRate": resolved_vat_rate,
        "amountTTC": amount_ttc,
        "internalNotes": internal_notes,
        "createdAt": now,
        "updatedAt": now,
    }
    if resolved_line_items:
        doc["lineItems"] = serialize_line_items(resolved_line_items)
    if external_number:
        doc["externalNumber"] = external_number
    if source_document_id:
        doc["sourceDocumentId"] = source_document_id
    if import_session_id:
        doc["importSessionId"] = import_session_id

    await db.quotes.insert_one(doc)
    metadata = _quote_event_metadata(doc)
    if import_session_id:
        metadata["importSessionId"] = import_session_id
        metadata["source"] = "import"
    await record_event(
        db,
        user_id,
        "quote_created",
        "quote",
        doc["id"],
        client_id=client_id,
        metadata=metadata,
    )
    if resolved_line_items:
        await index_catalog_line_items(db, user_id, resolved_line_items)
    return doc


@quotes_router.post("", response_model=QuotePublic, status_code=201)
async def create_quote(
    body: QuoteCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    user_id = current_user["id"]
    client_id, client_name = await _resolve_client(db, user_id, body.clientId)
    amounts = resolve_document_amounts(
        body.lineItems,
        fallback_amount_ht=body.amountHT,
        fallback_vat_rate=body.vatRate,
    )
    if amounts.totals.amountHT <= 0:
        raise HTTPException(status_code=422, detail={"message": "amountHT is required."})
    doc = await insert_quote_document(
        db,
        user_id,
        client_id=client_id,
        client_name=client_name,
        title=body.title or DEFAULT_TITLE,
        amount_ht=amounts.totals.amountHT,
        vat_rate=amounts.totals.vatRate,
        quote_date=body.quoteDate,
        status=body.status,
        internal_notes=body.internalNotes,
        line_items=amounts.lineItems,
    )
    return quote_public(doc)


@quotes_router.get("", response_model=QuoteListResponse)
async def list_quotes(
    clientId: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    query = _user_filter(current_user["id"])

    if clientId:
        client = await db.clients.find_one(
            {**_user_filter(current_user["id"]), "id": clientId},
            {"_id": 1},
        )
        if not client:
            return QuoteListResponse(items=[], total=0)
        query["clientId"] = clientId

    if status:
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=422, detail={"message": "Invalid status."})
        query["status"] = status

    total = await db.quotes.count_documents(query)
    cursor = db.quotes.aggregate([
        {"$match": query},
        {"$addFields": {"_sortDate": {"$ifNull": ["$quoteDate", "$createdAt"]}}},
        {"$sort": {"_sortDate": -1}},
        {"$project": {"_id": 0, "userId": 0, "_sortDate": 0}},
    ])
    raw_items = [doc async for doc in cursor]
    refreshed = await refresh_quotes_invoice_links(db, current_user["id"], raw_items)
    items = [quote_public(doc) for doc in refreshed]
    return QuoteListResponse(items=items, total=total)


@quotes_router.get("/{quote_id}", response_model=QuotePublic)
async def get_quote(
    quote_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    doc = await db.quotes.find_one(
        {**_user_filter(current_user["id"]), "id": quote_id},
        QUOTE_PROJECTION,
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Quote not found."})
    doc = await refresh_quote_invoice_link(db, current_user["id"], doc)
    return quote_public(doc)


@quotes_router.get("/{quote_id}/pdf")
async def download_quote_pdf(
    quote_id: str,
    lang: Optional[str] = Query("fr"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    doc = await db.quotes.find_one(
        {**_user_filter(current_user["id"]), "id": quote_id},
        QUOTE_PROJECTION,
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Quote not found."})
    public = quote_public(doc)
    pdf_bytes = build_quote_pdf(public.model_dump(), lang=lang if lang in ("fr", "en") else "fr")
    filename = f'{doc["number"]}.pdf'
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@quotes_router.put("/{quote_id}", response_model=QuotePublic)
async def update_quote(
    quote_id: str,
    body: QuoteUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    existing = await db.quotes.find_one(
        {**_user_filter(current_user["id"]), "id": quote_id},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail={"message": "Quote not found."})

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return quote_public(existing)

    if "clientId" in updates:
        client_id, client_name = await _resolve_client(
            db, current_user["id"], updates["clientId"]
        )
        updates["clientId"] = client_id
        updates["clientName"] = client_name

    if "title" in updates:
        updates["title"] = _resolve_title(updates["title"])

    if "quoteDate" in updates:
        updates["quoteDate"] = _parse_quote_date(
            updates["quoteDate"], _resolve_quote_date(existing)
        )

    line_items_update = body.lineItems if "lineItems" in updates else None
    indexed_line_items = None
    if "lineItems" in updates:
        del updates["lineItems"]
    merged = {**existing, **updates}

    if line_items_update is not None:
        amounts = resolve_document_amounts(
            line_items_update,
            fallback_amount_ht=merged.get("amountHT", 0),
            fallback_vat_rate=merged.get("vatRate", DEFAULT_VAT_RATE),
        )
        indexed_line_items = amounts.lineItems
        merged["amountHT"] = amounts.totals.amountHT
        merged["vatRate"] = amounts.totals.vatRate
        merged["amountTTC"] = amounts.totals.amountTTC
        if amounts.lineItems:
            merged["lineItems"] = serialize_line_items(amounts.lineItems)
        else:
            merged.pop("lineItems", None)
    else:
        amount_ht = merged["amountHT"]
        vat_rate = merged.get("vatRate", DEFAULT_VAT_RATE)
        totals = compute_global_totals(amount_ht, vat_rate)
        merged["amountHT"] = totals.amountHT
        merged["vatRate"] = totals.vatRate
        merged["amountTTC"] = totals.amountTTC

    merged["updatedAt"] = datetime.now(timezone.utc).isoformat()

    set_fields = {
        k: merged[k]
        for k in merged
        if k not in ("id", "userId", "createdAt", "number")
    }
    unset_fields = {}
    if line_items_update is not None and not merged.get("lineItems"):
        unset_fields["lineItems"] = ""

    update_doc: dict = {"$set": set_fields}
    if unset_fields:
        update_doc["$unset"] = unset_fields

    await db.quotes.update_one(
        {"userId": current_user["id"], "id": quote_id},
        update_doc,
    )

    await record_event(
        db,
        current_user["id"],
        "quote_updated",
        "quote",
        quote_id,
        client_id=merged.get("clientId"),
        metadata=_quote_event_metadata(merged),
    )

    if indexed_line_items:
        await index_catalog_line_items(db, current_user["id"], indexed_line_items)

    public_doc = {k: v for k, v in merged.items() if k not in ("userId", "_id")}
    return quote_public(public_doc)


def _build_conversion_notes(quote: dict) -> str:
    base = (quote.get("internalNotes") or "").strip()
    marker = f"Converti depuis le devis {quote['number']}."
    if base:
        return f"{base}\n\n{marker}"
    return marker


@quotes_router.post("/{quote_id}/convert-to-invoice", response_model=InvoicePublic, status_code=201)
async def convert_quote_to_invoice(
    quote_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    user_id = current_user["id"]
    quote = await db.quotes.find_one(
        {**_user_filter(user_id), "id": quote_id},
        {"_id": 0},
    )
    if not quote:
        raise HTTPException(status_code=404, detail={"message": "Quote not found."})

    quote = await refresh_quote_invoice_link(db, user_id, quote)

    if quote.get("status") != "accepted":
        raise HTTPException(
            status_code=422,
            detail={"message": "Seuls les devis acceptés peuvent être convertis en facture."},
        )

    if quote.get("invoiceId"):
        raise HTTPException(
            status_code=409,
            detail={"message": "Ce devis a déjà été converti en facture."},
        )

    quote_line_items = parse_line_items(quote.get("lineItems"))

    invoice_doc = await insert_invoice_document(
        db,
        user_id,
        client_id=quote["clientId"],
        client_name=quote.get("clientName", ""),
        title=quote.get("title") or DEFAULT_TITLE,
        amount_ht=quote["amountHT"],
        vat_rate=quote.get("vatRate", DEFAULT_VAT_RATE),
        invoice_date=_resolve_quote_date(quote),
        internal_notes=_build_conversion_notes(quote),
        quote_id=quote["id"],
        quote_number=quote["number"],
        line_items=quote_line_items or None,
    )

    now = datetime.now(timezone.utc).isoformat()
    await db.quotes.update_one(
        {"userId": user_id, "id": quote_id},
        {
            "$set": {
                "invoiceId": invoice_doc["id"],
                "invoiceNumber": invoice_doc["number"],
                "updatedAt": now,
            }
        },
    )

    await record_event(
        db,
        user_id,
        "quote_converted",
        "quote",
        quote_id,
        client_id=quote.get("clientId"),
        metadata={
            **_quote_event_metadata(quote),
            "invoiceId": invoice_doc["id"],
            "invoiceNumber": invoice_doc["number"],
        },
    )

    return invoice_public(invoice_doc)


@quotes_router.delete("/{quote_id}", status_code=204)
async def delete_quote(
    quote_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    existing = await db.quotes.find_one(
        {**_user_filter(current_user["id"]), "id": quote_id},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail={"message": "Quote not found."})

    result = await db.quotes.delete_one(
        {**_user_filter(current_user["id"]), "id": quote_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail={"message": "Quote not found."})

    await record_event(
        db,
        current_user["id"],
        "quote_deleted",
        "quote",
        quote_id,
        client_id=existing.get("clientId"),
        metadata=_quote_event_metadata(existing),
    )
