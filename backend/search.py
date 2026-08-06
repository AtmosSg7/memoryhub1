"""Universal Search — multi-entity lookup for artisans (additive Search V2+).

Preserves the grouped `/api/search` contract used by the topbar / SearchPage.
Adds prospects, actions, CI fields, phone/amount normalization, ranking, pagination.
"""

from __future__ import annotations

import asyncio
import re
from typing import Any, Dict, List, Literal, Optional, Sequence, Set

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from auth import get_current_user, get_db
from prospects.identity import identity_key_for_email
from prospects.service import prospect_id_for
from rate_limit import rate_limit
from search_normalize import (
    accent_flexible_regex,
    amount_cent_candidates,
    detect_matched_fields,
    is_phone_like,
    normalize_query,
    phone_query_variants,
    score_result,
)

search_router = APIRouter(prefix="/search", tags=["search"])
search_rate_limit = rate_limit(max_requests=60, window_seconds=60)

MIN_QUERY_LEN = 2
MAX_QUERY_LEN = 100
DEFAULT_LIMIT = 12
MAX_LIMIT = 40
MAX_SCAN_ANALYSES = 40
MAX_SCAN_PROSPECT_COMMS = 80

SEARCH_PROJECTION = {"_id": 0, "userId": 0}

CLIENT_SEARCH_FIELDS = [
    "name",
    "company",
    "contactName",
    "email",
    "phone",
    "activity",
    "city",
    "postalCode",
    "siret",
    "vatNumber",
    "notes",
    "tags",
    "emails.value",
    "phones.value",
    "addresses.city",
    "addresses.postalCode",
    "addresses.line1",
]
NOTE_SEARCH_FIELDS = ["title", "content", "clientName", "type"]
DOCUMENT_SEARCH_FIELDS = ["name", "clientName", "extension", "category", "type"]
QUOTE_SEARCH_FIELDS = ["number", "title", "clientName", "internalNotes", "status"]
INVOICE_SEARCH_FIELDS = ["number", "title", "clientName", "internalNotes", "status"]
COMM_SEARCH_FIELDS = [
    "subject",
    "preview",
    "metadata.fromEmail",
    "metadata.toEmail",
    "metadata.fromName",
    "metadata.clientName",
    "metadata.toEmails",
]
ACTION_SEARCH_FIELDS = ["title", "description", "type", "status"]
CI_SEARCH_FIELDS = ["summary", "intent", "suggestedActionTitle"]

TYPE_ALIASES = {
    "client": "clients",
    "clients": "clients",
    "prospect": "prospects",
    "prospects": "prospects",
    "communication": "emails",
    "communications": "emails",
    "email": "emails",
    "emails": "emails",
    "note": "notes",
    "notes": "notes",
    "document": "documents",
    "documents": "documents",
    "quote": "quotes",
    "quotes": "quotes",
    "invoice": "invoices",
    "invoices": "invoices",
    "action": "actions",
    "actions": "actions",
}

ALL_GROUP_KEYS = (
    "clients",
    "prospects",
    "emails",
    "notes",
    "documents",
    "quotes",
    "invoices",
    "actions",
)


class SearchResultItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    type: Literal[
        "client",
        "prospect",
        "note",
        "document",
        "quote",
        "invoice",
        "email",
        "communication",
        "action",
    ]
    title: str
    subtitle: Optional[str] = None
    preview: Optional[str] = None
    clientId: Optional[str] = None
    clientName: Optional[str] = None
    sourceId: Optional[str] = None
    occurredAt: Optional[str] = None
    relevance: Optional[int] = None
    matchedFields: List[str] = Field(default_factory=list)
    navigationTarget: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    # Legacy fields (consumers still use these)
    url: str
    createdAt: str = ""
    updatedAt: str = ""
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
    emails: SearchGroup
    prospects: SearchGroup = SearchGroup(total=0, items=[])
    actions: SearchGroup = SearchGroup(total=0, items=[])
    # Reserved empty groups for future connectors
    whatsapp: SearchGroup = SearchGroup(total=0, items=[])
    calls: SearchGroup = SearchGroup(total=0, items=[])
    calendar: SearchGroup = SearchGroup(total=0, items=[])


class SearchResponse(BaseModel):
    query: str
    total: int
    groups: SearchGroups
    items: List[SearchResultItem] = Field(default_factory=list)
    limit: int = DEFAULT_LIMIT
    offset: int = 0


def _user_filter(user_id: str) -> dict:
    return {"userId": user_id}


def _regex_patterns(query: str) -> List[dict]:
    """One or more Mongo regex patterns (accent-flexible + phone variants)."""
    patterns: List[dict] = []
    flex = accent_flexible_regex(query)
    if flex:
        patterns.append({"$regex": flex, "$options": "i"})
    if is_phone_like(query):
        for variant in phone_query_variants(query):
            patterns.append({"$regex": re.escape(variant), "$options": "i"})
    # Deduplicate by regex string
    seen: Set[str] = set()
    unique: List[dict] = []
    for p in patterns:
        key = p["$regex"]
        if key in seen:
            continue
        seen.add(key)
        unique.append(p)
    return unique or [{"$regex": re.escape(query), "$options": "i"}]


def _build_or_filter(fields: Sequence[str], patterns: Sequence[dict]) -> List[dict]:
    clauses: List[dict] = []
    for field in fields:
        for pattern in patterns:
            clauses.append({field: pattern})
    return clauses


def _query_tokens(query: str) -> List[str]:
    return [tok for tok in re.split(r"\s+", query.strip()) if len(tok) >= 2]


def _text_match_clause(fields: Sequence[str], query: str) -> dict:
    """Match all tokens (AND). Each token may hit a different field."""
    # Phone queries must stay whole (spaces are formatting, not tokens).
    if is_phone_like(query):
        return {"$or": _build_or_filter(fields, _regex_patterns(query))}
    tokens = _query_tokens(query)
    if not tokens:
        return {"$or": _build_or_filter(fields, _regex_patterns(query))}
    if len(tokens) == 1:
        return {"$or": _build_or_filter(fields, _regex_patterns(tokens[0]))}
    return {
        "$and": [
            {"$or": _build_or_filter(fields, _regex_patterns(token))} for token in tokens
        ]
    }


def _match_preview(content: str, query: str, max_len: int = 120) -> str:
    if not content:
        return ""
    lowered = content.lower()
    q_lower = query.lower()
    idx = lowered.find(q_lower)
    if idx == -1:
        # Accent-stripped fallback
        from search_normalize import strip_accents

        idx = strip_accents(lowered).find(strip_accents(q_lower))
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


def _enrich_item(item: SearchResultItem) -> SearchResultItem:
    """Fill additive aliases from legacy fields."""
    if not item.preview and item.matchPreview:
        item.preview = item.matchPreview
    if not item.matchPreview and item.preview:
        item.matchPreview = item.preview
    if not item.navigationTarget:
        item.navigationTarget = item.url
    if not item.occurredAt:
        item.occurredAt = item.updatedAt or item.createdAt or None
    return item


def _client_url(client_id: str) -> str:
    return f"/dashboard/clients/{client_id}"


def _note_url(client_id: Optional[str]) -> str:
    if client_id:
        return f"/dashboard/clients/{client_id}?section=notes"
    return "/dashboard/notes"


def _document_url(client_id: Optional[str], doc_id: Optional[str] = None) -> str:
    if client_id:
        return f"/dashboard/clients/{client_id}?section=documents"
    if doc_id:
        return f"/dashboard/files?open={doc_id}"
    return "/dashboard/documents"


def _quote_url(client_id: Optional[str], quote_id: str) -> str:
    return f"/dashboard/documents?open={quote_id}"


def _invoice_url(client_id: Optional[str], invoice_id: str) -> str:
    return f"/dashboard/documents?open={invoice_id}"


def _email_url(client_id: Optional[str], comm_id: str) -> str:
    if client_id:
        return f"/dashboard/clients/{client_id}?section=timeline"
    return f"/dashboard/communications?open={comm_id}"


def _prospect_url(prospect_id: str) -> str:
    return f"/dashboard/prospects?open={prospect_id}"


def _action_url(doc: dict) -> str:
    comm_id = doc.get("communicationId")
    client_id = doc.get("clientId")
    if comm_id:
        return f"/dashboard/communications?open={comm_id}"
    if client_id:
        return f"/dashboard/clients/{client_id}?section=timeline"
    return "/dashboard"


def _client_display_name(doc: dict) -> str:
    company = (doc.get("company") or "").strip()
    if company:
        return company
    return doc.get("name", "") or "Client"


def _client_subtitle(doc: dict) -> Optional[str]:
    parts = []
    name = (doc.get("name") or "").strip()
    company = (doc.get("company") or "").strip()
    if name and name != company:
        parts.append(name)
    contact = (doc.get("contactName") or "").strip()
    if contact and contact not in parts:
        parts.append(contact)
    city = (doc.get("city") or "").strip()
    if city:
        parts.append(city)
    tags = doc.get("tags") or []
    if isinstance(tags, list) and tags:
        parts.append(", ".join(str(t) for t in tags[:3]))
    if parts:
        return " · ".join(parts)
    return doc.get("email") or doc.get("phone")


def _rank_items(items: List[SearchResultItem], query: str) -> List[SearchResultItem]:
    def key(item: SearchResultItem):
        tier = item.relevance if item.relevance is not None else 50
        occurred = item.occurredAt or item.updatedAt or item.createdAt or ""
        return (tier, -len(occurred), occurred)

    return sorted(items, key=key)


def _page(items: List[SearchResultItem], *, limit: int, offset: int) -> List[SearchResultItem]:
    if offset < 0:
        offset = 0
    return items[offset : offset + limit]


async def _search_clients(
    db, user_id: str, query: str, patterns: List[dict], *, limit: int, offset: int
) -> SearchGroup:
    base = _user_filter(user_id)
    clause = _text_match_clause(CLIENT_SEARCH_FIELDS, query)
    if is_phone_like(query):
        phone_ors = []
        for variant in phone_query_variants(query):
            phone_ors.append({"phone": {"$regex": re.escape(variant), "$options": "i"}})
            phone_ors.append({"phones.value": {"$regex": re.escape(variant), "$options": "i"}})
        mongo_q = {**base, "$or": [clause, {"$or": phone_ors}]}
    else:
        mongo_q = {**base, **clause}
    total = await db.clients.count_documents(mongo_q)
    # Fetch a window larger than page for ranking
    fetch_n = min(MAX_LIMIT * 3, offset + limit + 24)
    cursor = db.clients.find(mongo_q, SEARCH_PROJECTION).sort("updatedAt", -1).limit(fetch_n)
    items: List[SearchResultItem] = []
    async for doc in cursor:
        display = _client_display_name(doc)
        field_values = {
            "name": doc.get("name"),
            "company": doc.get("company"),
            "email": doc.get("email"),
            "phone": doc.get("phone"),
            "city": doc.get("city"),
            "siret": doc.get("siret"),
            "notes": doc.get("notes"),
            "tags": ",".join(doc.get("tags") or []) if isinstance(doc.get("tags"), list) else doc.get("tags"),
        }
        matched = detect_matched_fields(query, field_values)
        if not matched and is_phone_like(query):
            matched = ["phone"]
        tier, _ = score_result(
            matched_fields=matched or ["name"],
            query=query,
            field_values=field_values,
            occurred_at=doc.get("updatedAt") or "",
            linked_to_client=True,
            active_status=(doc.get("status") or "") in ("active", "lead", ""),
        )
        url = _client_url(doc["id"])
        is_prospect_client = bool(doc.get("isProspect"))
        items.append(
            _enrich_item(
                SearchResultItem(
                    id=doc["id"],
                    type="prospect" if is_prospect_client else "client",
                    title=display,
                    subtitle=_client_subtitle(doc),
                    clientId=doc["id"],
                    clientName=display,
                    url=url,
                    navigationTarget=url,
                    createdAt=doc.get("createdAt") or "",
                    updatedAt=doc.get("updatedAt") or doc.get("createdAt") or "",
                    occurredAt=doc.get("updatedAt") or doc.get("createdAt"),
                    relevance=tier,
                    matchedFields=matched,
                    metadata={"status": doc.get("status"), "isProspect": is_prospect_client},
                )
            )
        )
    ranked = _rank_items(items, query)
    # Clients marked isProspect stay in clients group as type prospect for navigation clarity —
    # but group key remains clients for company clients. Separate prospect group is unlinked inbox.
    # Force type client for clients collection (isProspect flag only in metadata).
    for item in ranked:
        item.type = "client"
    return SearchGroup(total=total, items=_page(ranked, limit=limit, offset=offset))


async def _search_notes(
    db, user_id: str, query: str, patterns: List[dict], *, limit: int, offset: int
) -> SearchGroup:
    mongo_q = {**_user_filter(user_id), **_text_match_clause(NOTE_SEARCH_FIELDS, query)}
    total = await db.notes.count_documents(mongo_q)
    fetch_n = min(MAX_LIMIT * 3, offset + limit + 24)
    cursor = db.notes.find(mongo_q, SEARCH_PROJECTION).sort("updatedAt", -1).limit(fetch_n)
    items: List[SearchResultItem] = []
    async for doc in cursor:
        client_id = doc.get("clientId")
        preview = _match_preview(doc.get("content") or "", query)
        matched = detect_matched_fields(
            query,
            {"title": doc.get("title"), "content": doc.get("content"), "type": doc.get("type")},
        )
        tier, _ = score_result(
            matched_fields=matched or ["content"],
            query=query,
            field_values={"title": doc.get("title"), "content": doc.get("content")},
            occurred_at=doc.get("updatedAt") or "",
            linked_to_client=bool(client_id),
        )
        url = _note_url(client_id)
        items.append(
            _enrich_item(
                SearchResultItem(
                    id=doc["id"],
                    type="note",
                    title=doc.get("title") or "Note sans titre",
                    subtitle=doc.get("clientName") or doc.get("type"),
                    clientId=client_id,
                    clientName=doc.get("clientName"),
                    url=url,
                    navigationTarget=url,
                    createdAt=doc.get("createdAt") or "",
                    updatedAt=doc.get("updatedAt") or doc.get("createdAt") or "",
                    occurredAt=doc.get("updatedAt") or doc.get("createdAt"),
                    matchPreview=preview or None,
                    preview=preview or None,
                    relevance=tier,
                    matchedFields=matched,
                    metadata={"noteType": doc.get("type")},
                )
            )
        )
    return SearchGroup(total=total, items=_page(_rank_items(items, query), limit=limit, offset=offset))


async def _search_documents(
    db, user_id: str, query: str, patterns: List[dict], *, limit: int, offset: int
) -> SearchGroup:
    mongo_q = {
        **_user_filter(user_id),
        **_text_match_clause(DOCUMENT_SEARCH_FIELDS, query),
    }
    total = await db.documents.count_documents(mongo_q)
    fetch_n = min(MAX_LIMIT * 3, offset + limit + 24)
    cursor = db.documents.find(mongo_q, SEARCH_PROJECTION).sort("updatedAt", -1).limit(fetch_n)
    items: List[SearchResultItem] = []
    async for doc in cursor:
        client_id = doc.get("clientId")
        ext = (doc.get("extension") or "").upper()
        matched = detect_matched_fields(
            query,
            {
                "name": doc.get("name"),
                "category": doc.get("category") or doc.get("type"),
                "clientName": doc.get("clientName"),
            },
        )
        tier, _ = score_result(
            matched_fields=matched or ["name"],
            query=query,
            field_values={"name": doc.get("name")},
            occurred_at=doc.get("updatedAt") or "",
            linked_to_client=bool(client_id),
        )
        url = _document_url(client_id, doc.get("id"))
        items.append(
            _enrich_item(
                SearchResultItem(
                    id=doc["id"],
                    type="document",
                    title=doc.get("name") or "Document",
                    subtitle=doc.get("clientName") or (ext if ext else None),
                    clientId=client_id,
                    clientName=doc.get("clientName"),
                    url=url,
                    navigationTarget=url,
                    createdAt=doc.get("createdAt") or "",
                    updatedAt=doc.get("updatedAt") or doc.get("createdAt") or "",
                    occurredAt=doc.get("updatedAt") or doc.get("createdAt"),
                    relevance=tier,
                    matchedFields=matched,
                    metadata={"extension": doc.get("extension"), "category": doc.get("category")},
                )
            )
        )
    return SearchGroup(total=total, items=_page(_rank_items(items, query), limit=limit, offset=offset))


async def _search_commercial(
    db,
    collection: str,
    result_type: Literal["quote", "invoice"],
    fields: Sequence[str],
    user_id: str,
    query: str,
    patterns: List[dict],
    *,
    limit: int,
    offset: int,
) -> SearchGroup:
    clause = _text_match_clause(fields, query)
    amount_ors = []
    for cents in amount_cent_candidates(query):
        amount_ors.append({"amountTTC": cents})
        amount_ors.append({"amountHT": cents})
    if amount_ors:
        mongo_q = {**_user_filter(user_id), "$or": [clause, {"$or": amount_ors}]}
    else:
        mongo_q = {**_user_filter(user_id), **clause}
    total = await db[collection].count_documents(mongo_q)
    fetch_n = min(MAX_LIMIT * 3, offset + limit + 24)
    cursor = db[collection].find(mongo_q, SEARCH_PROJECTION).sort("updatedAt", -1).limit(fetch_n)
    default_label = "Devis" if result_type == "quote" else "Facture"
    url_fn = _quote_url if result_type == "quote" else _invoice_url
    items: List[SearchResultItem] = []
    async for doc in cursor:
        client_id = doc.get("clientId")
        number = doc.get("number") or ""
        title = f"{number} — {doc.get('title') or default_label}".strip(" —")
        preview = _match_preview(doc.get("internalNotes") or "", query)
        amount = doc.get("amountTTC")
        if amount is not None and not preview:
            preview = f"{amount / 100:.2f} €".replace(".", ",")
        matched = detect_matched_fields(
            query,
            {
                "number": number,
                "title": doc.get("title"),
                "clientName": doc.get("clientName"),
                "status": doc.get("status"),
                "internalNotes": doc.get("internalNotes"),
            },
        )
        if amount_cent_candidates(query) and amount in amount_cent_candidates(query):
            matched = list(dict.fromkeys([*matched, "amountTTC"]))
        tier, _ = score_result(
            matched_fields=matched or ["number"],
            query=query,
            field_values={"number": number, "title": doc.get("title")},
            occurred_at=doc.get("updatedAt") or "",
            linked_to_client=bool(client_id),
            active_status=(doc.get("status") or "")
            in ("sent", "viewed", "accepted", "issued", "overdue", "partially_paid", "draft"),
        )
        # Prefer number match
        if "number" in matched:
            tier = min(tier, 2)
        url = url_fn(client_id, doc["id"])
        items.append(
            _enrich_item(
                SearchResultItem(
                    id=doc["id"],
                    type=result_type,
                    title=title,
                    subtitle=doc.get("clientName") or doc.get("status"),
                    clientId=client_id,
                    clientName=doc.get("clientName"),
                    url=url,
                    navigationTarget=url,
                    createdAt=doc.get("createdAt") or "",
                    updatedAt=doc.get("updatedAt") or doc.get("createdAt") or "",
                    occurredAt=doc.get("updatedAt") or doc.get("createdAt"),
                    matchPreview=preview or None,
                    preview=preview or None,
                    relevance=tier,
                    matchedFields=matched,
                    metadata={
                        "number": number,
                        "status": doc.get("status"),
                        "amountTTC": amount,
                    },
                )
            )
        )
    return SearchGroup(total=total, items=_page(_rank_items(items, query), limit=limit, offset=offset))


async def _ci_matching_comm_ids(db, user_id: str, query: str, patterns: List[dict]) -> Dict[str, dict]:
    """Map communicationId → analysis fields for CI text matches."""
    mongo_q = {
        **_user_filter(user_id),
        "status": {"$in": ["ready", "accepted", "dismissed"]},
        **_text_match_clause(CI_SEARCH_FIELDS, query),
    }
    cursor = (
        db.communication_analyses.find(
            mongo_q,
            {
                "_id": 0,
                "communicationId": 1,
                "summary": 1,
                "intent": 1,
                "suggestedActionTitle": 1,
                "urgency": 1,
            },
        )
        .sort("updatedAt", -1)
        .limit(MAX_SCAN_ANALYSES)
    )
    out: Dict[str, dict] = {}
    async for doc in cursor:
        cid = doc.get("communicationId")
        if cid:
            out[str(cid)] = doc
    return out


async def _search_communications(
    db, user_id: str, query: str, patterns: List[dict], *, limit: int, offset: int
) -> SearchGroup:
    ci_map = await _ci_matching_comm_ids(db, user_id, query, patterns)
    clause = _text_match_clause(COMM_SEARCH_FIELDS, query)
    if ci_map:
        mongo_q = {
            **_user_filter(user_id),
            "$or": [clause, {"id": {"$in": list(ci_map.keys())}}],
        }
    else:
        mongo_q = {**_user_filter(user_id), **clause}
    total = await db.communications.count_documents(mongo_q)
    fetch_n = min(MAX_LIMIT * 3, offset + limit + 24)
    cursor = (
        db.communications.find(mongo_q, SEARCH_PROJECTION).sort("createdAt", -1).limit(fetch_n)
    )
    items: List[SearchResultItem] = []
    async for doc in cursor:
        client_id = doc.get("clientId") or None
        meta = doc.get("metadata") or {}
        analysis = ci_map.get(doc["id"]) or {}
        preview_src = analysis.get("summary") or doc.get("preview") or ""
        preview = _match_preview(preview_src, query) or preview_src[:120]
        matched = detect_matched_fields(
            query,
            {
                "subject": doc.get("subject"),
                "preview": doc.get("preview"),
                "metadata.fromEmail": meta.get("fromEmail"),
                "metadata.fromName": meta.get("fromName"),
                "summary": analysis.get("summary"),
                "intent": analysis.get("intent"),
            },
        )
        if analysis.get("summary") and "summary" in matched:
            pass
        elif analysis and not matched:
            matched = ["summary"]
        tier, _ = score_result(
            matched_fields=matched or ["subject"],
            query=query,
            field_values={
                "subject": doc.get("subject"),
                "preview": doc.get("preview"),
                "summary": analysis.get("summary"),
            },
            occurred_at=doc.get("createdAt") or "",
            linked_to_client=bool(client_id),
        )
        if "summary" in matched or "intent" in matched:
            tier = max(tier, 7)  # AI match ranks after title/identity
        url = _email_url(client_id, doc["id"])
        items.append(
            _enrich_item(
                SearchResultItem(
                    id=doc["id"],
                    type="email",
                    title=doc.get("subject") or "E-mail",
                    subtitle=meta.get("clientName")
                    or meta.get("fromName")
                    or meta.get("fromEmail")
                    or doc.get("provider"),
                    clientId=client_id,
                    clientName=meta.get("clientName"),
                    sourceId=doc.get("providerId"),
                    url=url,
                    navigationTarget=url,
                    createdAt=doc.get("createdAt") or "",
                    updatedAt=doc.get("updatedAt") or doc.get("createdAt") or "",
                    occurredAt=doc.get("createdAt"),
                    matchPreview=preview or None,
                    preview=preview or None,
                    relevance=tier,
                    matchedFields=matched,
                    metadata={
                        "direction": doc.get("direction"),
                        "intent": analysis.get("intent"),
                        "provider": doc.get("provider"),
                    },
                )
            )
        )
    return SearchGroup(total=total, items=_page(_rank_items(items, query), limit=limit, offset=offset))


async def _search_prospects(
    db, user_id: str, query: str, patterns: List[dict], *, limit: int, offset: int
) -> SearchGroup:
    """Search unlinked inbound communications as prospect identity groups."""
    unlinked = {
        "$or": [
            {"clientId": None},
            {"clientId": ""},
            {"clientId": {"$exists": False}},
        ]
    }
    mongo_q = {
        **_user_filter(user_id),
        "type": "email",
        "direction": "inbound",
        "$and": [unlinked, _text_match_clause(COMM_SEARCH_FIELDS, query)],
    }
    cursor = (
        db.communications.find(mongo_q, SEARCH_PROJECTION)
        .sort("createdAt", -1)
        .limit(MAX_SCAN_PROSPECT_COMMS)
    )
    # Load ignored decisions to skip
    ignored_keys: Set[str] = set()
    async for decision in db.prospect_decisions.find(
        {"userId": user_id, "status": "ignored"},
        {"_id": 0, "identityKey": 1},
    ):
        if decision.get("identityKey"):
            ignored_keys.add(decision["identityKey"])

    by_identity: Dict[str, dict] = {}
    async for doc in cursor:
        meta = doc.get("metadata") or {}
        from_email = (meta.get("fromEmail") or "").strip().lower()
        key = identity_key_for_email(from_email)
        if not key or key in ignored_keys:
            continue
        if key not in by_identity:
            by_identity[key] = doc

    items: List[SearchResultItem] = []
    for identity_key, doc in by_identity.items():
        meta = doc.get("metadata") or {}
        from_email = (meta.get("fromEmail") or "").strip().lower()
        pid = prospect_id_for(user_id, identity_key)
        display = (meta.get("fromName") or "").strip() or from_email or "Prospect"
        matched = detect_matched_fields(
            query,
            {
                "metadata.fromName": meta.get("fromName"),
                "metadata.fromEmail": from_email,
                "subject": doc.get("subject"),
                "preview": doc.get("preview"),
            },
        )
        tier, _ = score_result(
            matched_fields=matched or ["subject"],
            query=query,
            field_values={"subject": doc.get("subject"), "metadata.fromEmail": from_email},
            occurred_at=doc.get("createdAt") or "",
        )
        url = _prospect_url(pid)
        preview = _match_preview(doc.get("preview") or "", query)
        items.append(
            _enrich_item(
                SearchResultItem(
                    id=pid,
                    type="prospect",
                    title=display,
                    subtitle=from_email or doc.get("subject"),
                    sourceId=doc.get("id"),
                    url=url,
                    navigationTarget=url,
                    createdAt=doc.get("createdAt") or "",
                    updatedAt=doc.get("updatedAt") or doc.get("createdAt") or "",
                    occurredAt=doc.get("createdAt"),
                    matchPreview=preview or doc.get("subject"),
                    preview=preview or doc.get("subject"),
                    relevance=tier,
                    matchedFields=matched,
                    metadata={
                        "identityKey": identity_key,
                        "email": from_email,
                        "lastSubject": doc.get("subject"),
                    },
                )
            )
        )
    ranked = _rank_items(items, query)
    total = len(ranked)
    return SearchGroup(total=total, items=_page(ranked, limit=limit, offset=offset))


async def _search_actions(
    db, user_id: str, query: str, patterns: List[dict], *, limit: int, offset: int
) -> SearchGroup:
    mongo_q = {
        **_user_filter(user_id),
        **_text_match_clause(ACTION_SEARCH_FIELDS, query),
    }
    total = await db.actions.count_documents(mongo_q)
    fetch_n = min(MAX_LIMIT * 3, offset + limit + 24)
    cursor = db.actions.find(mongo_q, SEARCH_PROJECTION).sort("createdAt", -1).limit(fetch_n)
    items: List[SearchResultItem] = []
    async for doc in cursor:
        matched = detect_matched_fields(
            query,
            {
                "title": doc.get("title"),
                "description": doc.get("description"),
                "type": doc.get("type"),
                "status": doc.get("status"),
            },
        )
        active = (doc.get("status") or "") == "pending"
        tier, _ = score_result(
            matched_fields=matched or ["title"],
            query=query,
            field_values={"title": doc.get("title"), "description": doc.get("description")},
            occurred_at=doc.get("createdAt") or "",
            linked_to_client=bool(doc.get("clientId")),
            active_status=active,
        )
        url = _action_url(doc)
        preview = _match_preview(doc.get("description") or "", query)
        items.append(
            _enrich_item(
                SearchResultItem(
                    id=doc["id"],
                    type="action",
                    title=doc.get("title") or "Action",
                    subtitle=doc.get("status") or doc.get("type"),
                    clientId=doc.get("clientId"),
                    sourceId=doc.get("communicationId"),
                    url=url,
                    navigationTarget=url,
                    createdAt=doc.get("createdAt") or "",
                    updatedAt=doc.get("updatedAt") or doc.get("createdAt") or "",
                    occurredAt=doc.get("dueAt") or doc.get("createdAt"),
                    matchPreview=preview or None,
                    preview=preview or None,
                    relevance=tier,
                    matchedFields=matched,
                    metadata={
                        "priority": doc.get("priority"),
                        "status": doc.get("status"),
                        "actionType": doc.get("type"),
                    },
                )
            )
        )
    return SearchGroup(total=total, items=_page(_rank_items(items, query), limit=limit, offset=offset))


def _parse_types(types: Optional[str]) -> Optional[Set[str]]:
    if not types or not types.strip():
        return None
    selected: Set[str] = set()
    for raw in types.split(","):
        key = TYPE_ALIASES.get(raw.strip().lower())
        if key:
            selected.add(key)
    return selected or None


def _empty_group() -> SearchGroup:
    return SearchGroup(total=0, items=[])


@search_router.get("", response_model=SearchResponse)
async def global_search(
    q: str = Query(..., min_length=MIN_QUERY_LEN, max_length=MAX_QUERY_LEN),
    types: Optional[str] = Query(
        None,
        description="Comma-separated: client,prospect,communication,note,document,quote,invoice,action",
    ),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(search_rate_limit),
):
    query = normalize_query(q)
    if len(query) < MIN_QUERY_LEN:
        raise HTTPException(
            status_code=422,
            detail={"message": f"Query must be at least {MIN_QUERY_LEN} characters."},
        )

    user_id = current_user["id"]
    patterns = _regex_patterns(query)
    selected = _parse_types(types)
    want = selected or set(ALL_GROUP_KEYS)

    tasks = {}
    if "clients" in want:
        tasks["clients"] = _search_clients(
            db, user_id, query, patterns, limit=limit, offset=offset
        )
    if "notes" in want:
        tasks["notes"] = _search_notes(db, user_id, query, patterns, limit=limit, offset=offset)
    if "documents" in want:
        tasks["documents"] = _search_documents(
            db, user_id, query, patterns, limit=limit, offset=offset
        )
    if "quotes" in want:
        tasks["quotes"] = _search_commercial(
            db,
            "quotes",
            "quote",
            QUOTE_SEARCH_FIELDS,
            user_id,
            query,
            patterns,
            limit=limit,
            offset=offset,
        )
    if "invoices" in want:
        tasks["invoices"] = _search_commercial(
            db,
            "invoices",
            "invoice",
            INVOICE_SEARCH_FIELDS,
            user_id,
            query,
            patterns,
            limit=limit,
            offset=offset,
        )
    if "emails" in want:
        tasks["emails"] = _search_communications(
            db, user_id, query, patterns, limit=limit, offset=offset
        )
    if "prospects" in want:
        tasks["prospects"] = _search_prospects(
            db, user_id, query, patterns, limit=limit, offset=offset
        )
    if "actions" in want:
        tasks["actions"] = _search_actions(
            db, user_id, query, patterns, limit=limit, offset=offset
        )

    keys = list(tasks.keys())
    results = await asyncio.gather(*(tasks[k] for k in keys))
    by_key = {k: results[i] for i, k in enumerate(keys)}

    groups = SearchGroups(
        clients=by_key.get("clients") or _empty_group(),
        notes=by_key.get("notes") or _empty_group(),
        documents=by_key.get("documents") or _empty_group(),
        quotes=by_key.get("quotes") or _empty_group(),
        invoices=by_key.get("invoices") or _empty_group(),
        emails=by_key.get("emails") or _empty_group(),
        prospects=by_key.get("prospects") or _empty_group(),
        actions=by_key.get("actions") or _empty_group(),
    )

    total = (
        groups.clients.total
        + groups.notes.total
        + groups.documents.total
        + groups.quotes.total
        + groups.invoices.total
        + groups.emails.total
        + groups.prospects.total
        + groups.actions.total
    )

    flat: List[SearchResultItem] = []
    for key in (
        "clients",
        "prospects",
        "emails",
        "quotes",
        "invoices",
        "actions",
        "notes",
        "documents",
    ):
        flat.extend(getattr(groups, key).items)
    flat = _rank_items(flat, query)

    return SearchResponse(
        query=query,
        total=total,
        groups=groups,
        items=flat,
        limit=limit,
        offset=offset,
    )
