"""Phone Hub V2 — manual associate / create-client / spam for phone communications."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from client_models import ClientCreate
from client_service import build_client_document, client_display_name, client_public
from events import record_event
from phone.models import (
    PhoneAssociateResponse,
    PhoneCreateClientRequest,
    PhoneCreateClientResponse,
    PhoneSpamResponse,
)
from phone.normalizer import PhoneNormalizer
from prospects.identity import identity_key_for_phone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_phone_comm(db, user_id: str, communication_id: str) -> dict:
    doc = await db.communications.find_one(
        {"userId": user_id, "id": communication_id, "type": "phone"},
        {"_id": 0},
    )
    if not doc:
        raise LookupError("call_not_found")
    return doc


async def _compatible_phone_comm_ids(db, user_id: str, normalized: str) -> List[str]:
    if not normalized:
        return []
    cursor = db.communications.find(
        {
            "userId": user_id,
            "type": "phone",
            "metadata.normalizedPhone": normalized,
            "$or": [
                {"clientId": None},
                {"clientId": {"$exists": False}},
                {"clientId": ""},
            ],
        },
        {"_id": 0, "id": 1},
    )
    return [d["id"] async for d in cursor if d.get("id")]


async def _link_one(
    db,
    user_id: str,
    communication_id: str,
    client_id: str,
    *,
    client_name: str,
) -> bool:
    """Link one phone communication. Returns True if newly linked."""
    comm = await _get_phone_comm(db, user_id, communication_id)
    already = comm.get("clientId") == client_id and not comm.get("ignoredAt")
    now = _now()
    meta = dict(comm.get("metadata") or {})
    meta["clientName"] = client_name
    meta["linkedBy"] = "manual"
    meta["linkedAt"] = now
    meta["matchedBy"] = "manual"

    await db.communications.update_one(
        {"userId": user_id, "id": communication_id},
        {
            "$set": {
                "clientId": client_id,
                "metadata": meta,
                "updatedAt": now,
                "status": "linked",
            },
            "$unset": {"ignoredAt": ""},
        },
    )

    try:
        from communication_hub.conversation_engine import (
            after_communication_upsert,
            retarget_conversations_for_communications,
        )

        linked_doc = {
            **comm,
            "clientId": client_id,
            "metadata": meta,
            "status": "linked",
        }
        if not linked_doc.get("conversationId"):
            linked_doc = await after_communication_upsert(db, linked_doc)
        await retarget_conversations_for_communications(
            db,
            user_id,
            [communication_id],
            client_id=client_id,
            client_name=client_name,
        )
    except Exception:
        pass

    # Keep pending call_back / reply actions and attach clientId
    try:
        from action_engine.constants import ACTION_STATUS_PENDING

        await db.actions.update_many(
            {
                "userId": user_id,
                "communicationId": communication_id,
                "status": ACTION_STATUS_PENDING,
            },
            {"$set": {"clientId": client_id, "updatedAt": now}},
        )
    except Exception:
        pass

    return not already


async def associate_call_to_client(
    db,
    user_id: str,
    communication_id: str,
    client_id: str,
) -> PhoneAssociateResponse:
    comm = await _get_phone_comm(db, user_id, communication_id)
    client = await db.clients.find_one({"userId": user_id, "id": client_id}, {"_id": 0})
    if not client:
        raise LookupError("client_not_found")

    display = client_display_name(client)
    meta = comm.get("metadata") or {}
    normalized = meta.get("normalizedPhone") or PhoneNormalizer.normalize_phone(
        meta.get("phoneNumber")
    )

    # Ensure client has this phone for future exact matches
    if normalized:
        existing_phones = []
        if client.get("phone"):
            existing_phones.append(PhoneNormalizer.normalize_phone(client.get("phone")))
        for item in client.get("phones") or []:
            if isinstance(item, dict) and item.get("value"):
                existing_phones.append(PhoneNormalizer.normalize_phone(item["value"]))
        if normalized not in existing_phones:
            phones = list(client.get("phones") or [])
            phones.append({"value": meta.get("phoneNumber") or normalized, "label": "mobile"})
            updates = {"phones": phones, "updatedAt": _now()}
            if not client.get("phone"):
                updates["phone"] = meta.get("phoneNumber") or normalized
            await db.clients.update_one(
                {"userId": user_id, "id": client_id},
                {"$set": updates},
            )

    ids = await _compatible_phone_comm_ids(db, user_id, normalized)
    if communication_id not in ids:
        ids.insert(0, communication_id)

    linked = 0
    already_all = True
    for cid in ids:
        newly = await _link_one(db, user_id, cid, client_id, client_name=display)
        linked += 1
        if newly:
            already_all = False

    # Prospect decision overlay
    identity_key = identity_key_for_phone(normalized)
    if identity_key:
        try:
            from prospects.service import _upsert_decision, prospect_id_for

            await _upsert_decision(
                db,
                user_id,
                identity_key,
                {"status": "associated", "associatedClientId": client_id},
            )
            _ = prospect_id_for
        except Exception:
            pass

    await db.clients.update_one(
        {"userId": user_id, "id": client_id},
        {"$set": {"updatedAt": _now(), "lastActivityAt": _now()}},
    )

    return PhoneAssociateResponse(
        communicationId=communication_id,
        clientId=client_id,
        clientName=display,
        linkedCommunications=linked,
        alreadyLinked=already_all and linked > 0,
    )


async def create_client_from_call(
    db,
    user_id: str,
    communication_id: str,
    body: Optional[PhoneCreateClientRequest] = None,
) -> PhoneCreateClientResponse:
    comm = await _get_phone_comm(db, user_id, communication_id)
    meta = comm.get("metadata") or {}
    phone = meta.get("phoneNumber") or meta.get("fromPhone") or meta.get("toPhone")
    name = (
        (body.name if body and body.name else None)
        or meta.get("counterpartyName")
        or meta.get("fromName")
        or phone
        or "Nouveau client"
    )
    create_body = ClientCreate(
        name=name,
        contactName=(body.contactName if body else None) or meta.get("counterpartyName"),
        email=(body.email if body else None),
        phone=(body.phone if body and body.phone else None) or phone,
        company=(body.company if body else None),
        status="active",
    )
    doc = build_client_document(user_id, create_body)
    note = f"Créé depuis appel ({phone or communication_id})"
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
            "source": "phone_call",
            "communicationId": communication_id,
        },
    )

    association = await associate_call_to_client(db, user_id, communication_id, doc["id"])

    # Mark prospect converted
    normalized = meta.get("normalizedPhone") or PhoneNormalizer.normalize_phone(phone)
    identity_key = identity_key_for_phone(normalized)
    if identity_key:
        try:
            from prospects.service import _upsert_decision

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
        except Exception:
            pass

    return PhoneCreateClientResponse(
        communicationId=communication_id,
        client=client_public(doc).model_dump(),
        association=association,
    )


async def mark_call_spam(
    db,
    user_id: str,
    communication_id: str,
) -> PhoneSpamResponse:
    comm = await _get_phone_comm(db, user_id, communication_id)
    now = _now()
    meta = dict(comm.get("metadata") or {})
    normalized = meta.get("normalizedPhone") or ""
    meta["status"] = "spam"
    meta["missed"] = False
    meta["missedCall"] = False

    ids = await _compatible_phone_comm_ids(db, user_id, normalized) if normalized else []
    if communication_id not in ids:
        ids.append(communication_id)

    await db.communications.update_many(
        {"userId": user_id, "id": {"$in": ids}},
        {
            "$set": {
                "status": "ignored",
                "ignoredAt": now,
                "updatedAt": now,
                "metadata.status": "spam",
                "metadata.missed": False,
                "metadata.missedCall": False,
            }
        },
    )

    # Dismiss pending call_back for these communications
    try:
        from action_engine.constants import (
            ACTION_STATUS_DISMISSED,
            ACTION_STATUS_PENDING,
            ACTION_TYPE_CALL_BACK,
        )

        await db.actions.update_many(
            {
                "userId": user_id,
                "communicationId": {"$in": ids},
                "status": ACTION_STATUS_PENDING,
                "type": ACTION_TYPE_CALL_BACK,
            },
            {
                "$set": {
                    "status": ACTION_STATUS_DISMISSED,
                    "updatedAt": now,
                    "metadata.dismissedReason": "spam",
                }
            },
        )
    except Exception:
        pass

    identity_key = identity_key_for_phone(normalized)
    if identity_key:
        try:
            from prospects.service import _upsert_decision

            await _upsert_decision(
                db,
                user_id,
                identity_key,
                {"status": "ignored", "ignoredAt": now, "ignoredBy": "spam"},
            )
        except Exception:
            pass

    return PhoneSpamResponse(communicationId=communication_id, status="spam", ignoredAt=now)
