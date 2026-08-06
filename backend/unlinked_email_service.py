"""Unlinked email inbox — link / ignore / suggest / create-from-email.

Builds on Communication Center (``db.communications``) as source of truth.
Does not invent a second communications model.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from client_models import ClientCreate
from client_service import build_client_document, client_display_name, client_public
from events import record_event
from integrations.email_matching import (
    communication_to_remote_message,
    counterparty_emails,
    is_suggestion_displayable,
    suggest_client_for_email,
)
from integrations.matching import normalize_email_loose


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- Query helpers -----------------------------------------------------------


def unlinked_email_query(user_id: str) -> dict:
    """Emails without client, not ignored."""
    return {
        "userId": user_id,
        "type": "email",
        "$and": [
            {"$or": [{"clientId": None}, {"clientId": {"$exists": False}}, {"clientId": ""}]},
            {"$or": [{"ignoredAt": None}, {"ignoredAt": {"$exists": False}}]},
        ],
    }


def linked_email_query(user_id: str) -> dict:
    return {
        "userId": user_id,
        "type": "email",
        "clientId": {"$exists": True, "$nin": [None, ""]},
    }


# --- Public models -----------------------------------------------------------


class ClientSuggestionPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    clientId: str
    clientName: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    reason: str
    confidence: str


class UnlinkedEmailPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    type: str = "email"
    direction: Optional[str] = None
    provider: Optional[str] = None
    subject: Optional[str] = None
    preview: Optional[str] = None
    createdAt: str
    attachmentsCount: int = 0
    externalUrl: Optional[str] = None
    fromEmail: Optional[str] = None
    fromName: Optional[str] = None
    toEmails: List[str] = Field(default_factory=list)
    accountEmail: Optional[str] = None
    ignoredAt: Optional[str] = None
    status: str = "unlinked"  # unlinked | ignored | linked
    suggestion: Optional[ClientSuggestionPublic] = None


class UnlinkedEmailListResponse(BaseModel):
    items: List[UnlinkedEmailPublic]
    total: int
    offset: int = 0
    limit: int = 20


class UnlinkedCountResponse(BaseModel):
    total: int


class AssociateRequest(BaseModel):
    clientId: str = Field(..., min_length=1, max_length=80)


class AssociateResponse(BaseModel):
    communicationId: str
    clientId: str
    clientName: str
    alreadyLinked: bool = False


class IgnoreResponse(BaseModel):
    communicationId: str
    ignoredAt: str


class RestoreResponse(BaseModel):
    communicationId: str
    restored: bool = True


class CreateClientFromEmailRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    contactName: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=200)


class CreateClientFromEmailResponse(BaseModel):
    client: dict
    association: AssociateResponse
    duplicateClientId: Optional[str] = None


# --- Serialization -----------------------------------------------------------


def _client_suggestion_public(client: dict, reason: str, confidence: str) -> ClientSuggestionPublic:
    email = client.get("email")
    if not email:
        emails = client.get("emails") or []
        if emails and isinstance(emails[0], dict):
            email = emails[0].get("value")
    phone = client.get("phone")
    if not phone:
        phones = client.get("phones") or []
        if phones and isinstance(phones[0], dict):
            phone = phones[0].get("value")
    return ClientSuggestionPublic(
        clientId=client["id"],
        clientName=client_display_name(client),
        email=email,
        phone=phone,
        company=client.get("company"),
        reason=reason,
        confidence=confidence,
    )


def _unlinked_public(doc: dict, suggestion: Optional[ClientSuggestionPublic] = None) -> UnlinkedEmailPublic:
    meta = doc.get("metadata") or {}
    to_emails = list(meta.get("toEmails") or [])
    if meta.get("toEmail") and meta["toEmail"] not in to_emails:
        to_emails.insert(0, meta["toEmail"])
    ignored_at = doc.get("ignoredAt")
    client_id = doc.get("clientId")
    if ignored_at:
        status = "ignored"
    elif client_id:
        status = "linked"
    else:
        status = "unlinked"
    return UnlinkedEmailPublic(
        id=doc["id"],
        type=str(doc.get("type") or "email"),
        direction=doc.get("direction"),
        provider=doc.get("provider"),
        subject=doc.get("subject"),
        preview=doc.get("preview"),
        createdAt=doc.get("createdAt") or _now(),
        attachmentsCount=int(doc.get("attachmentsCount") or 0),
        externalUrl=doc.get("externalUrl"),
        fromEmail=meta.get("fromEmail"),
        fromName=meta.get("fromName"),
        toEmails=to_emails,
        accountEmail=meta.get("accountEmail"),
        ignoredAt=ignored_at,
        status=status,
        suggestion=suggestion,
    )


# --- Core operations ---------------------------------------------------------


async def count_unlinked_emails(db, user_id: str) -> int:
    return await db.communications.count_documents(unlinked_email_query(user_id))


async def _load_user_clients(db, user_id: str) -> List[dict]:
    cursor = db.clients.find({"userId": user_id}, {"_id": 0})
    return [doc async for doc in cursor]


def _build_suggestion(clients: List[dict], doc: dict) -> Optional[ClientSuggestionPublic]:
    meta = doc.get("metadata") or {}
    if meta.get("suggestionDismissedAt"):
        return None
    message = communication_to_remote_message(doc)
    account_email = meta.get("accountEmail")
    client, reason, confidence = suggest_client_for_email(
        clients, message, account_email=account_email, metadata=meta
    )
    if not client or not is_suggestion_displayable(confidence):
        return None
    return _client_suggestion_public(client, reason, confidence)


async def list_unlinked_emails(
    db,
    user_id: str,
    *,
    limit: int = 20,
    offset: int = 0,
    include_ignored: bool = False,
    link_status: Optional[str] = None,
) -> UnlinkedEmailListResponse:
    """List emails by link status.

    Default: unlinked (or unlinked+ignored if include_ignored).
    link_status overrides: unlinked | linked | ignored | all
    """
    limit = max(1, min(int(limit), 100))
    offset = max(0, int(offset))
    status = (link_status or ("unlinked" if not include_ignored else "all_unlinked")).strip()

    if status == "linked":
        query = linked_email_query(user_id)
    elif status == "ignored":
        query = {
            "userId": user_id,
            "type": "email",
            "ignoredAt": {"$exists": True, "$nin": [None, ""]},
        }
    elif status == "all":
        query = {"userId": user_id, "type": "email"}
    elif status == "all_unlinked" or include_ignored:
        query = {
            "userId": user_id,
            "type": "email",
            "$or": [{"clientId": None}, {"clientId": {"$exists": False}}, {"clientId": ""}],
        }
    else:
        query = unlinked_email_query(user_id)

    total = await db.communications.count_documents(query)
    cursor = (
        db.communications.find(query, {"_id": 0})
        .sort("createdAt", -1)
        .skip(offset)
        .limit(limit)
    )
    docs = [doc async for doc in cursor]
    need_suggestions = any(not d.get("clientId") and not d.get("ignoredAt") for d in docs)
    clients = await _load_user_clients(db, user_id) if need_suggestions else []
    items = []
    for doc in docs:
        suggestion = None
        if not doc.get("clientId") and not doc.get("ignoredAt"):
            suggestion = _build_suggestion(clients, doc)
        items.append(_unlinked_public(doc, suggestion))
    return UnlinkedEmailListResponse(items=items, total=total, offset=offset, limit=limit)


async def _get_owned_communication(db, user_id: str, communication_id: str) -> dict:
    doc = await db.communications.find_one(
        {"userId": user_id, "id": communication_id},
        {"_id": 0},
    )
    if not doc:
        raise LookupError("communication_not_found")
    return doc


async def _get_owned_client(db, user_id: str, client_id: str) -> dict:
    doc = await db.clients.find_one({"userId": user_id, "id": client_id}, {"_id": 0})
    if not doc:
        raise LookupError("client_not_found")
    return doc


async def _sync_email_message_client(
    db,
    user_id: str,
    comm: dict,
    client: dict,
) -> None:
    meta = comm.get("metadata") or {}
    email_message_id = meta.get("emailMessageId")
    provider = comm.get("provider")
    provider_id = comm.get("providerId")
    now = _now()
    set_fields = {
        "clientId": client["id"],
        "clientName": client_display_name(client),
        "matchedBy": "manual",
        "updatedAt": now,
    }
    if email_message_id:
        await db.email_messages.update_one(
            {"userId": user_id, "id": email_message_id},
            {"$set": set_fields},
        )
    elif provider and provider_id:
        await db.email_messages.update_one(
            {"userId": user_id, "provider": provider, "providerMessageId": provider_id},
            {"$set": set_fields},
        )


async def _ensure_timeline_event(db, user_id: str, comm: dict, client: dict) -> None:
    """Record at most one email_* event for this communication/email message."""
    meta = comm.get("metadata") or {}
    email_message_id = meta.get("emailMessageId") or comm.get("id")
    direction = comm.get("direction") or "inbound"
    event_type = "email_sent" if direction == "outbound" else "email_received"

    existing = await db.events.find_one(
        {
            "userId": user_id,
            "type": {"$in": ["email_sent", "email_received"]},
            "$or": [
                {"entityId": email_message_id},
                {"metadata.communicationId": comm["id"]},
                {"metadata.providerMessageId": comm.get("providerId")},
            ],
        },
        {"_id": 0, "id": 1, "clientId": 1},
    )
    if existing:
        if existing.get("clientId") != client["id"]:
            await db.events.update_one(
                {"userId": user_id, "id": existing["id"]},
                {
                    "$set": {
                        "clientId": client["id"],
                        "metadata.clientName": client_display_name(client),
                        "metadata.linkedBy": "manual",
                    }
                },
            )
        return

    await record_event(
        db,
        user_id,
        event_type,
        "email",
        str(email_message_id),
        client_id=client["id"],
        metadata={
            "subject": comm.get("subject"),
            "excerpt": comm.get("preview"),
            "clientName": client_display_name(client),
            "fromEmail": meta.get("fromEmail"),
            "toEmail": meta.get("toEmail"),
            "direction": direction,
            "threadId": meta.get("threadId"),
            "provider": comm.get("provider"),
            "channel": "email",
            "gmailUrl": comm.get("externalUrl"),
            "attachmentCount": comm.get("attachmentsCount") or 0,
            "communicationId": comm["id"],
            "providerMessageId": comm.get("providerId"),
            "linkedBy": "manual",
        },
    )


async def associate_communication_to_client(
    db,
    user_id: str,
    communication_id: str,
    client_id: str,
) -> AssociateResponse:
    """Link an email communication to a client (idempotent)."""
    comm = await _get_owned_communication(db, user_id, communication_id)
    if comm.get("type") != "email":
        raise ValueError("not_an_email")

    client = await _get_owned_client(db, user_id, client_id)
    display = client_display_name(client)
    now = _now()

    already = comm.get("clientId") == client_id
    if already and not comm.get("ignoredAt"):
        return AssociateResponse(
            communicationId=communication_id,
            clientId=client_id,
            clientName=display,
            alreadyLinked=True,
        )

    meta = dict(comm.get("metadata") or {})
    meta["clientName"] = display
    meta["linkedBy"] = "manual"
    meta["linkedAt"] = now
    meta.pop("suggestionDismissedAt", None)

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

    await _sync_email_message_client(db, user_id, {**comm, "metadata": meta}, client)
    await _ensure_timeline_event(db, user_id, {**comm, "metadata": meta}, client)

    await db.clients.update_one(
        {"userId": user_id, "id": client_id},
        {"$set": {"updatedAt": now, "lastActivityAt": now}},
    )

    try:
        from memory_intelligence.service import invalidate_user_cache

        await invalidate_user_cache(db, user_id)
    except Exception:
        pass

    return AssociateResponse(
        communicationId=communication_id,
        clientId=client_id,
        clientName=display,
        alreadyLinked=already,
    )


async def ignore_communication(db, user_id: str, communication_id: str) -> IgnoreResponse:
    comm = await _get_owned_communication(db, user_id, communication_id)
    if comm.get("type") != "email":
        raise ValueError("not_an_email")
    now = _now()
    if comm.get("ignoredAt"):
        return IgnoreResponse(communicationId=communication_id, ignoredAt=comm["ignoredAt"])

    await db.communications.update_one(
        {"userId": user_id, "id": communication_id},
        {"$set": {"ignoredAt": now, "status": "ignored", "updatedAt": now}},
    )
    return IgnoreResponse(communicationId=communication_id, ignoredAt=now)


async def restore_communication(db, user_id: str, communication_id: str) -> RestoreResponse:
    comm = await _get_owned_communication(db, user_id, communication_id)
    if not comm.get("ignoredAt"):
        return RestoreResponse(communicationId=communication_id, restored=True)

    restored_status = "linked" if comm.get("clientId") else "unlinked"
    await db.communications.update_one(
        {"userId": user_id, "id": communication_id},
        {
            "$unset": {"ignoredAt": ""},
            "$set": {"updatedAt": _now(), "status": restored_status},
        },
    )
    return RestoreResponse(communicationId=communication_id, restored=True)


async def dismiss_suggestion(db, user_id: str, communication_id: str) -> dict:
    """Ignore only the suggestion (keep email in Non classés)."""
    comm = await _get_owned_communication(db, user_id, communication_id)
    meta = dict(comm.get("metadata") or {})
    meta["suggestionDismissedAt"] = _now()
    await db.communications.update_one(
        {"userId": user_id, "id": communication_id},
        {"$set": {"metadata": meta, "updatedAt": _now()}},
    )
    return {"communicationId": communication_id, "dismissed": True}


async def find_duplicate_client_by_email(db, user_id: str, email: Optional[str]) -> Optional[dict]:
    import re

    normalized = normalize_email_loose(email)
    if not normalized:
        return None
    pattern = {"$regex": f"^{re.escape(normalized)}$", "$options": "i"}
    return await db.clients.find_one(
        {
            "userId": user_id,
            "$or": [
                {"email": pattern},
                {"emails.value": pattern},
            ],
        },
        {"_id": 0},
    )


def prefill_from_communication(doc: dict) -> dict:
    """Derive client create fields from an unlinked email."""
    meta = doc.get("metadata") or {}
    message = communication_to_remote_message(doc)
    account = meta.get("accountEmail")
    counterparts = list(counterparty_emails(message, account_email=account))
    primary_email = counterparts[0] if counterparts else None
    name = (meta.get("fromName") or "").strip()
    if not name and primary_email:
        name = primary_email.split("@")[0].replace(".", " ").replace("_", " ").title()
    company = None
    if primary_email and "@" in primary_email:
        domain = primary_email.split("@", 1)[1]
        free = {
            "gmail.com",
            "googlemail.com",
            "yahoo.fr",
            "yahoo.com",
            "hotmail.com",
            "outlook.com",
            "orange.fr",
            "free.fr",
            "laposte.net",
            "icloud.com",
        }
        if domain not in free:
            company = domain.split(".")[0].replace("-", " ").title()
    return {
        "name": name or "Nouveau client",
        "contactName": (meta.get("fromName") or "").strip() or None,
        "email": primary_email,
        "phone": meta.get("phone") or meta.get("fromPhone"),
        "company": company,
    }


async def create_client_from_communication(
    db,
    user_id: str,
    communication_id: str,
    body: Optional[CreateClientFromEmailRequest] = None,
) -> CreateClientFromEmailResponse:
    comm = await _get_owned_communication(db, user_id, communication_id)
    if comm.get("type") != "email":
        raise ValueError("not_an_email")

    prefill = prefill_from_communication(comm)
    overrides = body.model_dump(exclude_none=True) if body else {}
    merged = {**prefill, **overrides}
    email = merged.get("email")

    duplicate = await find_duplicate_client_by_email(db, user_id, email)
    if duplicate:
        association = await associate_communication_to_client(
            db, user_id, communication_id, duplicate["id"]
        )
        return CreateClientFromEmailResponse(
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
    meta_note = f"Créé depuis e-mail Gmail ({(comm.get('subject') or '')[:80]})"
    if doc.get("notes"):
        doc["notes"] = f"{doc['notes']}\n{meta_note}"
    else:
        doc["notes"] = meta_note

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
            "source": "gmail_unlinked_email",
            "communicationId": communication_id,
        },
    )

    association = await associate_communication_to_client(db, user_id, communication_id, doc["id"])
    return CreateClientFromEmailResponse(
        client=client_public(doc).model_dump(),
        association=association,
        duplicateClientId=None,
    )
