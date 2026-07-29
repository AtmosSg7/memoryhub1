"""Import / enrich MemoryHub clients from remote contacts (Google → MH only)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from contact_sync import (
    default_contact_sync_fields,
    detect_user_modification,
    hydrate_contact_sync,
)
from integrations.constants import (
    IMPORT_RESULT_CONFLICT,
    IMPORT_RESULT_CREATED,
    IMPORT_RESULT_ENRICHED,
    IMPORT_RESULT_SKIPPED,
    PROVIDER_GOOGLE_CONTACTS,
)
from integrations.matching import find_matching_client
from integrations.models import (
    ImportItemResult,
    RemoteContact,
    SyncSummary,
)

ACTOR_SYSTEM = "system"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


def _sync_meta(source_id: Optional[str], *, now: str) -> dict:
    return default_contact_sync_fields(
        source=PROVIDER_GOOGLE_CONTACTS,  # type: ignore[arg-type]
        source_id=source_id,
        sync_status="synced",
        actor=ACTOR_SYSTEM,
        last_synced_at=now,
        is_user_modified=False,
        version=1,
    )


def _ensure_primary(items: List[dict]) -> List[dict]:
    if not items:
        return items
    if any(bool(item.get("isPrimary")) for item in items):
        return items
    items[0] = {**items[0], "isPrimary": True}
    return items


def remote_to_email_dicts(contact: RemoteContact, *, now: str) -> List[dict]:
    items = []
    for entry in contact.emails:
        value = (entry.value or "").strip()
        if not value:
            continue
        items.append(
            hydrate_contact_sync(
                {
                    "id": _new_id(),
                    "value": value,
                    "label": entry.label or "main",
                    "isPrimary": bool(entry.primary),
                    **_sync_meta(entry.sourceId or f"{contact.sourceId}:email:{value}", now=now),
                }
            )
        )
    return _ensure_primary(items)


def remote_to_phone_dicts(contact: RemoteContact, *, now: str) -> List[dict]:
    items = []
    for entry in contact.phones:
        value = (entry.value or "").strip()
        if not value:
            continue
        items.append(
            hydrate_contact_sync(
                {
                    "id": _new_id(),
                    "value": value,
                    "label": entry.label or "main",
                    "isPrimary": bool(entry.primary),
                    **_sync_meta(entry.sourceId or f"{contact.sourceId}:phone:{value}", now=now),
                }
            )
        )
    return _ensure_primary(items)


def remote_to_address_dicts(contact: RemoteContact, *, now: str) -> List[dict]:
    items = []
    for entry in contact.addresses:
        if not any([entry.line1, entry.city, entry.postalCode]):
            continue
        items.append(
            hydrate_contact_sync(
                {
                    "id": _new_id(),
                    "line1": entry.line1,
                    "line2": entry.line2,
                    "city": entry.city,
                    "postalCode": entry.postalCode,
                    "country": (entry.country or "FR")[:2].upper(),
                    "label": entry.label or "main",
                    "isPrimary": bool(entry.primary),
                    **_sync_meta(entry.sourceId or f"{contact.sourceId}:address", now=now),
                }
            )
        )
    return _ensure_primary(items)


def _merge_contact_lists(
    existing: List[dict],
    incoming: List[dict],
    *,
    kind: str,
) -> Tuple[List[dict], bool, bool]:
    """Merge remote contacts into local list.

    Returns (merged, enriched, conflict).
    Never silently overwrites user-modified values.
    """
    enriched = False
    conflict = False
    by_source: Dict[str, dict] = {}
    for item in existing:
        sid = (item.get("sourceId") or "").strip()
        if sid:
            by_source[sid] = item

    merged = [dict(item) for item in existing]

    for remote_item in incoming:
        sid = (remote_item.get("sourceId") or "").strip()
        local = by_source.get(sid) if sid else None

        if local is None:
            # Also skip if same value already exists from any source
            if kind == "address":
                fingerprint = (
                    (remote_item.get("line1") or "").strip().lower(),
                    (remote_item.get("city") or "").strip().lower(),
                    (remote_item.get("postalCode") or "").strip().lower(),
                )
                exists = any(
                    (
                        (item.get("line1") or "").strip().lower(),
                        (item.get("city") or "").strip().lower(),
                        (item.get("postalCode") or "").strip().lower(),
                    )
                    == fingerprint
                    for item in merged
                )
            else:
                value = (remote_item.get("value") or "").strip().lower()
                exists = any((item.get("value") or "").strip().lower() == value for item in merged)

            if exists:
                continue
            merged.append(remote_item)
            enriched = True
            continue

        # Same sourceId — update if not user-modified; otherwise conflict
        if local.get("isUserModified"):
            if detect_user_modification(local, remote_item, kind=kind):
                conflict = True
                # Keep local, mark conflict status for visibility
                for index, item in enumerate(merged):
                    if item.get("id") == local.get("id"):
                        merged[index] = {
                            **item,
                            "syncStatus": "conflict",
                            "lastSyncedAt": remote_item.get("lastSyncedAt") or item.get("lastSyncedAt"),
                        }
                        break
            continue

        # Safe to update remote-owned field
        for index, item in enumerate(merged):
            if item.get("id") == local.get("id"):
                updated = {
                    **item,
                    **{k: v for k, v in remote_item.items() if k not in {"id"}},
                    "id": item["id"],
                    "isPrimary": item.get("isPrimary", remote_item.get("isPrimary")),
                    "isUserModified": False,
                    "syncStatus": "synced",
                    "version": int(item.get("version") or 1) + 1,
                    "updatedBy": ACTOR_SYSTEM,
                }
                if detect_user_modification(item, updated, kind=kind):
                    enriched = True
                merged[index] = hydrate_contact_sync(updated)
                break

    return _ensure_primary(merged), enriched, conflict


def build_client_from_remote(user_id: str, contact: RemoteContact) -> dict:
    now = _utc_now_iso()
    emails = remote_to_email_dicts(contact, now=now)
    phones = remote_to_phone_dicts(contact, now=now)
    addresses = remote_to_address_dicts(contact, now=now)

    name = (contact.displayName or "").strip() or "Contact Google"
    contact_name = " ".join([p for p in [contact.givenName, contact.familyName] if p]).strip() or name
    company = (contact.company or "").strip() or None

    primary_email = next((e for e in emails if e.get("isPrimary")), emails[0] if emails else None)
    primary_phone = next((p for p in phones if p.get("isPrimary")), phones[0] if phones else None)
    primary_address = next((a for a in addresses if a.get("isPrimary")), addresses[0] if addresses else None)

    return {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "name": name,
        "contactName": contact_name,
        "email": (primary_email or {}).get("value"),
        "phone": (primary_phone or {}).get("value"),
        "company": company,
        "activity": None,
        "address": (primary_address or {}).get("line1"),
        "city": (primary_address or {}).get("city"),
        "postalCode": (primary_address or {}).get("postalCode"),
        "country": (primary_address or {}).get("country") or "FR",
        "siret": None,
        "vatNumber": None,
        "status": "new",
        "notes": None,
        "tags": [],
        "isFavorite": False,
        "photoStorageKey": None,
        "emails": emails,
        "phones": phones,
        "addresses": addresses,
        "companyInfo": {
            "legalName": company or name,
            "tradeName": company,
            "siret": None,
            "vatNumber": None,
            "activity": None,
        },
        "integrations": {
            "googleContactsId": contact.sourceId,
            "gmailThreadHint": None,
            "whatsappNumber": None,
            "calendarLink": None,
        },
        "schemaVersion": 3,
        "createdAt": now,
        "updatedAt": now,
    }


def enrich_client_from_remote(existing: dict, contact: RemoteContact) -> Tuple[dict, bool, bool]:
    now = _utc_now_iso()
    merged = dict(existing)
    conflict = False
    enriched = False

    emails, e_enr, e_conf = _merge_contact_lists(
        list(existing.get("emails") or []),
        remote_to_email_dicts(contact, now=now),
        kind="email",
    )
    phones, p_enr, p_conf = _merge_contact_lists(
        list(existing.get("phones") or []),
        remote_to_phone_dicts(contact, now=now),
        kind="phone",
    )
    addresses, a_enr, a_conf = _merge_contact_lists(
        list(existing.get("addresses") or []),
        remote_to_address_dicts(contact, now=now),
        kind="address",
    )

    enriched = e_enr or p_enr or a_enr
    conflict = e_conf or p_conf or a_conf

    merged["emails"] = emails
    merged["phones"] = phones
    merged["addresses"] = addresses

    # Flat shortcuts from primary
    if emails:
        primary = next((i for i in emails if i.get("isPrimary")), emails[0])
        merged["email"] = primary.get("value")
    if phones:
        primary = next((i for i in phones if i.get("isPrimary")), phones[0])
        merged["phone"] = primary.get("value")
    if addresses:
        primary = next((i for i in addresses if i.get("isPrimary")), addresses[0])
        merged["address"] = primary.get("line1")
        merged["city"] = primary.get("city")
        merged["postalCode"] = primary.get("postalCode")
        merged["country"] = primary.get("country") or merged.get("country") or "FR"

    if contact.company and not (merged.get("company") or "").strip():
        merged["company"] = contact.company
        enriched = True

    integrations = dict(merged.get("integrations") or {})
    if not integrations.get("googleContactsId"):
        integrations["googleContactsId"] = contact.sourceId
        enriched = True
    merged["integrations"] = integrations
    merged["updatedAt"] = now
    merged["schemaVersion"] = max(int(merged.get("schemaVersion") or 1), 3)
    return merged, enriched, conflict


async def import_remote_contacts(
    db,
    user_id: str,
    contacts: List[RemoteContact],
) -> Tuple[SyncSummary, List[ImportItemResult]]:
    cursor = db.clients.find({"userId": user_id}, {"_id": 0})
    clients = [doc async for doc in cursor]
    clients_by_id = {c["id"]: c for c in clients}

    summary = SyncSummary(total=len(contacts))
    results: List[ImportItemResult] = []
    seen_source_ids = set()

    for contact in contacts:
        if not contact.sourceId or contact.sourceId in seen_source_ids:
            summary.skipped += 1
            results.append(
                ImportItemResult(
                    sourceId=contact.sourceId or "",
                    outcome=IMPORT_RESULT_SKIPPED,
                    reason="duplicate_in_batch",
                )
            )
            continue
        seen_source_ids.add(contact.sourceId)

        # Already linked via integrations.googleContactsId
        linked = next(
            (
                c
                for c in clients
                if (c.get("integrations") or {}).get("googleContactsId") == contact.sourceId
            ),
            None,
        )
        match = linked
        reason = "source_id" if linked else ""
        if not match:
            match, reason = find_matching_client(clients, contact)

        if match:
            merged, enriched, conflict = enrich_client_from_remote(match, contact)
            if conflict:
                outcome = IMPORT_RESULT_CONFLICT
                summary.conflicts += 1
                if enriched:
                    summary.enriched += 1
            elif enriched:
                outcome = IMPORT_RESULT_ENRICHED
                summary.enriched += 1
            else:
                outcome = IMPORT_RESULT_SKIPPED
                summary.skipped += 1

            if outcome != IMPORT_RESULT_SKIPPED:
                await db.clients.update_one(
                    {"userId": user_id, "id": match["id"]},
                    {"$set": {k: v for k, v in merged.items() if k not in ("id", "userId", "_id")}},
                )
                clients_by_id[match["id"]] = merged
                for index, client in enumerate(clients):
                    if client["id"] == match["id"]:
                        clients[index] = merged
                        break

            results.append(
                ImportItemResult(
                    sourceId=contact.sourceId,
                    outcome=outcome,
                    clientId=match["id"],
                    clientName=merged.get("company") or merged.get("name"),
                    reason=reason or None,
                )
            )
            continue

        # Create new client
        if not (contact.emails or contact.phones or contact.company or contact.displayName):
            summary.skipped += 1
            results.append(
                ImportItemResult(
                    sourceId=contact.sourceId,
                    outcome=IMPORT_RESULT_SKIPPED,
                    reason="empty_contact",
                )
            )
            continue

        doc = build_client_from_remote(user_id, contact)
        await db.clients.insert_one(doc)
        clients.append(doc)
        clients_by_id[doc["id"]] = doc
        summary.created += 1
        results.append(
            ImportItemResult(
                sourceId=contact.sourceId,
                outcome=IMPORT_RESULT_CREATED,
                clientId=doc["id"],
                clientName=doc.get("company") or doc.get("name"),
            )
        )

    summary.finishedAt = _utc_now_iso()
    return summary, results
