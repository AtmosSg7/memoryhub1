import re
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict

from auth import get_current_user, get_db

search_router = APIRouter(prefix="/search", tags=["search"])

MIN_QUERY_LEN = 3
MAX_QUERY_LEN = 100
RESULT_LIMIT = 10

SEARCH_PROJECTION = {"_id": 0, "userId": 0}

CLIENT_SEARCH_FIELDS = [
    "name",
    "company",
    "contactName",
    "email",
    "phone",
    "activity",
    "city",
    "notes",
]
NOTE_SEARCH_FIELDS = ["title", "content", "clientName", "type"]
DOCUMENT_SEARCH_FIELDS = ["name", "clientName", "extension"]
QUOTE_SEARCH_FIELDS = ["number", "title", "clientName", "internalNotes"]
INVOICE_SEARCH_FIELDS = ["number", "title", "clientName", "internalNotes", "status"]


class SearchResultItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    type: Literal["client", "note", "document", "quote", "invoice"]
    title: str
    subtitle: Optional[str] = None
    clientId: Optional[str] = None
    clientName: Optional[str] = None
    url: str
    createdAt: str
    updatedAt: str
    matchPreview: Optional[str] = None


class SearchGroup(BaseModel):
    total: int
    items: List[SearchResultItem]


class SearchGroups(BaseModel):
    clients: SearchGroup
    notes: SearchGroup
    documents: SearchGroup
    quotes: SearchGroup
    invoices: SearchGroup


class SearchResponse(BaseModel):
    query: str
    total: int
    groups: SearchGroups


def _user_filter(user_id: str) -> dict:
    return {"userId": user_id}


def _regex_pattern(query: str) -> dict:
    return {"$regex": re.escape(query), "$options": "i"}


def _build_or_filter(fields: list[str], pattern: dict) -> list[dict]:
    return [{field: pattern} for field in fields]


def _client_url(client_id: str) -> str:
    return f"/dashboard/clients/{client_id}"


def _note_url(client_id: Optional[str]) -> str:
    if client_id:
        return f"/dashboard/clients/{client_id}?section=notes"
    return "/dashboard/notes"


def _document_url(client_id: Optional[str]) -> str:
    if client_id:
        return f"/dashboard/clients/{client_id}?section=documents"
    return "/dashboard/documents"


def _quote_url(client_id: Optional[str]) -> str:
    if client_id:
        return f"/dashboard/clients/{client_id}?section=quotes"
    return "/dashboard/quotes"


def _invoice_url(client_id: Optional[str]) -> str:
    if client_id:
        return f"/dashboard/clients/{client_id}?section=invoices"
    return "/dashboard/invoices"


def _match_preview(content: str, query: str, max_len: int = 120) -> str:
    if not content:
        return ""
    lowered = content.lower()
    q_lower = query.lower()
    idx = lowered.find(q_lower)
    if idx == -1:
        preview = content[:max_len]
    else:
        start = max(0, idx - 30)
        end = min(len(content), start + max_len)
        preview = content[start:end]
        if start > 0:
            preview = "…" + preview
        if end < len(content):
            preview = preview + "…"
    return preview.strip()


def _client_display_name(doc: dict) -> str:
    company = (doc.get("company") or "").strip()
    if company:
        return company
    return doc.get("name", "")


def _client_subtitle(doc: dict) -> Optional[str]:
    parts = []
    name = (doc.get("name") or "").strip()
    company = (doc.get("company") or "").strip()
    if name and name != company:
        parts.append(name)
    contact = (doc.get("contactName") or "").strip()
    if contact:
        parts.append(contact)
    city = (doc.get("city") or "").strip()
    if city:
        parts.append(city)
    if parts:
        return " · ".join(parts)
    return doc.get("email") or doc.get("phone")


def _client_to_result(doc: dict) -> SearchResultItem:
    display = _client_display_name(doc)
    return SearchResultItem(
        id=doc["id"],
        type="client",
        title=display,
        subtitle=_client_subtitle(doc),
        clientId=doc["id"],
        clientName=display,
        url=_client_url(doc["id"]),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    )


def _note_to_result(doc: dict, query: str) -> SearchResultItem:
    client_id = doc.get("clientId")
    return SearchResultItem(
        id=doc["id"],
        type="note",
        title=doc.get("title") or "Note sans titre",
        subtitle=doc.get("clientName") or doc.get("type"),
        clientId=client_id,
        clientName=doc.get("clientName"),
        url=_note_url(client_id),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
        matchPreview=_match_preview(doc.get("content", ""), query),
    )


def _document_to_result(doc: dict) -> SearchResultItem:
    client_id = doc.get("clientId")
    ext = (doc.get("extension") or "").upper()
    return SearchResultItem(
        id=doc["id"],
        type="document",
        title=doc["name"],
        subtitle=doc.get("clientName") or (ext if ext else None),
        clientId=client_id,
        clientName=doc.get("clientName"),
        url=_document_url(client_id),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    )


def _quote_to_result(doc: dict, query: str) -> SearchResultItem:
    client_id = doc.get("clientId")
    return SearchResultItem(
        id=doc["id"],
        type="quote",
        title=f"{doc['number']} — {doc.get('title') or 'Devis'}",
        subtitle=doc.get("clientName"),
        clientId=client_id,
        clientName=doc.get("clientName"),
        url=_quote_url(client_id),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
        matchPreview=_match_preview(doc.get("internalNotes") or "", query),
    )


def _invoice_to_result(doc: dict, query: str) -> SearchResultItem:
    client_id = doc.get("clientId")
    return SearchResultItem(
        id=doc["id"],
        type="invoice",
        title=f"{doc['number']} — {doc.get('title') or 'Facture'}",
        subtitle=doc.get("clientName"),
        clientId=client_id,
        clientName=doc.get("clientName"),
        url=_invoice_url(client_id),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
        matchPreview=_match_preview(doc.get("internalNotes") or "", query),
    )


async def _search_collection(db, collection, fields, base_filter, pattern, to_result):
    query = {**base_filter, "$or": _build_or_filter(fields, pattern)}
    total = await db[collection].count_documents(query)
    cursor = (
        db[collection]
        .find(query, SEARCH_PROJECTION)
        .sort("updatedAt", -1)
        .limit(RESULT_LIMIT)
    )
    items = [to_result(doc) async for doc in cursor]
    return total, items


@search_router.get("", response_model=SearchResponse)
async def global_search(
    q: str = Query(..., min_length=MIN_QUERY_LEN, max_length=MAX_QUERY_LEN),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    query = q.strip()
    if len(query) < MIN_QUERY_LEN:
        raise HTTPException(
            status_code=422,
            detail={"message": f"Query must be at least {MIN_QUERY_LEN} characters."},
        )

    user_id = current_user["id"]
    pattern = _regex_pattern(query)
    base = _user_filter(user_id)

    clients_total, client_items = await _search_collection(
        db, "clients", CLIENT_SEARCH_FIELDS, base, pattern, _client_to_result
    )
    notes_total, note_items = await _search_collection(
        db,
        "notes",
        NOTE_SEARCH_FIELDS,
        base,
        pattern,
        lambda doc: _note_to_result(doc, query),
    )
    docs_total, doc_items = await _search_collection(
        db, "documents", DOCUMENT_SEARCH_FIELDS, base, pattern, _document_to_result
    )
    quotes_total, quote_items = await _search_collection(
        db,
        "quotes",
        QUOTE_SEARCH_FIELDS,
        base,
        pattern,
        lambda doc: _quote_to_result(doc, query),
    )
    invoices_total, invoice_items = await _search_collection(
        db,
        "invoices",
        INVOICE_SEARCH_FIELDS,
        base,
        pattern,
        lambda doc: _invoice_to_result(doc, query),
    )

    total = clients_total + notes_total + docs_total + quotes_total + invoices_total

    return SearchResponse(
        query=query,
        total=total,
        groups=SearchGroups(
            clients=SearchGroup(total=clients_total, items=client_items),
            notes=SearchGroup(total=notes_total, items=note_items),
            documents=SearchGroup(total=docs_total, items=doc_items),
            quotes=SearchGroup(total=quotes_total, items=quote_items),
            invoices=SearchGroup(total=invoices_total, items=invoice_items),
        ),
    )
