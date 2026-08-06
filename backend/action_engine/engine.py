"""Action Engine — evaluate facts and persist actions idempotently."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple  # noqa: F401 — List used by call_back completion

from pymongo.errors import DuplicateKeyError

from action_engine.config import action_engine_enabled
from action_engine.constants import ACTION_STATUS_PENDING
from action_engine.models import ActionPublic
from action_engine.rules import propose_actions
from observability import get_logger

logger = get_logger(__name__)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def action_public(doc: dict) -> ActionPublic:
    return ActionPublic(
        id=doc["id"],
        userId=doc["userId"],
        clientId=doc.get("clientId"),
        communicationId=doc.get("communicationId"),
        eventId=doc.get("eventId"),
        type=doc.get("type") or "",
        priority=doc.get("priority") or "normal",  # type: ignore[arg-type]
        status=doc.get("status") or ACTION_STATUS_PENDING,  # type: ignore[arg-type]
        source=doc.get("source") or "system",
        createdAt=doc.get("createdAt") or _utc_now_iso(),
        dueAt=doc.get("dueAt"),
        completedAt=doc.get("completedAt"),
        snoozedUntil=doc.get("snoozedUntil"),
        snoozedAt=doc.get("snoozedAt"),
        snoozedBy=doc.get("snoozedBy"),
        previousDueAt=doc.get("previousDueAt"),
        title=doc.get("title") or "",
        description=doc.get("description"),
        metadata=dict(doc.get("metadata") or {}),
        idempotencyKey=doc.get("idempotencyKey") or "",
    )


async def persist_proposals(
    db,
    proposals: List[Dict[str, Any]],
) -> Tuple[List[dict], int]:
    """Insert proposals; skip duplicates via unique (userId, idempotencyKey)."""
    created: List[dict] = []
    skipped = 0
    now = _utc_now_iso()
    for proposal in proposals:
        user_id = proposal.get("userId")
        key = proposal.get("idempotencyKey")
        if not user_id or not key:
            skipped += 1
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "clientId": proposal.get("clientId"),
            "communicationId": proposal.get("communicationId"),
            "eventId": proposal.get("eventId"),
            "type": proposal["type"],
            "priority": proposal.get("priority") or "normal",
            "status": ACTION_STATUS_PENDING,
            "source": proposal.get("source") or "system",
            "createdAt": now,
            "dueAt": proposal.get("dueAt"),
            "completedAt": None,
            "title": proposal.get("title") or "",
            "description": proposal.get("description"),
            "metadata": dict(proposal.get("metadata") or {}),
            "idempotencyKey": key,
            "updatedAt": now,
        }
        try:
            await db.actions.insert_one(doc)
            created.append(doc)
        except DuplicateKeyError:
            skipped += 1
        except Exception:
            logger.exception(
                "action_engine_persist_failed type=%s key=%s",
                proposal.get("type"),
                key,
            )
            skipped += 1
    return created, skipped


async def evaluate_fact(db, fact: Dict[str, Any]) -> Dict[str, Any]:
    """Run all rules on a fact and persist resulting actions."""
    if not action_engine_enabled():
        return {"created": 0, "skipped": 0, "actions": []}
    proposals = propose_actions(fact)
    created, skipped = await persist_proposals(db, proposals)
    if created:
        logger.info(
            "action_engine_created count=%s types=%s",
            len(created),
            ",".join(sorted({c.get("type") or "" for c in created})),
        )
    return {
        "created": len(created),
        "skipped": skipped,
        "actions": [action_public(c) for c in created],
    }


async def _complete_matching_call_backs(db, communication: dict) -> int:
    """Outgoing completed/answered call auto-completes pending call_back for same phone/client."""
    if (communication.get("type") or "") != "phone":
        return 0
    if (communication.get("direction") or "") != "outbound":
        return 0
    meta = communication.get("metadata") or {}
    status = (meta.get("status") or "").lower()
    if status in {"missed", "failed", "busy", "spam", "blocked", "rejected"}:
        return 0

    from action_engine.constants import (
        ACTION_STATUS_COMPLETED,
        ACTION_STATUS_PENDING,
        ACTION_TYPE_CALL_BACK,
    )

    user_id = communication["userId"]
    now = _utc_now_iso()
    filters: List[Dict[str, Any]] = []
    client_id = communication.get("clientId")
    normalized = (meta.get("normalizedPhone") or "").strip()
    conv_id = (communication.get("conversationId") or "").strip()
    if client_id:
        filters.append({"clientId": client_id})
    if normalized:
        filters.append({"metadata.normalizedPhone": normalized})
    if conv_id:
        filters.append({"metadata.conversationId": conv_id})
    if not filters:
        return 0

    query = {
        "userId": user_id,
        "type": ACTION_TYPE_CALL_BACK,
        "status": ACTION_STATUS_PENDING,
        "$or": filters,
    }
    result = await db.actions.update_many(
        query,
        {
            "$set": {
                "status": ACTION_STATUS_COMPLETED,
                "completedAt": now,
                "updatedAt": now,
                "metadata.completedBy": "outgoing_call",
                "metadata.completedCommunicationId": communication.get("id"),
            }
        },
    )
    return int(result.modified_count or 0)


async def evaluate_communication(
    db,
    communication: dict,
    *,
    event_id: Optional[str] = None,
    missed_call: bool = False,
) -> Dict[str, Any]:
    """Evaluate messaging rules for a communication document."""
    if not communication or not communication.get("id"):
        return {"created": 0, "skipped": 0, "actions": []}
    fact: Dict[str, Any] = {"communication": communication}
    if event_id:
        fact["eventId"] = event_id
    if missed_call:
        fact["missedCall"] = True
    # Honor ignored prospect decisions so new mails don't reopen the queue.
    if not communication.get("clientId") and (communication.get("direction") or "") == "inbound":
        try:
            from prospects.identity import identity_key_for_email, identity_key_for_phone
            from integrations.matching import normalize_email_loose

            meta = communication.get("metadata") or {}
            identity_key = None
            if (communication.get("type") or "") == "phone":
                identity_key = identity_key_for_phone(
                    meta.get("normalizedPhone")
                    or meta.get("phoneNumber")
                    or meta.get("fromPhone")
                )
            else:
                from_email = normalize_email_loose(meta.get("fromEmail"))
                identity_key = identity_key_for_email(from_email)
            if identity_key:
                decision = await db.prospect_decisions.find_one(
                    {
                        "userId": communication["userId"],
                        "identityKey": identity_key,
                        "status": "ignored",
                    },
                    {"_id": 0, "status": 1},
                )
                if decision:
                    fact["prospectIgnored"] = True
        except Exception:
            logger.exception(
                "action_engine_prospect_ignored_lookup_failed communication_id=%s",
                communication.get("id"),
            )
    result = await evaluate_fact(db, fact)
    try:
        completed = await _complete_matching_call_backs(db, communication)
        if completed:
            result = {**result, "completedCallBacks": completed}
    except Exception:
        logger.exception(
            "action_engine_complete_call_back_failed communication_id=%s",
            communication.get("id"),
        )
    return result


async def evaluate_invoice(
    db,
    invoice: dict,
    *,
    event_id: Optional[str] = None,
) -> Dict[str, Any]:
    if not invoice or not invoice.get("id"):
        return {"created": 0, "skipped": 0, "actions": []}
    fact: Dict[str, Any] = {"invoice": invoice}
    if event_id:
        fact["eventId"] = event_id
    return await evaluate_fact(db, fact)


async def evaluate_quote(
    db,
    quote: dict,
    *,
    event_id: Optional[str] = None,
) -> Dict[str, Any]:
    if not quote or not quote.get("id"):
        return {"created": 0, "skipped": 0, "actions": []}
    fact: Dict[str, Any] = {"quote": quote}
    if event_id:
        fact["eventId"] = event_id
    return await evaluate_fact(db, fact)


async def safe_evaluate_communication(db, communication: dict) -> None:
    """Fire-and-forget style wrapper — never raises into writers."""
    try:
        await evaluate_communication(db, communication)
    except Exception:
        logger.exception(
            "action_engine_comm_hook_failed communication_id=%s",
            (communication or {}).get("id"),
        )


async def safe_evaluate_invoice(db, invoice: dict) -> None:
    try:
        await evaluate_invoice(db, invoice)
    except Exception:
        logger.exception(
            "action_engine_invoice_hook_failed invoice_id=%s",
            (invoice or {}).get("id"),
        )


async def safe_evaluate_quote(db, quote: dict) -> None:
    try:
        await evaluate_quote(db, quote)
    except Exception:
        logger.exception(
            "action_engine_quote_hook_failed quote_id=%s",
            (quote or {}).get("id"),
        )
