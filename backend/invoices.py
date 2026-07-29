import uuid

from datetime import datetime, timezone

from typing import Any, Dict, List, Literal, Optional



from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from pydantic import BaseModel, ConfigDict, Field, field_validator

from pymongo import ReturnDocument



from auth import get_current_user, get_db
from security_config import MAX_LIST_ITEMS

from catalog_indexer import index_catalog_line_items, index_catalog_line_items_from_raw

from commercial_engine import (
    compute_global_totals,
    load_import_analysis_line_items,
    parse_line_items,
    resolve_document_amounts,
    resolve_import_document_amounts,
    serialize_line_items,
)

from commercial_models import CommercialLineItem

from commercial_lifecycle import (
    active_document_filter,
    archive_invoice,
    lifecycle_fields_for_invoice,
)

from events import record_event
from analytics import invalidate_user
from observability import log_event
from invoice_payments import (
    InvoicePaymentCreate,
    InvoicePaymentRecord,
    build_full_payment_update,
    build_payment_update,
    build_reopen_payment_update,
    compute_amount_due,
    get_amount_paid,
    parse_payment_records,
)

from commercial_status import DEFAULT_EXPORT_STATUS, derive_lifecycle_status, normalize_export_status

from quote_invoice_link import clear_invoice_quote_links



invoices_router = APIRouter(prefix="/invoices", tags=["invoices"])



InvoiceStatus = Literal["in_progress", "paid", "overdue", "cancelled"]
InvoiceDisplayStatus = Literal[
    "issued", "viewed", "partial", "paid", "overdue", "cancelled", "archived",
]

VALID_STATUSES = {"in_progress", "paid", "overdue", "cancelled"}

LEGACY_STATUSES = {"draft", "sent"}

INPUT_STATUSES = VALID_STATUSES | LEGACY_STATUSES

DEFAULT_STATUS = "in_progress"

DEFAULT_VAT_RATE = 20

DEFAULT_TITLE = "Facture sans titre"



INVOICE_PROJECTION = {"_id": 0, "userId": 0}





class InvoiceCreate(BaseModel):

    clientId: str = Field(..., min_length=1)

    title: Optional[str] = Field(None, max_length=200)

    status: InvoiceStatus = DEFAULT_STATUS

    invoiceDate: Optional[str] = None

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



    @field_validator("status", mode="before")

    @classmethod

    def coerce_status(cls, value):

        if value is None:

            return DEFAULT_STATUS

        if value not in INPUT_STATUSES:

            raise ValueError("Invalid status.")

        if value in LEGACY_STATUSES:

            return DEFAULT_STATUS

        return value





class InvoiceUpdate(BaseModel):

    model_config = ConfigDict(extra="ignore")



    clientId: Optional[str] = Field(None, min_length=1)

    title: Optional[str] = Field(None, max_length=200)

    status: Optional[InvoiceStatus] = None

    invoiceDate: Optional[str] = None

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



    @field_validator("status", mode="before")

    @classmethod

    def coerce_status(cls, value):

        if value is None:

            return value

        if value not in INPUT_STATUSES:

            raise ValueError("Invalid status.")

        if value in LEGACY_STATUSES:

            return DEFAULT_STATUS

        return value





class InvoicePublic(BaseModel):

    model_config = ConfigDict(extra="ignore")



    id: str

    number: str

    clientId: str

    clientName: str

    title: str

    status: InvoiceStatus

    invoiceDate: str

    amountHT: int

    vatRate: int

    amountTTC: int

    internalNotes: Optional[str] = None

    lineItems: Optional[List[CommercialLineItem]] = None

    quoteId: Optional[str] = None

    quoteNumber: Optional[str] = None

    paidAt: Optional[str] = None

    amountPaid: int = 0

    amountDue: int = 0

    payments: Optional[List[InvoicePaymentRecord]] = None

    exportStatus: str = DEFAULT_EXPORT_STATUS
    exportValidatedAt: Optional[str] = None
    exportReadyAt: Optional[str] = None
    exportExportedAt: Optional[str] = None
    lifecycleStatus: Optional[str] = None

    displayStatus: InvoiceDisplayStatus = "issued"
    issuedAt: Optional[str] = None
    sentAt: Optional[str] = None
    portalFirstViewedAt: Optional[str] = None
    portalLastViewedAt: Optional[str] = None
    portalViewCount: int = 0
    isArchived: bool = False
    archivedAt: Optional[str] = None

    createdAt: str

    updatedAt: str





class InvoiceListResponse(BaseModel):

    items: List[InvoicePublic]

    total: int





def _user_filter(user_id: str) -> dict:

    return {"userId": user_id}


def _normalize_status(status: Optional[str]) -> str:
    if not status or status in LEGACY_STATUSES:
        return DEFAULT_STATUS
    if status in VALID_STATUSES:
        return status
    return DEFAULT_STATUS


def _status_query(status: str) -> dict:
    normalized = _normalize_status(status)
    if normalized == DEFAULT_STATUS:
        return {"status": {"$in": ["in_progress", "draft", "sent"]}}
    return {"status": normalized}


def _validate_input_status(status: str) -> None:
    if status not in INPUT_STATUSES:
        raise HTTPException(status_code=422, detail={"message": "Invalid status."})


def _compute_amount_ttc(amount_ht: int, vat_rate: int) -> int:

    return compute_global_totals(amount_ht, vat_rate).amountTTC





def _resolve_title(title: Optional[str]) -> str:

    if title and title.strip():

        return title.strip()

    return DEFAULT_TITLE





def _parse_invoice_date(value: Optional[str], fallback: str) -> str:

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





def _resolve_invoice_date(doc: dict) -> str:

    return doc.get("invoiceDate") or doc.get("createdAt", "")





async def _next_invoice_number(db, user_id: str) -> str:

    from company_profile_service import get_document_prefixes

    year = datetime.now(timezone.utc).year

    prefixes = await get_document_prefixes(db, user_id)

    prefix = prefixes["invoicePrefix"]

    key = f"invoices:{user_id}:{year}"

    result = await db.counters.find_one_and_update(

        {"_id": key},

        {"$inc": {"seq": 1}, "$setOnInsert": {"userId": user_id, "year": year}},

        upsert=True,

        return_document=ReturnDocument.AFTER,

    )

    seq = result["seq"]

    return f"{prefix}-{year}-{seq:04d}"





async def _resolve_client(db, user_id: str, client_id: str):

    client = await db.clients.find_one(

        {**_user_filter(user_id), "id": client_id},

        {"_id": 0, "company": 1, "name": 1},

    )

    if not client:

        raise HTTPException(status_code=404, detail={"message": "Client not found."})

    client_name = (client.get("company") or "").strip() or client.get("name")

    return client_id, client_name





def _invoice_event_metadata(doc: dict) -> dict:

    return {

        "invoiceNumber": doc["number"],

        "title": doc.get("title") or DEFAULT_TITLE,

        "status": _normalize_status(doc.get("status")),

        "amountTTC": doc.get("amountTTC", 0),

        "invoiceDate": _resolve_invoice_date(doc),

        "clientName": doc.get("clientName"),

        "paidAt": doc.get("paidAt"),

        "amountPaid": get_amount_paid(doc),

        "amountDue": compute_amount_due(doc.get("amountTTC", 0), get_amount_paid(doc)),

    }





def invoice_public(doc: dict) -> InvoicePublic:

    amount_paid = get_amount_paid(doc)

    amount_ttc = doc.get("amountTTC", 0)
    lifecycle = lifecycle_fields_for_invoice(doc)

    return InvoicePublic(

        id=doc["id"],

        number=doc["number"],

        clientId=doc["clientId"],

        clientName=doc.get("clientName", ""),

        title=doc.get("title") or DEFAULT_TITLE,

        status=_normalize_status(doc.get("status")),

        invoiceDate=_resolve_invoice_date(doc),

        amountHT=doc["amountHT"],

        vatRate=doc.get("vatRate", DEFAULT_VAT_RATE),

        amountTTC=amount_ttc,

        internalNotes=doc.get("internalNotes"),

        lineItems=parse_line_items(doc.get("lineItems")) or None,

        quoteId=doc.get("quoteId"),

        quoteNumber=doc.get("quoteNumber"),

        paidAt=doc.get("paidAt"),

        amountPaid=amount_paid,

        amountDue=compute_amount_due(amount_ttc, amount_paid),

        payments=parse_payment_records(doc.get("payments")) or None,

        exportStatus=normalize_export_status(doc.get("exportStatus")),
        exportValidatedAt=doc.get("exportValidatedAt"),
        exportReadyAt=doc.get("exportReadyAt"),
        exportExportedAt=doc.get("exportExportedAt"),
        lifecycleStatus=derive_lifecycle_status(
            export_status=normalize_export_status(doc.get("exportStatus")),
            payment_status=_normalize_status(doc.get("status")),
        ),

        **lifecycle,

        createdAt=doc["createdAt"],

        updatedAt=doc["updatedAt"],

    )





async def insert_invoice_document(
    db,
    user_id: str,
    *,
    client_id: str,
    client_name: str,
    title: str,
    amount_ht: int,
    vat_rate: int,
    invoice_date: Optional[str] = None,
    status: str = DEFAULT_STATUS,
    internal_notes: Optional[str] = None,
    quote_id: Optional[str] = None,
    quote_number: Optional[str] = None,
    external_number: Optional[str] = None,
    source_document_id: Optional[str] = None,
    import_session_id: Optional[str] = None,
    line_items: Optional[List[CommercialLineItem]] = None,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    parsed_date = _parse_invoice_date(invoice_date, now)

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
        "number": await _next_invoice_number(db, user_id),
        "clientId": client_id,
        "clientName": client_name,
        "title": _resolve_title(title),
        "status": _normalize_status(status),
        "invoiceDate": parsed_date,
        "amountHT": resolved_amount_ht,
        "vatRate": resolved_vat_rate,
        "amountTTC": amount_ttc,
        "internalNotes": internal_notes,
        "quoteId": quote_id,
        "quoteNumber": quote_number,
        "exportStatus": DEFAULT_EXPORT_STATUS,
        "issuedAt": now,
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
    await db.invoices.insert_one(doc)
    metadata = {
        **_invoice_event_metadata(doc),
        "quoteId": quote_id,
        "quoteNumber": quote_number,
    }
    if import_session_id:
        metadata["importSessionId"] = import_session_id
        metadata["source"] = "import"
    await record_event(
        db,
        user_id,
        "invoice_created",
        "invoice",
        doc["id"],
        client_id=client_id,
        metadata=metadata,
    )
    await record_event(
        db,
        user_id,
        "invoice_issued",
        "invoice",
        doc["id"],
        client_id=client_id,
        metadata={
            "invoiceNumber": doc["number"],
            "clientName": client_name,
            "amountTTC": doc.get("amountTTC", 0),
        },
    )
    if doc.get("lineItems"):
        await index_catalog_line_items_from_raw(db, user_id, doc["lineItems"])
    return doc





@invoices_router.post("", response_model=InvoicePublic, status_code=201)

async def create_invoice(

    body: InvoiceCreate,

    current_user: dict = Depends(get_current_user),

    db=Depends(get_db),

):

    user_id = current_user["id"]

    client_id, client_name = await _resolve_client(db, user_id, body.clientId)
    from company_profile_service import get_default_vat_rate

    default_vat = await get_default_vat_rate(db, user_id)
    amounts = resolve_document_amounts(
        body.lineItems,
        fallback_amount_ht=body.amountHT,
        fallback_vat_rate=default_vat,
    )
    if amounts.totals.amountHT <= 0:
        raise HTTPException(status_code=422, detail={"message": "amountHT is required."})

    doc = await insert_invoice_document(
        db,
        user_id,
        client_id=client_id,
        client_name=client_name,
        title=body.title or DEFAULT_TITLE,
        amount_ht=amounts.totals.amountHT,
        vat_rate=amounts.totals.vatRate,
        invoice_date=body.invoiceDate,
        status=body.status,
        internal_notes=body.internalNotes,
        line_items=amounts.lineItems,
    )

    invalidate_user(current_user["id"])
    return invoice_public(doc)





@invoices_router.get("", response_model=InvoiceListResponse)
async def list_invoices(
    clientId: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    timezone: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    from commercial_list_filters import period_aggregation_stages

    query = {**_user_filter(current_user["id"]), **active_document_filter()}

    if clientId:
        client = await db.clients.find_one(
            {**_user_filter(current_user["id"]), "id": clientId},
            {"_id": 1},
        )
        if not client:
            return InvoiceListResponse(items=[], total=0)
        query["clientId"] = clientId

    if status:
        _validate_input_status(status)
        query.update(_status_query(status))

    period_stages = period_aggregation_stages(
        kind="invoice",
        status=status,
        from_date=from_date,
        to_date=to_date,
        timezone_name=timezone,
    )
    pipeline = [
        {"$match": query},
        *period_stages,
        {"$addFields": {"_sortDate": {"$ifNull": ["$_filterDate", "$createdAt"]}}},
        {"$sort": {"_sortDate": -1}},
        {
            "$facet": {
                "items": [
                    {"$limit": MAX_LIST_ITEMS},
                    {"$project": {"_id": 0, "userId": 0, "_sortDate": 0, "_filterDate": 0}},
                ],
                "total": [{"$count": "count"}],
            }
        },
    ]
    facet = await db.invoices.aggregate(pipeline).to_list(1)
    bucket = facet[0] if facet else {"items": [], "total": []}
    total = int((bucket.get("total") or [{"count": 0}])[0].get("count", 0))
    items = [invoice_public(doc) for doc in (bucket.get("items") or [])]
    return InvoiceListResponse(items=items, total=total)





@invoices_router.get("/{invoice_id}", response_model=InvoicePublic)

async def get_invoice(

    invoice_id: str,

    current_user: dict = Depends(get_current_user),

    db=Depends(get_db),

):

    doc = await db.invoices.find_one(

        {**_user_filter(current_user["id"]), "id": invoice_id},

        INVOICE_PROJECTION,

    )

    if not doc:

        raise HTTPException(status_code=404, detail={"message": "Invoice not found."})

    return invoice_public(doc)





@invoices_router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: str,
    lang: Optional[str] = Query("fr"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    doc = await db.invoices.find_one(
        {**_user_filter(current_user["id"]), "id": invoice_id},
        INVOICE_PROJECTION,
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Invoice not found."})
    from document_export.models import ExportFormat
    from document_export.service import export_commercial_document

    result = await export_commercial_document(
        db,
        user_id=current_user["id"],
        document_type="invoice",
        document_id=invoice_id,
        fmt=ExportFormat.PDF,
        lang=lang if lang in ("fr", "en") else "fr",
    )
    return Response(
        content=result.data,
        media_type=result.contentType,
        headers={"Content-Disposition": f'attachment; filename="{result.filename}"'},
    )





@invoices_router.put("/{invoice_id}", response_model=InvoicePublic)

async def update_invoice(

    invoice_id: str,

    body: InvoiceUpdate,

    current_user: dict = Depends(get_current_user),

    db=Depends(get_db),

):

    existing = await db.invoices.find_one(

        {**_user_filter(current_user["id"]), "id": invoice_id},

        {"_id": 0},

    )

    if not existing:

        raise HTTPException(status_code=404, detail={"message": "Invoice not found."})



    updates = body.model_dump(exclude_unset=True)

    if not updates:

        return invoice_public(existing)



    if updates.get("status") == "paid":

        raise HTTPException(

            status_code=422,

            detail={

                "message": "Utilisez l'enregistrement de paiement pour marquer une facture comme payée.",

            },

        )



    if "clientId" in updates:

        client_id, client_name = await _resolve_client(

            db, current_user["id"], updates["clientId"]

        )

        updates["clientId"] = client_id

        updates["clientName"] = client_name



    if "title" in updates:

        updates["title"] = _resolve_title(updates["title"])



    if "invoiceDate" in updates:

        updates["invoiceDate"] = _parse_invoice_date(

            updates["invoiceDate"], _resolve_invoice_date(existing)

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

    await db.invoices.update_one(

        {"userId": current_user["id"], "id": invoice_id},

        update_doc,

    )



    await record_event(

        db,

        current_user["id"],

        "invoice_updated",

        "invoice",

        invoice_id,

        client_id=merged.get("clientId"),

        metadata=_invoice_event_metadata(merged),

    )

    if indexed_line_items:
        await index_catalog_line_items(db, current_user["id"], indexed_line_items)
    elif merged.get("lineItems"):
        await index_catalog_line_items_from_raw(db, current_user["id"], merged["lineItems"])

    public_doc = {k: v for k, v in merged.items() if k not in ("userId", "_id")}

    invalidate_user(current_user["id"])
    return invoice_public(public_doc)





PAYABLE_STATUSES = {"in_progress", "overdue"}


async def _get_invoice_doc(db, user_id: str, invoice_id: str) -> dict:
    doc = await db.invoices.find_one(
        {**_user_filter(user_id), "id": invoice_id},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Invoice not found."})
    return doc


@invoices_router.post("/{invoice_id}/mark-paid", response_model=InvoicePublic)
async def mark_invoice_paid(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    user_id = current_user["id"]
    existing = await _get_invoice_doc(db, user_id, invoice_id)
    status = _normalize_status(existing.get("status"))
    if status not in PAYABLE_STATUSES:
        raise HTTPException(
            status_code=422,
            detail={"message": "Only in-progress or overdue invoices can be marked as paid."},
        )

    try:
        payment_result = build_full_payment_update(existing)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"message": str(exc)}) from exc

    update_fields = payment_result["update"]
    mongo_update: dict = {"$set": update_fields}
    if update_fields.get("status") != "paid":
        mongo_update["$unset"] = {"paidAt": ""}
    await db.invoices.update_one({"userId": user_id, "id": invoice_id}, mongo_update)
    merged = {**existing, **update_fields}
    if update_fields.get("status") != "paid":
        merged.pop("paidAt", None)
    await record_event(
        db,
        user_id,
        "invoice_paid",
        "invoice",
        invoice_id,
        client_id=merged.get("clientId"),
        metadata=_invoice_event_metadata(merged),
    )
    invalidate_user(user_id)
    log_event("invoice.mark_paid", user_id=user_id, result="ok")
    return invoice_public(merged)


@invoices_router.post("/{invoice_id}/payments", response_model=InvoicePublic)
async def record_invoice_payment(
    invoice_id: str,
    body: InvoicePaymentCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    user_id = current_user["id"]
    existing = await _get_invoice_doc(db, user_id, invoice_id)
    status = _normalize_status(existing.get("status"))
    if status not in PAYABLE_STATUSES:
        raise HTTPException(
            status_code=422,
            detail={"message": "Only in-progress or overdue invoices accept a payment."},
        )

    try:
        payment_result = build_payment_update(
            existing,
            amount=body.amount,
            paid_at=body.paidAt,
            method=body.method,
            note=body.note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"message": str(exc)}) from exc

    update_fields = payment_result["update"]
    mongo_update: dict = {"$set": update_fields}
    if update_fields.get("status") != "paid":
        mongo_update["$unset"] = {"paidAt": ""}
    await db.invoices.update_one({"userId": user_id, "id": invoice_id}, mongo_update)
    merged = {**existing, **update_fields}
    if update_fields.get("status") != "paid":
        merged.pop("paidAt", None)
    record = payment_result["record"]
    metadata = {
        **_invoice_event_metadata(merged),
        "paymentAmount": record.amount,
        "paymentMethod": record.method,
        "paymentDate": record.paidAt,
        "amountDue": payment_result["amountDue"],
    }
    await record_event(
        db,
        user_id,
        "invoice_payment_recorded",
        "invoice",
        invoice_id,
        client_id=merged.get("clientId"),
        metadata=metadata,
    )
    if payment_result["isFullyPaid"]:
        await record_event(
            db,
            user_id,
            "invoice_paid",
            "invoice",
            invoice_id,
            client_id=merged.get("clientId"),
            metadata=_invoice_event_metadata(merged),
        )

    try:
        client = await db.clients.find_one(
            {"userId": user_id, "id": merged.get("clientId")},
            {"_id": 0, "email": 1, "name": 1, "contactName": 1},
        )
        if client and client.get("email"):
            from follow_up_service import _client_greeting, _load_portal_url
            from transactional_email_service import resolve_artisan_locale, send_payment_recorded_email

            portal_url = await _load_portal_url(db, user_id, merged.get("clientId"))
            artisan_lang = await resolve_artisan_locale(db, user_id)
            profile = await db.users.find_one(
                {"id": user_id},
                {"_id": 0, "companyName": 1, "firstName": 1, "lastName": 1},
            )
            from email_templates import resolve_sender_name

            sender = resolve_sender_name(
                (profile or {}).get("companyName"),
                artisan_lang,
                first_name=(profile or {}).get("firstName") or "",
                last_name=(profile or {}).get("lastName") or "",
            )
            greeting = _client_greeting(client, merged.get("clientName", ""))
            await send_payment_recorded_email(
                db,
                user_id=user_id,
                to=client["email"],
                greeting=greeting,
                number=merged.get("number", ""),
                amount=record.amount,
                amount_due=payment_result["amountDue"],
                invoice_id=invoice_id,
                portal_url=portal_url,
                locale=artisan_lang,
                idempotency_key=f"payment-recorded:{invoice_id}:{record.id}",
            )
    except Exception:
        pass

    invalidate_user(user_id)
    return invoice_public(merged)


@invoices_router.post("/{invoice_id}/mark-in-progress", response_model=InvoicePublic)
async def mark_invoice_in_progress(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    user_id = current_user["id"]
    existing = await _get_invoice_doc(db, user_id, invoice_id)
    status = _normalize_status(existing.get("status"))
    amount_paid = get_amount_paid(existing)
    if status == "cancelled":
        raise HTTPException(status_code=422, detail={"message": "This invoice is cancelled."})
    if status != "paid" and amount_paid <= 0:
        raise HTTPException(
            status_code=422,
            detail={"message": "Only paid or partially paid invoices can be reopened."},
        )

    update_fields = build_reopen_payment_update(existing)
    merged = {**existing, **update_fields}
    await db.invoices.update_one(
        {"userId": user_id, "id": invoice_id},
        {
            "$set": {
                "status": update_fields["status"],
                "amountPaid": update_fields["amountPaid"],
                "payments": update_fields["payments"],
                "updatedAt": update_fields["updatedAt"],
            },
            "$unset": {"paidAt": ""},
        },
    )
    await record_event(
        db,
        user_id,
        "invoice_reopened",
        "invoice",
        invoice_id,
        client_id=merged.get("clientId"),
        metadata=_invoice_event_metadata(merged),
    )
    return invoice_public(merged)


@invoices_router.post("/{invoice_id}/archive", response_model=InvoicePublic)
async def archive_invoice_endpoint(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    doc = await archive_invoice(db, current_user["id"], invoice_id)
    return invoice_public(doc)


@invoices_router.delete("/{invoice_id}", status_code=204)

async def delete_invoice(

    invoice_id: str,

    current_user: dict = Depends(get_current_user),

    db=Depends(get_db),

):

    existing = await db.invoices.find_one(

        {**_user_filter(current_user["id"]), "id": invoice_id},

        {"_id": 0},

    )

    if not existing:

        raise HTTPException(status_code=404, detail={"message": "Invoice not found."})



    result = await db.invoices.delete_one(

        {**_user_filter(current_user["id"]), "id": invoice_id}

    )

    if result.deleted_count == 0:

        raise HTTPException(status_code=404, detail={"message": "Invoice not found."})

    invalidate_user(current_user["id"])



    await clear_invoice_quote_links(
        db,
        current_user["id"],
        invoice_id,
        existing.get("quoteId"),
    )



    await record_event(

        db,

        current_user["id"],

        "invoice_deleted",

        "invoice",

        invoice_id,

        client_id=existing.get("clientId"),

        metadata=_invoice_event_metadata(existing),

    )


