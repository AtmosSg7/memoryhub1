"""Generic contact sync metadata — connector-agnostic infrastructure.

Every synchronizable contact field (email, phone, address) carries its own
provenance metadata so future connectors (Contacts, Gmail, Outlook, WhatsApp,
calendar, imports…) can share the same conflict / hydrate helpers.

No external sync is implemented here.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Sequence, Tuple

ContactSource = Literal[
    "manual",
    "google_contacts",
    "gmail",
    "outlook",
    "whatsapp",
    "calendar",
    "ai_import",
    "invoice_import",
    "quote_import",
]

ContactSyncStatus = Literal[
    "synced",
    "pending",
    "conflict",
    "disconnected",
]

CONTACT_SOURCES: Tuple[str, ...] = (
    "manual",
    "google_contacts",
    "gmail",
    "outlook",
    "whatsapp",
    "calendar",
    "ai_import",
    "invoice_import",
    "quote_import",
)

CONTACT_SYNC_STATUSES: Tuple[str, ...] = (
    "synced",
    "pending",
    "conflict",
    "disconnected",
)

# Scalar keys compared when detecting a user edit (excluding sync metadata).
EMAIL_PHONE_VALUE_KEYS = ("value", "label", "isPrimary")
ADDRESS_VALUE_KEYS = ("line1", "line2", "city", "postalCode", "country", "label", "isPrimary")

SYNC_META_KEYS = (
    "source",
    "sourceId",
    "syncStatus",
    "lastSyncedAt",
    "createdBy",
    "updatedBy",
    "isUserModified",
    "version",
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_contact_source(value: Optional[str]) -> ContactSource:
    raw = (value or "manual").strip().lower()
    if raw in CONTACT_SOURCES:
        return raw  # type: ignore[return-value]
    return "manual"


def normalize_contact_sync_status(value: Optional[str]) -> ContactSyncStatus:
    raw = (value or "synced").strip().lower()
    if raw in CONTACT_SYNC_STATUSES:
        return raw  # type: ignore[return-value]
    return "synced"


def default_contact_sync_fields(
    *,
    source: ContactSource = "manual",
    source_id: Optional[str] = None,
    sync_status: ContactSyncStatus = "synced",
    actor: Optional[str] = None,
    last_synced_at: Optional[str] = None,
    is_user_modified: bool = False,
    version: int = 1,
) -> Dict[str, Any]:
    """Default sync metadata for a newly created contact entry."""
    return {
        "source": normalize_contact_source(source),
        "sourceId": source_id,
        "syncStatus": normalize_contact_sync_status(sync_status),
        "lastSyncedAt": last_synced_at,
        "createdBy": actor,
        "updatedBy": actor,
        "isUserModified": bool(is_user_modified),
        "version": max(1, int(version or 1)),
    }


def hydrate_contact_sync(item: Optional[dict], *, actor: Optional[str] = None) -> dict:
    """Ensure sync metadata exists on a contact dict (non-destructive)."""
    if not isinstance(item, dict):
        return default_contact_sync_fields(actor=actor)

    hydrated = dict(item)
    defaults = default_contact_sync_fields(
        source=hydrated.get("source") or "manual",  # type: ignore[arg-type]
        source_id=hydrated.get("sourceId"),
        sync_status=hydrated.get("syncStatus") or "synced",  # type: ignore[arg-type]
        actor=hydrated.get("createdBy") or actor,
        last_synced_at=hydrated.get("lastSyncedAt"),
        is_user_modified=bool(hydrated.get("isUserModified", False)),
        version=int(hydrated.get("version") or 1),
    )
    # Preserve existing keys; fill only missing sync fields
    for key, value in defaults.items():
        if key not in hydrated or hydrated.get(key) is None:
            if key in ("isUserModified", "version", "source", "syncStatus"):
                hydrated[key] = value
            elif key not in hydrated:
                hydrated[key] = value

    hydrated["source"] = normalize_contact_source(hydrated.get("source"))
    hydrated["syncStatus"] = normalize_contact_sync_status(hydrated.get("syncStatus"))
    hydrated["isUserModified"] = bool(hydrated.get("isUserModified", False))
    hydrated["version"] = max(1, int(hydrated.get("version") or 1))
    return hydrated


def hydrate_contacts_sync(items: Optional[Sequence[dict]], *, actor: Optional[str] = None) -> List[dict]:
    return [hydrate_contact_sync(item, actor=actor) for item in (items or []) if isinstance(item, dict)]


def contact_content_fingerprint(item: Optional[dict], *, kind: str = "email") -> tuple:
    """Stable fingerprint of user-editable content (ignores sync metadata)."""
    if not isinstance(item, dict):
        return ()
    keys = ADDRESS_VALUE_KEYS if kind == "address" else EMAIL_PHONE_VALUE_KEYS
    parts = []
    for key in keys:
        value = item.get(key)
        if isinstance(value, str):
            parts.append(value.strip().lower() if key != "country" else value.strip().upper())
        elif isinstance(value, bool):
            parts.append(value)
        else:
            parts.append(value or "")
    return tuple(parts)


def detect_user_modification(
    previous: Optional[dict],
    current: Optional[dict],
    *,
    kind: str = "email",
) -> bool:
    """True when editable content changed between two contact versions."""
    if not previous or not current:
        return bool(current) and not previous
    return contact_content_fingerprint(previous, kind=kind) != contact_content_fingerprint(
        current, kind=kind
    )


def mark_contact_user_modified(
    item: dict,
    *,
    actor: Optional[str] = "user",
    now: Optional[str] = None,
) -> dict:
    """Flag a contact as manually edited (bumps version, keeps source identity)."""
    hydrated = hydrate_contact_sync(item, actor=actor)
    stamped = {
        **hydrated,
        "isUserModified": True,
        "updatedBy": actor or hydrated.get("updatedBy") or "user",
        "version": int(hydrated.get("version") or 1) + 1,
        "syncStatus": (
            "conflict"
            if hydrated.get("source") not in (None, "manual")
            and hydrated.get("syncStatus") == "synced"
            else hydrated.get("syncStatus") or "synced"
        ),
    }
    # Touch lastSyncedAt only for pure manual sources stays untouched;
    # connectors will refresh lastSyncedAt on their own sync runs.
    if stamped.get("source") == "manual":
        stamped["syncStatus"] = "synced"
    return stamped


def preserve_sync_on_merge(existing: Optional[dict], incoming: dict) -> dict:
    """Merge incoming contact payload while preserving existing sync provenance.

    Incoming may override sync fields explicitly (connector writes). Otherwise
    keep source / sourceId / lastSyncedAt from the stored entry.
    """
    base = hydrate_contact_sync(existing) if existing else default_contact_sync_fields()
    merged = {**base, **incoming}
    # If incoming omitted sync keys, restore from base
    for key in SYNC_META_KEYS:
        if key not in incoming or incoming.get(key) is None:
            if key in ("isUserModified", "version"):
                continue
            merged[key] = base.get(key)
    return hydrate_contact_sync(merged)


def prepare_conflict_resolution(
    local: dict,
    remote: dict,
    *,
    kind: str = "email",
) -> Dict[str, Any]:
    """Describe a future conflict between local and remote contact values.

    Does not apply a resolution — connectors will consume this shape later.
    """
    local_h = hydrate_contact_sync(local)
    remote_h = hydrate_contact_sync(remote)
    diverged = detect_user_modification(local_h, remote_h, kind=kind)
    return {
        "status": "conflict" if diverged or local_h.get("isUserModified") else "synced",
        "kind": kind,
        "local": local_h,
        "remote": remote_h,
        "prefer": "local" if local_h.get("isUserModified") else "remote",
        "detectedAt": utc_now_iso(),
    }


def apply_user_contact_edits(
    previous_items: Optional[Sequence[dict]],
    next_items: Optional[Sequence[dict]],
    *,
    kind: str = "email",
    actor: Optional[str] = "user",
) -> List[dict]:
    """Stamp user modifications when preparing nested contacts for save."""
    previous_by_id = {
        item.get("id"): hydrate_contact_sync(item)
        for item in (previous_items or [])
        if isinstance(item, dict) and item.get("id")
    }
    result: List[dict] = []
    for raw in next_items or []:
        if not isinstance(raw, dict):
            continue
        current = hydrate_contact_sync(raw, actor=actor)
        previous = previous_by_id.get(current.get("id"))
        if previous is None:
            # New entry created by the user
            stamped = {
                **current,
                **default_contact_sync_fields(
                    source="manual",
                    actor=actor,
                    is_user_modified=True,
                    version=1,
                ),
                "id": current.get("id"),
                "isUserModified": True,
                "createdBy": actor,
                "updatedBy": actor,
            }
            # Keep domain fields from current
            for key, value in current.items():
                if key not in SYNC_META_KEYS:
                    stamped[key] = value
            result.append(hydrate_contact_sync(stamped, actor=actor))
            continue

        if detect_user_modification(previous, current, kind=kind):
            merged = preserve_sync_on_merge(previous, current)
            result.append(mark_contact_user_modified(merged, actor=actor))
        else:
            # Primary/label-only reshuffles still preserve sync; bump updatedBy lightly
            merged = preserve_sync_on_merge(previous, current)
            if previous.get("isPrimary") != current.get("isPrimary") or previous.get("label") != current.get(
                "label"
            ):
                merged["updatedBy"] = actor or merged.get("updatedBy")
            result.append(merged)
    return result
