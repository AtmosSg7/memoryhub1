"""Prospects — projections over unlinked inbound communications + decision store.

Source of truth for exchanges remains ``db.communications``.
``db.prospect_decisions`` stores only user decisions (ignore / associate / convert).
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from client_models import ClientCreate
from client_service import build_client_document, client_display_name, client_public
from events import record_event
from integrations.matching import normalize_email_loose
from prospects.identity import (
    classify_email_noise,
    guess_company_from_email,
    guess_display_name,
    identity_key_for_email,
    identity_key_for_phone,
    parse_identity_key,
)
from prospects.models import (
    ProspectAssociateResponse,
    ProspectCommunicationPublic,
    ProspectCreateClientRequest,
    ProspectCreateClientResponse,
    ProspectDetailResponse,
    ProspectListResponse,
    ProspectPublic,
    ProspectRestoreResponse,
    ProspectIgnoreResponse,
)
from unlinked_email_service import (
    AssociateResponse,
    associate_communication_to_client,
    find_duplicate_client_by_email,
)

COLLECTION = "prospect_decisions"
# Safety cap for in-memory grouping (Gmail sync itself is capped).
_MAX_SCAN = 2500


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def prospect_id_for(user_id: str, identity_key: str) -> str:
    return hashlib.sha256(f"{user_id}:{identity_key}".encode("utf-8")).hexdigest()[:32]


def _comm_emails(doc: dict) -> Tuple[Optional[str], Optional[str], List[str]]:
    meta = doc.get("metadata") or {}
    from_email = normalize_email_loose(meta.get("fromEmail")) or None
    from_name = (meta.get("fromName") or "").strip() or None
    to_emails = [normalize_email_loose(e) for e in (meta.get("toEmails") or []) if e]
    if meta.get("toEmail"):
        primary_to = normalize_email_loose(meta.get("toEmail"))
        if primary_to and primary_to not in to_emails:
            to_emails.insert(0, primary_to)
    return from_email, from_name, [e for e in to_emails if e]


def _identity_keys_for_communication(doc: dict) -> List[str]:
    """Strong identity keys this communication contributes to.

    Inbound → fromEmail (+ phone if present in metadata).
    Outbound → never creates a prospect alone; keys are used only to attach
    to an existing inbound group when linking / detailing.
    """
    meta = doc.get("metadata") or {}
    from_email, _, to_emails = _comm_emails(doc)
    keys: List[str] = []
    direction = doc.get("direction") or "inbound"

    if direction == "inbound":
        key = identity_key_for_email(from_email)
        if key:
            keys.append(key)
    else:
        for addr in to_emails:
            key = identity_key_for_email(addr)
            if key:
                keys.append(key)

    phone_key = identity_key_for_phone(
        meta.get("phone") or meta.get("fromPhone") or meta.get("detectedPhone")
    )
    if phone_key and direction == "inbound":
        keys.append(phone_key)
    return keys


def _primary_email_identity(doc: dict) -> Optional[str]:
    from_email, _, to_emails = _comm_emails(doc)
    direction = doc.get("direction") or "inbound"
    if direction == "inbound":
        return identity_key_for_email(from_email)
    if to_emails:
        return identity_key_for_email(to_emails[0])
    return None


async def _load_decisions(db, user_id: str) -> Dict[str, dict]:
    cursor = db[COLLECTION].find({"userId": user_id}, {"_id": 0})
    docs = [doc async for doc in cursor]
    return {doc["identityKey"]: doc for doc in docs if doc.get("identityKey")}


async def _get_decision(db, user_id: str, identity_key: str) -> Optional[dict]:
    return await db[COLLECTION].find_one(
        {"userId": user_id, "identityKey": identity_key},
        {"_id": 0},
    )


async def _upsert_decision(db, user_id: str, identity_key: str, fields: dict) -> dict:
    now = _now()
    prospect_id = prospect_id_for(user_id, identity_key)
    existing = await _get_decision(db, user_id, identity_key)
    base = {
        "id": prospect_id,
        "userId": user_id,
        "identityKey": identity_key,
        "updatedAt": now,
    }
    if not existing:
        base["createdAt"] = now
    payload = {**base, **fields}
    await db[COLLECTION].update_one(
        {"userId": user_id, "identityKey": identity_key},
        {"$set": payload},
        upsert=True,
    )
    return await _get_decision(db, user_id, identity_key) or payload


async def _load_candidate_communications(db, user_id: str) -> List[dict]:
    """Unlinked emails (any direction) — outbound only attach to inbound groups."""
    query = {
        "userId": user_id,
        "type": "email",
        "$or": [{"clientId": None}, {"clientId": {"$exists": False}}, {"clientId": ""}],
    }
    cursor = (
        db.communications.find(query, {"_id": 0})
        .sort("createdAt", -1)
        .limit(_MAX_SCAN)
    )
    return [doc async for doc in cursor]


def _build_groups(
    docs: List[dict],
    decisions: Dict[str, dict],
) -> Dict[str, dict]:
    """Build identity_key → group accumulator. Only inbound opens a group."""
    groups: Dict[str, dict] = {}

    # Pass 1: open groups from inbound
    for doc in docs:
        if (doc.get("direction") or "inbound") != "inbound":
            continue
        if doc.get("ignoredAt"):
            # Individually ignored emails do not seed a prospect; other msgs may.
            continue
        identity_key = _primary_email_identity(doc)
        if not identity_key:
            continue
        from_email, from_name, _ = _comm_emails(doc)
        noise = classify_email_noise(
            email=from_email,
            from_name=from_name,
            subject=doc.get("subject"),
        )
        group = groups.get(identity_key)
        if not group:
            channel, value = parse_identity_key(identity_key)
            groups[identity_key] = {
                "identityKey": identity_key,
                "channel": channel,
                "email": value if channel == "email" else None,
                "phone": value if channel == "phone" else None,
                "displayName": guess_display_name(from_name=from_name, email=from_email),
                "company": guess_company_from_email(from_email),
                "noiseClass": noise,
                "docs": [],
                "inboundCount": 0,
            }
            group = groups[identity_key]
        else:
            # Prefer a real person name / clearer company when available
            if from_name and (
                not group.get("displayName")
                or group["displayName"] == guess_display_name(from_name=None, email=from_email)
            ):
                group["displayName"] = from_name
            if not group.get("company"):
                group["company"] = guess_company_from_email(from_email)
            # Any non-noise inbound clears noise if mixed? Keep strictest: if ANY
            # inbound is clean, treat group as clean (person mailed from real addr).
            if noise is None:
                group["noiseClass"] = None
        group["docs"].append(doc)
        group["inboundCount"] += 1

    # Pass 2: attach outbound to existing groups (same counterparty email)
    for doc in docs:
        if (doc.get("direction") or "inbound") != "outbound":
            continue
        if doc.get("ignoredAt"):
            continue
        for key in _identity_keys_for_communication(doc):
            if key in groups:
                groups[key]["docs"].append(doc)

    # Attach decision overlays
    for identity_key, group in groups.items():
        decision = decisions.get(identity_key) or {}
        group["decision"] = decision
        docs_sorted = sorted(
            group["docs"],
            key=lambda d: d.get("createdAt") or "",
            reverse=True,
        )
        group["docs"] = docs_sorted
        if docs_sorted:
            oldest = min(docs_sorted, key=lambda d: d.get("createdAt") or "")
            newest = docs_sorted[0]
            group["firstContactAt"] = oldest.get("createdAt")
            group["lastContactAt"] = newest.get("createdAt")
            group["lastSubject"] = newest.get("subject")
            group["lastPreview"] = newest.get("preview")
        else:
            group["firstContactAt"] = None
            group["lastContactAt"] = None
            group["lastSubject"] = None
            group["lastPreview"] = None

        if decision.get("manualIdentityOverride"):
            override = decision["manualIdentityOverride"] or {}
            for field in ("displayName", "company", "email", "phone"):
                if override.get(field):
                    group[field] = override[field]

    return groups


def _resolve_status(group: dict) -> str:
    decision = group.get("decision") or {}
    decision_status = decision.get("status")
    if decision_status in ("ignored", "associated", "converted"):
        return decision_status
    if group.get("noiseClass"):
        return "automatic"
    return "pending"


def _source_for_docs(docs: List[dict]) -> str:
    providers = {(d.get("provider") or d.get("metadata", {}).get("source") or "") for d in docs}
    providers.discard("")
    if providers == {"gmail"} or (providers and providers <= {"gmail", "email"}):
        return "gmail"
    if len(providers) > 1:
        return "mixed"
    if providers:
        return next(iter(providers)) if next(iter(providers)) in (
            "gmail",
            "email",
            "whatsapp",
            "sms",
            "phone",
        ) else "email"
    return "gmail"


def _to_public(user_id: str, group: dict) -> ProspectPublic:
    identity_key = group["identityKey"]
    decision = group.get("decision") or {}
    status = _resolve_status(group)
    client_id = decision.get("associatedClientId") or decision.get("clientId")
    return ProspectPublic(
        id=prospect_id_for(user_id, identity_key),
        identityKey=identity_key,
        channel=group.get("channel") or "email",
        email=group.get("email"),
        phone=group.get("phone"),
        displayName=group.get("displayName"),
        company=group.get("company"),
        firstContactAt=group.get("firstContactAt"),
        lastContactAt=group.get("lastContactAt"),
        communicationsCount=len(group.get("docs") or []),
        inboundCount=int(group.get("inboundCount") or 0),
        lastSubject=group.get("lastSubject"),
        lastPreview=group.get("lastPreview"),
        source=_source_for_docs(group.get("docs") or []),  # type: ignore[arg-type]
        status=status,  # type: ignore[arg-type]
        clientId=client_id,
        noiseClass=group.get("noiseClass"),
        ignoredAt=decision.get("ignoredAt"),
    )


def _comm_public(doc: dict) -> ProspectCommunicationPublic:
    from_email, from_name, to_emails = _comm_emails(doc)
    return ProspectCommunicationPublic(
        id=doc["id"],
        direction=doc.get("direction"),
        provider=doc.get("provider"),
        subject=doc.get("subject"),
        preview=doc.get("preview"),
        createdAt=doc.get("createdAt") or _now(),
        fromEmail=from_email,
        fromName=from_name,
        toEmails=to_emails,
        externalUrl=doc.get("externalUrl"),
        attachmentsCount=int(doc.get("attachmentsCount") or 0),
        clientId=doc.get("clientId"),
        ignoredAt=doc.get("ignoredAt"),
    )


def _filter_groups(
    groups: Dict[str, dict],
    *,
    status: Optional[str],
    include_automatic: bool,
) -> List[dict]:
    items = list(groups.values())
    wanted = (status or "pending").strip()

    def keep(group: dict) -> bool:
        resolved = _resolve_status(group)
        if wanted == "all":
            if resolved == "automatic" and not include_automatic:
                return False
            return True
        if wanted == "pending":
            return resolved == "pending" and int(group.get("inboundCount") or 0) > 0
        if wanted == "automatic":
            return resolved == "automatic" and int(group.get("inboundCount") or 0) > 0
        return resolved == wanted

    filtered = [g for g in items if keep(g)]
    filtered.sort(key=lambda g: g.get("lastContactAt") or "", reverse=True)
    return filtered


def _empty_group_from_decision(decision: dict) -> dict:
    identity_key = decision["identityKey"]
    channel, value = parse_identity_key(identity_key)
    override = decision.get("manualIdentityOverride") or {}
    return {
        "identityKey": identity_key,
        "channel": channel,
        "email": override.get("email") or (value if channel == "email" else None),
        "phone": override.get("phone") or (value if channel == "phone" else None),
        "displayName": override.get("displayName"),
        "company": override.get("company"),
        "noiseClass": None,
        "docs": [],
        "inboundCount": 0,
        "decision": decision,
        "firstContactAt": decision.get("createdAt"),
        "lastContactAt": decision.get("updatedAt") or decision.get("convertedAt"),
        "lastSubject": None,
        "lastPreview": None,
    }


async def _groups_for_user(db, user_id: str) -> Dict[str, dict]:
    docs = await _load_candidate_communications(db, user_id)
    decisions = await _load_decisions(db, user_id)
    groups = _build_groups(docs, decisions)
    # Decision-only rows (ignored / converted after all messages linked)
    for identity_key, decision in decisions.items():
        if identity_key not in groups:
            try:
                groups[identity_key] = _empty_group_from_decision(decision)
            except ValueError:
                continue
    return groups


async def _find_group(
    db, user_id: str, prospect_id: str
) -> Tuple[str, dict]:
    groups = await _groups_for_user(db, user_id)
    for identity_key, group in groups.items():
        if prospect_id_for(user_id, identity_key) == prospect_id:
            return identity_key, group

    # Decision-only (ignored / converted with no remaining unlinked docs)
    decision = await db[COLLECTION].find_one(
        {"userId": user_id, "id": prospect_id},
        {"_id": 0},
    )
    if decision and decision.get("identityKey"):
        return decision["identityKey"], _empty_group_from_decision(decision)

    raise LookupError("prospect_not_found")


async def count_prospects(
    db,
    user_id: str,
    *,
    status: str = "pending",
    include_automatic: bool = False,
) -> int:
    groups = await _groups_for_user(db, user_id)
    return len(_filter_groups(groups, status=status, include_automatic=include_automatic))


async def list_prospects(
    db,
    user_id: str,
    *,
    limit: int = 20,
    offset: int = 0,
    status: str = "pending",
    include_automatic: bool = False,
) -> ProspectListResponse:
    limit = max(1, min(int(limit), 100))
    offset = max(0, int(offset))
    groups = await _groups_for_user(db, user_id)
    filtered = _filter_groups(groups, status=status, include_automatic=include_automatic)
    page = filtered[offset : offset + limit]
    return ProspectListResponse(
        items=[_to_public(user_id, g) for g in page],
        total=len(filtered),
        offset=offset,
        limit=limit,
    )


async def get_prospect(
    db,
    user_id: str,
    prospect_id: str,
) -> ProspectDetailResponse:
    _, group = await _find_group(db, user_id, prospect_id)
    docs = group.get("docs") or []
    return ProspectDetailResponse(
        prospect=_to_public(user_id, group),
        communications=[_comm_public(d) for d in docs],
        totalCommunications=len(docs),
    )


async def _compatible_communication_ids(
    db,
    user_id: str,
    identity_key: str,
) -> List[str]:
    """All unlinked communications that belong to this identity (inbound + outbound)."""
    docs = await _load_candidate_communications(db, user_id)
    ids: List[str] = []
    seen = set()
    for doc in docs:
        if doc.get("ignoredAt"):
            continue
        keys = _identity_keys_for_communication(doc)
        primary = _primary_email_identity(doc)
        if identity_key in keys or primary == identity_key:
            if doc["id"] not in seen:
                seen.add(doc["id"])
                ids.append(doc["id"])
    return ids


async def _reconcile_actions_after_link(
    db,
    user_id: str,
    client_id: str,
    communication_ids: List[str],
    *,
    client_name: str = "",
) -> None:
    """Attach clientId to open actions and retarget reply_to_prospect after link/convert."""
    if not communication_ids:
        return
    try:
        from action_engine.constants import ACTION_STATUS_PENDING, ACTION_TYPE_REPLY_TO_PROSPECT
    except Exception:
        return

    now = _now()
    await db.actions.update_many(
        {
            "userId": user_id,
            "communicationId": {"$in": list(communication_ids)},
            "status": ACTION_STATUS_PENDING,
        },
        {"$set": {"clientId": client_id, "updatedAt": now}},
    )
    # Prospect intake is done — keep a useful pending reply, retargeted to the client.
    reply_filter = {
        "userId": user_id,
        "communicationId": {"$in": list(communication_ids)},
        "status": ACTION_STATUS_PENDING,
        "type": ACTION_TYPE_REPLY_TO_PROSPECT,
    }
    cursor = db.actions.find(reply_filter, {"_id": 0, "id": 1, "title": 1})
    async for action in cursor:
        title = action.get("title") or "Répondre au prospect"
        new_title = title.replace("Répondre au prospect", "Répondre au client", 1)
        if new_title == title and not title.lower().startswith("répondre"):
            new_title = f"Répondre au client — {client_name}".strip(" —")
        await db.actions.update_one(
            {"userId": user_id, "id": action["id"]},
            {
                "$set": {
                    "title": new_title,
                    "description": "Contact converti en client — répondre depuis la fiche.",
                    "updatedAt": now,
                    "metadata.prospectConverted": True,
                    "metadata.linkedClientId": client_id,
                }
            },
        )


async def associate_prospect(
    db,
    user_id: str,
    prospect_id: str,
    client_id: str,
) -> ProspectAssociateResponse:
    identity_key, group = await _find_group(db, user_id, prospect_id)
    client = await db.clients.find_one({"userId": user_id, "id": client_id}, {"_id": 0})
    if not client:
        raise LookupError("client_not_found")

    display = client_display_name(client)
    comm_ids = await _compatible_communication_ids(db, user_id, identity_key)
    # Always include current group docs (may already be partially linked after reload)
    for doc in group.get("docs") or []:
        if doc["id"] not in comm_ids and not doc.get("clientId") and not doc.get("ignoredAt"):
            comm_ids.append(doc["id"])

    linked = 0
    already_all = True
    for cid in comm_ids:
        result: AssociateResponse = await associate_communication_to_client(
            db, user_id, cid, client_id
        )
        linked += 1
        if not result.alreadyLinked:
            already_all = False

    await _upsert_decision(
        db,
        user_id,
        identity_key,
        {
            "status": "associated",
            "associatedClientId": client_id,
        },
    )
    await db[COLLECTION].update_one(
        {"userId": user_id, "identityKey": identity_key},
        {"$unset": {"ignoredAt": "", "ignoredBy": "", "convertedAt": ""}},
    )
    await _reconcile_actions_after_link(
        db, user_id, client_id, comm_ids, client_name=display
    )

    return ProspectAssociateResponse(
        prospectId=prospect_id,
        clientId=client_id,
        clientName=display,
        linkedCommunications=linked,
        alreadyLinked=already_all and linked > 0,
    )


async def ignore_prospect(
    db,
    user_id: str,
    prospect_id: str,
) -> ProspectIgnoreResponse:
    identity_key, group = await _find_group(db, user_id, prospect_id)
    now = _now()
    await _upsert_decision(
        db,
        user_id,
        identity_key,
        {
            "status": "ignored",
            "ignoredAt": now,
            "ignoredBy": "user",
        },
    )
    # Mark current unlinked communications ignored so Action Engine / UI stay aligned.
    comm_ids = [
        doc["id"]
        for doc in (group.get("docs") or [])
        if doc.get("id") and not doc.get("clientId")
    ]
    if comm_ids:
        await db.communications.update_many(
            {
                "userId": user_id,
                "id": {"$in": comm_ids},
                "$or": [{"clientId": None}, {"clientId": ""}, {"clientId": {"$exists": False}}],
            },
            {
                "$set": {
                    "ignoredAt": now,
                    "status": "ignored",
                    "updatedAt": now,
                    "metadata.ignoredVia": "prospect",
                }
            },
        )
        try:
            from action_engine.constants import (
                ACTION_STATUS_DISMISSED,
                ACTION_STATUS_PENDING,
                ACTION_TYPE_REPLY_TO_PROSPECT,
            )

            await db.actions.update_many(
                {
                    "userId": user_id,
                    "communicationId": {"$in": comm_ids},
                    "status": ACTION_STATUS_PENDING,
                    "type": ACTION_TYPE_REPLY_TO_PROSPECT,
                },
                {
                    "$set": {
                        "status": ACTION_STATUS_DISMISSED,
                        "updatedAt": now,
                        "metadata.dismissedReason": "prospect_ignored",
                    }
                },
            )
        except Exception:
            pass
    return ProspectIgnoreResponse(prospectId=prospect_id, ignoredAt=now, status="ignored")


async def restore_prospect(
    db,
    user_id: str,
    prospect_id: str,
) -> ProspectRestoreResponse:
    identity_key, _group = await _find_group(db, user_id, prospect_id)
    decision = await _get_decision(db, user_id, identity_key)
    if not decision:
        return ProspectRestoreResponse(prospectId=prospect_id, restored=True, status="pending")

    now = _now()
    await db[COLLECTION].update_one(
        {"userId": user_id, "identityKey": identity_key},
        {
            "$set": {"status": "pending", "updatedAt": now},
            "$unset": {
                "ignoredAt": "",
                "ignoredBy": "",
                "associatedClientId": "",
                "convertedAt": "",
            },
        },
    )
    # Clear ignore flags applied via prospect ignore (docs may be absent from group
    # because ignoredAt excludes them from grouping — match by identity email/phone).
    channel, value = parse_identity_key(identity_key)
    or_identity: List[dict] = []
    if channel == "email" and value:
        or_identity.append({"metadata.fromEmail": value})
        or_identity.append({"metadata.fromEmail": value.lower()})
    if channel == "phone" and value:
        or_identity.append({"metadata.phone": value})
        or_identity.append({"metadata.fromPhone": value})
        or_identity.append({"metadata.detectedPhone": value})
    restored_comm_ids: List[str] = []
    if or_identity:
        restored_docs = await db.communications.find(
            {
                "userId": user_id,
                "metadata.ignoredVia": "prospect",
                "$or": or_identity,
            },
            {"_id": 0},
        ).to_list(200)
        restored_comm_ids = [doc["id"] for doc in restored_docs if doc.get("id")]
        await db.communications.update_many(
            {
                "userId": user_id,
                "metadata.ignoredVia": "prospect",
                "$or": or_identity,
            },
            {
                "$set": {"status": "unlinked", "updatedAt": now},
                "$unset": {"ignoredAt": "", "metadata.ignoredVia": ""},
            },
        )
        # Re-open actions dismissed by ignore (unique idempotencyKey blocks re-insert).
        try:
            from action_engine.constants import (
                ACTION_STATUS_DISMISSED,
                ACTION_STATUS_PENDING,
                ACTION_TYPE_REPLY_TO_PROSPECT,
            )

            if restored_comm_ids:
                await db.actions.update_many(
                    {
                        "userId": user_id,
                        "communicationId": {"$in": restored_comm_ids},
                        "status": ACTION_STATUS_DISMISSED,
                        "type": ACTION_TYPE_REPLY_TO_PROSPECT,
                        "metadata.dismissedReason": "prospect_ignored",
                    },
                    {
                        "$set": {
                            "status": ACTION_STATUS_PENDING,
                            "updatedAt": now,
                        },
                        "$unset": {
                            "metadata.dismissedReason": "",
                            "completedAt": "",
                        },
                    },
                )
        except Exception:
            pass
        # Fallback: evaluate any communication that still has no pending reply action.
        try:
            from action_engine.engine import safe_evaluate_communication

            for doc in restored_docs:
                fresh = dict(doc)
                fresh.pop("ignoredAt", None)
                meta = dict(fresh.get("metadata") or {})
                meta.pop("ignoredVia", None)
                fresh["metadata"] = meta
                fresh["status"] = "unlinked"
                await safe_evaluate_communication(db, fresh)
        except Exception:
            pass
    return ProspectRestoreResponse(prospectId=prospect_id, restored=True, status="pending")


def _prefill_from_group(group: dict) -> dict:
    email = group.get("email")
    return {
        "name": group.get("displayName") or group.get("company") or "Nouveau client",
        "contactName": group.get("displayName"),
        "email": email,
        "phone": group.get("phone"),
        "company": group.get("company") or guess_company_from_email(email),
    }


async def create_client_from_prospect(
    db,
    user_id: str,
    prospect_id: str,
    body: Optional[ProspectCreateClientRequest] = None,
) -> ProspectCreateClientResponse:
    identity_key, group = await _find_group(db, user_id, prospect_id)
    if _resolve_status(group) == "ignored":
        raise ValueError("prospect_ignored")

    prefill = _prefill_from_group(group)
    overrides = body.model_dump(exclude_none=True) if body else {}
    merged = {**prefill, **overrides}
    email = merged.get("email")

    duplicate = await find_duplicate_client_by_email(db, user_id, email)
    if duplicate:
        association = await associate_prospect(db, user_id, prospect_id, duplicate["id"])
        await _upsert_decision(
            db,
            user_id,
            identity_key,
            {
                "status": "associated",
                "associatedClientId": duplicate["id"],
            },
        )
        return ProspectCreateClientResponse(
            prospectId=prospect_id,
            client=client_public(duplicate).model_dump(),
            association=association,
            duplicateClientId=duplicate["id"],
        )

    create_body = ClientCreate(
        name=merged.get("name") or "Nouveau client",
        contactName=merged.get("contactName"),
        email=email,
        phone=merged.get("phone"),
        company=merged.get("company"),
        status="active",
    )
    doc = build_client_document(user_id, create_body)
    note = f"Créé depuis prospect ({group.get('email') or identity_key})"
    if doc.get("notes"):
        doc["notes"] = f"{doc['notes']}\n{note}"
    else:
        doc["notes"] = note

    await db.clients.insert_one(doc)
    await record_event(
        db,
        user_id,
        "client_created",
        "client",
        doc["id"],
        client_id=doc["id"],
        metadata={
            "clientName": client_display_name(doc),
            "source": "prospect",
            "prospectId": prospect_id,
            "identityKey": identity_key,
        },
    )

    association = await associate_prospect(db, user_id, prospect_id, doc["id"])
    await _upsert_decision(
        db,
        user_id,
        identity_key,
        {
            "status": "converted",
            "associatedClientId": doc["id"],
            "convertedAt": _now(),
        },
    )

    return ProspectCreateClientResponse(
        prospectId=prospect_id,
        client=client_public(doc).model_dump(),
        association=association,
        duplicateClientId=None,
    )
