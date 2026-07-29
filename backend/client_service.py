"""Client domain service — hydrate, dual-write, display name, cascades."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from client_models import (
    CLIENT_SCHEMA_VERSION,
    ClientAddress,
    ClientCompanyInfo,
    ClientCreate,
    ClientEmail,
    ClientIntegrations,
    ClientPhone,
    ClientPublic,
    ClientUpdate,
)
from contact_sync import (
    apply_user_contact_edits,
    default_contact_sync_fields,
    hydrate_contact_sync,
    hydrate_contacts_sync,
)

CLIENT_PROJECTION = {"_id": 0, "userId": 0}


def client_display_name(client: dict) -> str:
    company = (client.get("company") or "").strip()
    if company:
        return company
    return (client.get("name") or "").strip() or "Client"


def _new_id() -> str:
    return str(uuid.uuid4())


def _primary_or_first(items: List[dict]) -> Optional[dict]:
    if not items:
        return None
    for item in items:
        if item.get("isPrimary"):
            return item
    return items[0]


def _ensure_primary(items: List[dict]) -> List[dict]:
    if not items:
        return items
    if any(bool(item.get("isPrimary")) for item in items):
        return items
    items[0] = {**items[0], "isPrimary": True}
    return items


def _email_dicts_from_flat(email: Optional[str]) -> List[dict]:
    value = (email or "").strip()
    if not value:
        return []
    return [
        hydrate_contact_sync(
            {
                "id": _new_id(),
                "value": value,
                "label": "main",
                "isPrimary": True,
                **default_contact_sync_fields(source="manual"),
            }
        )
    ]


def _phone_dicts_from_flat(phone: Optional[str]) -> List[dict]:
    value = (phone or "").strip()
    if not value:
        return []
    return [
        hydrate_contact_sync(
            {
                "id": _new_id(),
                "value": value,
                "label": "main",
                "isPrimary": True,
                **default_contact_sync_fields(source="manual"),
            }
        )
    ]


def _address_dicts_from_flat(
    address: Optional[str],
    city: Optional[str],
    postal_code: Optional[str] = None,
    country: Optional[str] = None,
) -> List[dict]:
    line1 = (address or "").strip() or None
    city_value = (city or "").strip() or None
    postal = (postal_code or "").strip() or None
    country_value = ((country or "FR").strip() or "FR").upper()[:2]
    if not any([line1, city_value, postal]):
        return []
    return [
        hydrate_contact_sync(
            {
                "id": _new_id(),
                "line1": line1,
                "line2": None,
                "city": city_value,
                "postalCode": postal,
                "country": country_value,
                "label": "main",
                "isPrimary": True,
                **default_contact_sync_fields(source="manual"),
            }
        )
    ]


def _sync_flat_from_nested(doc: dict) -> None:
    """Write primary nested values into legacy flat scalars."""
    emails = doc.get("emails") or []
    phones = doc.get("phones") or []
    addresses = doc.get("addresses") or []

    primary_email = _primary_or_first(emails)
    primary_phone = _primary_or_first(phones)
    primary_address = _primary_or_first(addresses)

    if primary_email is not None:
        doc["email"] = primary_email.get("value")
    if primary_phone is not None:
        doc["phone"] = primary_phone.get("value")
    if primary_address is not None:
        doc["address"] = primary_address.get("line1")
        doc["city"] = primary_address.get("city")
        doc["postalCode"] = primary_address.get("postalCode")
        doc["country"] = primary_address.get("country") or doc.get("country") or "FR"


def _sync_nested_from_flat(doc: dict, *, force: bool = False) -> None:
    """Ensure nested collections exist; optionally refresh primary from flat."""
    emails = list(doc.get("emails") or [])
    phones = list(doc.get("phones") or [])
    addresses = list(doc.get("addresses") or [])

    if not emails and doc.get("email"):
        emails = _email_dicts_from_flat(doc.get("email"))
    elif force and doc.get("email") is not None:
        emails = _upsert_primary_scalar(emails, "value", doc.get("email"))

    if not phones and doc.get("phone"):
        phones = _phone_dicts_from_flat(doc.get("phone"))
    elif force and doc.get("phone") is not None:
        phones = _upsert_primary_scalar(phones, "value", doc.get("phone"))

    if not addresses and (doc.get("address") or doc.get("city") or doc.get("postalCode")):
        addresses = _address_dicts_from_flat(
            doc.get("address"),
            doc.get("city"),
            doc.get("postalCode"),
            doc.get("country"),
        )
    elif force and any(k in doc for k in ("address", "city", "postalCode", "country")):
        addresses = _upsert_primary_address(addresses, doc)

    doc["emails"] = _ensure_primary(emails)
    doc["phones"] = _ensure_primary(phones)
    doc["addresses"] = _ensure_primary(addresses)


def _upsert_primary_scalar(
    items: List[dict],
    value_key: str,
    value: Optional[str],
) -> List[dict]:
    cleaned = (value or "").strip() if value is not None else ""
    if not cleaned:
        # Clear primary value but keep other entries
        next_items = []
        for item in items:
            if item.get("isPrimary"):
                continue
            next_items.append(item)
        return next_items

    primary = _primary_or_first(items)
    if primary is None:
        return [
            hydrate_contact_sync(
                {
                    "id": _new_id(),
                    "value": cleaned,
                    "label": "main",
                    "isPrimary": True,
                    **default_contact_sync_fields(source="manual", actor="user"),
                }
            )
        ]

    updated = []
    found = False
    for item in items:
        if item is primary or (not found and item.get("id") == primary.get("id")):
            updated.append(
                hydrate_contact_sync({**item, value_key: cleaned, "isPrimary": True})
            )
            found = True
        else:
            updated.append(
                hydrate_contact_sync(
                    {**item, "isPrimary": False} if item.get("isPrimary") else item
                )
            )
    if not found:
        updated.insert(
            0,
            hydrate_contact_sync(
                {
                    "id": _new_id(),
                    value_key: cleaned,
                    "label": "main",
                    "isPrimary": True,
                    **default_contact_sync_fields(source="manual", actor="user"),
                }
            ),
        )
    return updated


def _upsert_primary_address(items: List[dict], doc: dict) -> List[dict]:
    line1 = (doc.get("address") or "").strip() or None
    city = (doc.get("city") or "").strip() or None
    postal = (doc.get("postalCode") or "").strip() or None
    country = ((doc.get("country") or "FR").strip() or "FR").upper()[:2]
    if not any([line1, city, postal]):
        return [item for item in items if not item.get("isPrimary")]

    primary = _primary_or_first(items)
    payload = {
        "line1": line1,
        "line2": (primary or {}).get("line2"),
        "city": city,
        "postalCode": postal,
        "country": country,
        "label": (primary or {}).get("label") or "main",
        "isPrimary": True,
    }
    if primary is None:
        return [
            hydrate_contact_sync(
                {"id": _new_id(), **payload, **default_contact_sync_fields(source="manual", actor="user")}
            )
        ]

    updated = []
    for item in items:
        if item.get("id") == primary.get("id"):
            updated.append(hydrate_contact_sync({**item, **payload}))
        else:
            updated.append(
                hydrate_contact_sync(
                    {**item, "isPrimary": False} if item.get("isPrimary") else item
                )
            )
    return updated


def _company_info_from_doc(doc: dict) -> dict:
    existing = doc.get("companyInfo")
    if isinstance(existing, dict) and any(existing.values()):
        return {
            "legalName": existing.get("legalName") or doc.get("company") or doc.get("name"),
            "tradeName": existing.get("tradeName") or doc.get("company"),
            "siret": existing.get("siret") or doc.get("siret"),
            "vatNumber": existing.get("vatNumber") or doc.get("vatNumber"),
            "activity": existing.get("activity") or doc.get("activity"),
        }
    return {
        "legalName": doc.get("company") or doc.get("name"),
        "tradeName": doc.get("company"),
        "siret": doc.get("siret"),
        "vatNumber": doc.get("vatNumber"),
        "activity": doc.get("activity"),
    }


def hydrate_client_doc(doc: dict) -> dict:
    """Lazy-migrate a stored client document to current schema (in-memory)."""
    hydrated = dict(doc)
    _sync_nested_from_flat(hydrated, force=False)
    hydrated["emails"] = hydrate_contacts_sync(hydrated.get("emails") or [])
    hydrated["phones"] = hydrate_contacts_sync(hydrated.get("phones") or [])
    hydrated["addresses"] = hydrate_contacts_sync(hydrated.get("addresses") or [])
    hydrated["tags"] = list(hydrated.get("tags") or [])
    hydrated["isFavorite"] = bool(hydrated.get("isFavorite", False))
    hydrated["photoStorageKey"] = hydrated.get("photoStorageKey")
    hydrated["companyInfo"] = _company_info_from_doc(hydrated)
    integrations = hydrated.get("integrations")
    hydrated["integrations"] = integrations if isinstance(integrations, dict) else {}
    hydrated["schemaVersion"] = max(
        int(hydrated.get("schemaVersion") or 1),
        CLIENT_SCHEMA_VERSION,
    )
    # Keep flat shortcuts aligned with primary nested values
    _sync_flat_from_nested(hydrated)
    return hydrated


def build_client_document(user_id: str, body: ClientCreate) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    doc: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "name": body.name,
        "contactName": body.contactName,
        "email": str(body.email) if body.email else None,
        "phone": body.phone,
        "company": body.company,
        "activity": body.activity,
        "address": body.address,
        "city": body.city,
        "postalCode": body.postalCode,
        "country": (body.country or "FR").upper()[:2] if body.country or body.address or body.city else None,
        "siret": body.siret,
        "vatNumber": body.vatNumber,
        "status": body.status,
        "notes": body.notes,
        "tags": list(body.tags or []),
        "isFavorite": bool(body.isFavorite),
        "photoStorageKey": None,
        "emails": [e.model_dump() for e in body.emails] if body.emails is not None else [],
        "phones": [p.model_dump() for p in body.phones] if body.phones is not None else [],
        "addresses": [a.model_dump() for a in body.addresses] if body.addresses is not None else [],
        "integrations": {},
        "schemaVersion": CLIENT_SCHEMA_VERSION,
        "createdAt": now,
        "updatedAt": now,
    }

    # Prefer nested payload when provided; otherwise hydrate from flat
    if body.emails is None and body.phones is None and body.addresses is None:
        _sync_nested_from_flat(doc, force=False)
    else:
        if not doc["emails"] and doc.get("email"):
            doc["emails"] = _email_dicts_from_flat(doc.get("email"))
        if not doc["phones"] and doc.get("phone"):
            doc["phones"] = _phone_dicts_from_flat(doc.get("phone"))
        if not doc["addresses"] and (doc.get("address") or doc.get("city")):
            doc["addresses"] = _address_dicts_from_flat(
                doc.get("address"), doc.get("city"), doc.get("postalCode"), doc.get("country")
            )
        doc["emails"] = _ensure_primary(hydrate_contacts_sync(doc["emails"]))
        doc["phones"] = _ensure_primary(hydrate_contacts_sync(doc["phones"]))
        doc["addresses"] = _ensure_primary(hydrate_contacts_sync(doc["addresses"]))
        _sync_flat_from_nested(doc)

    doc["emails"] = hydrate_contacts_sync(doc.get("emails") or [])
    doc["phones"] = hydrate_contacts_sync(doc.get("phones") or [])
    doc["addresses"] = hydrate_contacts_sync(doc.get("addresses") or [])
    doc["companyInfo"] = _company_info_from_doc(doc)
    return doc


def apply_client_updates(existing: dict, body: ClientUpdate) -> Tuple[dict, dict]:
    """Merge update into existing doc. Returns (merged, flat_updates_for_set)."""
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return existing, {}

    if "email" in updates and updates["email"] is not None:
        updates["email"] = str(updates["email"])

    if "emails" in updates and updates["emails"] is not None:
        updates["emails"] = [
            e if isinstance(e, dict) else e.model_dump() for e in updates["emails"]
        ]
    if "phones" in updates and updates["phones"] is not None:
        updates["phones"] = [
            p if isinstance(p, dict) else p.model_dump() for p in updates["phones"]
        ]
    if "addresses" in updates and updates["addresses"] is not None:
        updates["addresses"] = [
            a if isinstance(a, dict) else a.model_dump() for a in updates["addresses"]
        ]

    if "country" in updates and updates["country"]:
        updates["country"] = str(updates["country"]).upper()[:2]

    merged = {**existing, **updates}
    merged["updatedAt"] = datetime.now(timezone.utc).isoformat()
    merged["schemaVersion"] = CLIENT_SCHEMA_VERSION

    nested_touched = any(k in updates for k in ("emails", "phones", "addresses"))
    flat_contact_touched = any(
        k in updates for k in ("email", "phone", "address", "city", "postalCode", "country")
    )

    if nested_touched:
        if "emails" in updates:
            merged["emails"] = apply_user_contact_edits(
                existing.get("emails") or [],
                merged.get("emails") or [],
                kind="email",
                actor="user",
            )
        if "phones" in updates:
            merged["phones"] = apply_user_contact_edits(
                existing.get("phones") or [],
                merged.get("phones") or [],
                kind="phone",
                actor="user",
            )
        if "addresses" in updates:
            merged["addresses"] = apply_user_contact_edits(
                existing.get("addresses") or [],
                merged.get("addresses") or [],
                kind="address",
                actor="user",
            )
        merged["emails"] = _ensure_primary(hydrate_contacts_sync(merged.get("emails") or []))
        merged["phones"] = _ensure_primary(hydrate_contacts_sync(merged.get("phones") or []))
        merged["addresses"] = _ensure_primary(hydrate_contacts_sync(merged.get("addresses") or []))
        _sync_flat_from_nested(merged)
    elif flat_contact_touched:
        previous_emails = list(existing.get("emails") or [])
        previous_phones = list(existing.get("phones") or [])
        previous_addresses = list(existing.get("addresses") or [])
        _sync_nested_from_flat(merged, force=True)
        if "email" in updates:
            merged["emails"] = apply_user_contact_edits(
                previous_emails, merged.get("emails") or [], kind="email", actor="user"
            )
        if "phone" in updates:
            merged["phones"] = apply_user_contact_edits(
                previous_phones, merged.get("phones") or [], kind="phone", actor="user"
            )
        if any(k in updates for k in ("address", "city", "postalCode", "country")):
            merged["addresses"] = apply_user_contact_edits(
                previous_addresses, merged.get("addresses") or [], kind="address", actor="user"
            )
        merged["emails"] = hydrate_contacts_sync(merged.get("emails") or [])
        merged["phones"] = hydrate_contacts_sync(merged.get("phones") or [])
        merged["addresses"] = hydrate_contacts_sync(merged.get("addresses") or [])
        _sync_flat_from_nested(merged)
    else:
        _sync_nested_from_flat(merged, force=False)
        merged["emails"] = hydrate_contacts_sync(merged.get("emails") or [])
        merged["phones"] = hydrate_contacts_sync(merged.get("phones") or [])
        merged["addresses"] = hydrate_contacts_sync(merged.get("addresses") or [])

    # Keep companyInfo aligned when company fields change
    if any(k in updates for k in ("company", "name", "siret", "vatNumber", "activity")):
        merged["companyInfo"] = _company_info_from_doc(merged)
    else:
        merged["companyInfo"] = _company_info_from_doc(merged)

    merged["tags"] = list(merged.get("tags") or [])
    merged["isFavorite"] = bool(merged.get("isFavorite", False))
    if not isinstance(merged.get("integrations"), dict):
        merged["integrations"] = {}

    set_payload = {k: merged[k] for k in merged if k not in ("id", "userId", "createdAt", "_id")}
    return merged, set_payload


def client_public(doc: dict) -> ClientPublic:
    hydrated = hydrate_client_doc(doc)
    company_info = hydrated.get("companyInfo") or {}
    integrations = hydrated.get("integrations") or {}

    return ClientPublic(
        id=hydrated["id"],
        name=hydrated["name"],
        contactName=hydrated.get("contactName"),
        email=hydrated.get("email"),
        phone=hydrated.get("phone"),
        company=hydrated.get("company"),
        activity=hydrated.get("activity"),
        address=hydrated.get("address"),
        city=hydrated.get("city"),
        postalCode=hydrated.get("postalCode"),
        country=hydrated.get("country"),
        siret=hydrated.get("siret"),
        vatNumber=hydrated.get("vatNumber"),
        status=hydrated.get("status", "new"),
        notes=hydrated.get("notes"),
        tags=list(hydrated.get("tags") or []),
        isFavorite=bool(hydrated.get("isFavorite", False)),
        photoStorageKey=hydrated.get("photoStorageKey"),
        emails=[ClientEmail(**e) for e in (hydrated.get("emails") or [])],
        phones=[ClientPhone(**p) for p in (hydrated.get("phones") or [])],
        addresses=[ClientAddress(**a) for a in (hydrated.get("addresses") or [])],
        companyInfo=ClientCompanyInfo(**company_info) if company_info else None,
        integrations=ClientIntegrations(**integrations),
        schemaVersion=int(hydrated.get("schemaVersion") or CLIENT_SCHEMA_VERSION),
        createdAt=hydrated["createdAt"],
        updatedAt=hydrated["updatedAt"],
        totalRevenue=int(hydrated.get("totalRevenue") or 0),
        documentsCount=int(hydrated.get("documentsCount") or 0),
        notesCount=int(hydrated.get("notesCount") or 0),
        lastActivityAt=hydrated.get("lastActivityAt") or hydrated.get("updatedAt"),
    )


async def cascade_client_display_name(db, user_id: str, client_id: str, display_name: str) -> None:
    await db.notes.update_many(
        {"userId": user_id, "clientId": client_id},
        {"$set": {"clientName": display_name}},
    )
    await db.documents.update_many(
        {"userId": user_id, "clientId": client_id},
        {"$set": {"clientName": display_name}},
    )
    await db.quotes.update_many(
        {"userId": user_id, "clientId": client_id},
        {"$set": {"clientName": display_name}},
    )
    await db.invoices.update_many(
        {"userId": user_id, "clientId": client_id},
        {"$set": {"clientName": display_name}},
    )


async def count_linked_records(db, user_id: str, client_id: str) -> dict:
    return {
        "notes": await db.notes.count_documents({"userId": user_id, "clientId": client_id}),
        "documents": await db.documents.count_documents({"userId": user_id, "clientId": client_id}),
        "quotes": await db.quotes.count_documents({"userId": user_id, "clientId": client_id}),
        "invoices": await db.invoices.count_documents({"userId": user_id, "clientId": client_id}),
    }


def _empty_list_stats() -> Dict[str, Any]:
    return {
        "totalRevenue": 0,
        "documentsCount": 0,
        "notesCount": 0,
        "lastActivityAt": None,
    }


def max_iso_datetime(*values: Optional[str]) -> Optional[str]:
    """Return the latest ISO-8601 datetime string (lexicographic max)."""
    best: Optional[str] = None
    for value in values:
        if not value or not isinstance(value, str):
            continue
        candidate = value.strip()
        if not candidate:
            continue
        if best is None or candidate > best:
            best = candidate
    return best


def _mongo_max_date_expr(*fields: str) -> dict:
    """Per-document max across optional date fields (missing → empty string)."""
    return {"$max": [{"$ifNull": [f"${field}", ""]} for field in fields]}


def _client_id_match(user_id: str) -> dict:
    return {
        "userId": user_id,
        "clientId": {"$type": "string", "$ne": ""},
    }


async def _aggregate_rows(collection, pipeline: List[dict]) -> List[dict]:
    return [row async for row in collection.aggregate(pipeline)]


async def aggregate_client_list_stats(db, user_id: str) -> Dict[str, Dict[str, Any]]:
    """Batch list metrics via grouped aggregations (no per-client queries).

    documentsCount = active quotes + active invoices + uploaded files
      (three distinct collections — no cross-collection double count).
    totalRevenue = paid amount on non-cancelled invoices.
    lastActivityAt = max ISO date across client resources + events.
    """
    notes_pipeline = [
        {"$match": _client_id_match(user_id)},
        {
            "$group": {
                "_id": "$clientId",
                "notesCount": {"$sum": 1},
                "lastAt": {
                    "$max": _mongo_max_date_expr("updatedAt", "createdAt", "noteDate"),
                },
            }
        },
    ]

    files_pipeline = [
        {"$match": _client_id_match(user_id)},
        {
            "$group": {
                "_id": "$clientId",
                "filesCount": {"$sum": 1},
                "lastAt": {
                    "$max": _mongo_max_date_expr("updatedAt", "createdAt"),
                },
            }
        },
    ]

    # isArchived excluded from count, included in last activity
    quotes_pipeline = [
        {"$match": _client_id_match(user_id)},
        {
            "$group": {
                "_id": "$clientId",
                "documentsCount": {
                    "$sum": {
                        "$cond": [
                            {"$eq": [{"$ifNull": ["$isArchived", False]}, True]},
                            0,
                            1,
                        ]
                    }
                },
                "lastAt": {
                    "$max": _mongo_max_date_expr(
                        "updatedAt", "createdAt", "quoteDate", "sentAt", "archivedAt"
                    ),
                },
            }
        },
    ]

    invoices_pipeline = [
        {"$match": _client_id_match(user_id)},
        {
            "$group": {
                "_id": "$clientId",
                "documentsCount": {
                    "$sum": {
                        "$cond": [
                            {"$eq": [{"$ifNull": ["$isArchived", False]}, True]},
                            0,
                            1,
                        ]
                    }
                },
                "totalRevenue": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$status", "cancelled"]},
                            0,
                            {
                                "$cond": [
                                    {
                                        "$and": [
                                            {"$lte": [{"$ifNull": ["$amountPaid", 0]}, 0]},
                                            {"$in": ["$status", ["paid", "Paid"]]},
                                        ]
                                    },
                                    {"$ifNull": ["$amountTTC", 0]},
                                    {"$ifNull": ["$amountPaid", 0]},
                                ]
                            },
                        ]
                    }
                },
                "lastAt": {
                    "$max": _mongo_max_date_expr(
                        "updatedAt",
                        "createdAt",
                        "invoiceDate",
                        "paidAt",
                        "sentAt",
                        "archivedAt",
                    ),
                },
            }
        },
    ]

    events_pipeline = [
        {"$match": _client_id_match(user_id)},
        {
            "$group": {
                "_id": "$clientId",
                "lastAt": {"$max": {"$ifNull": ["$createdAt", ""]}},
            }
        },
    ]

    notes_rows, files_rows, quotes_rows, invoices_rows, events_rows = await asyncio.gather(
        _aggregate_rows(db.notes, notes_pipeline),
        _aggregate_rows(db.documents, files_pipeline),
        _aggregate_rows(db.quotes, quotes_pipeline),
        _aggregate_rows(db.invoices, invoices_pipeline),
        _aggregate_rows(db.events, events_pipeline),
    )

    stats: Dict[str, Dict[str, Any]] = {}

    def ensure(client_id: Optional[str]) -> Optional[Dict[str, Any]]:
        if not client_id:
            return None
        entry = stats.get(client_id)
        if entry is None:
            entry = _empty_list_stats()
            stats[client_id] = entry
        return entry

    def merge_last(entry: Dict[str, Any], last_at: Optional[str]) -> None:
        entry["lastActivityAt"] = max_iso_datetime(entry.get("lastActivityAt"), last_at or None)

    for row in notes_rows:
        entry = ensure(row.get("_id"))
        if entry is None:
            continue
        entry["notesCount"] = int(row.get("notesCount") or 0)
        merge_last(entry, row.get("lastAt"))

    for row in files_rows:
        entry = ensure(row.get("_id"))
        if entry is None:
            continue
        entry["documentsCount"] += int(row.get("filesCount") or 0)
        merge_last(entry, row.get("lastAt"))

    for row in quotes_rows:
        entry = ensure(row.get("_id"))
        if entry is None:
            continue
        entry["documentsCount"] += int(row.get("documentsCount") or 0)
        merge_last(entry, row.get("lastAt"))

    for row in invoices_rows:
        entry = ensure(row.get("_id"))
        if entry is None:
            continue
        entry["documentsCount"] += int(row.get("documentsCount") or 0)
        entry["totalRevenue"] += int(row.get("totalRevenue") or 0)
        merge_last(entry, row.get("lastAt"))

    for row in events_rows:
        entry = ensure(row.get("_id"))
        if entry is None:
            continue
        merge_last(entry, row.get("lastAt"))

    return stats


def merge_client_list_stats(
    client_doc: dict,
    stats: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Combine batch stats with the client document's own timestamps."""
    stats = stats or {}
    last_activity = max_iso_datetime(
        stats.get("lastActivityAt"),
        client_doc.get("updatedAt"),
        client_doc.get("createdAt"),
    )
    return {
        "totalRevenue": int(stats.get("totalRevenue") or 0),
        "documentsCount": int(stats.get("documentsCount") or 0),
        "notesCount": int(stats.get("notesCount") or 0),
        "lastActivityAt": last_activity,
    }
