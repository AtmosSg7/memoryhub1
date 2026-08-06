"""Communication Intelligence service — analyze, accept, reject."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from action_engine.constants import ACTION_SOURCE_COMMUNICATION
from action_engine.engine import action_public, persist_proposals
from action_engine.rules import _proposal
from ai_usage_event_service import record_ai_usage_event
from ai_usage_service import check_before_action, record_usage
from communication_intelligence.analyzer import run_analyzer
from communication_intelligence.constants import (
    ANALYSIS_VERSION,
    CREDIT_ACTION_KEY,
    STATUS_ERROR,
    STATUS_READY,
    STATUS_SKIPPED,
    SUGGESTION_ACCEPTED,
    SUGGESTION_NONE,
    SUGGESTION_PENDING,
    SUGGESTION_REJECTED,
    ci_daily_limit,
    ci_enabled,
)
from communication_intelligence.eligibility import eligibility_for_analysis
from communication_intelligence.hashing import build_content_hash
from communication_intelligence.mapping import (
    map_intent_to_suggestion,
    urgency_to_priority,
)
from communication_intelligence.models import CommunicationAnalysisPublic
from credit_exceptions import InsufficientCreditsError
from credit_models import AIUsageRequest
from credit_service import credits_enforced

logger = logging.getLogger(__name__)

COLLECTION = "communication_analyses"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _day_key(dt: Optional[datetime] = None) -> str:
    d = dt or datetime.now(timezone.utc)
    return d.strftime("%Y-%m-%d")


def analysis_public(doc: dict) -> CommunicationAnalysisPublic:
    return CommunicationAnalysisPublic(
        id=doc["id"],
        userId=doc["userId"],
        communicationId=doc["communicationId"],
        status=doc.get("status") or STATUS_ERROR,
        suggestionStatus=doc.get("suggestionStatus") or SUGGESTION_NONE,
        summary=doc.get("summary"),
        intent=doc.get("intent"),
        urgency=doc.get("urgency"),
        suggestedActionType=doc.get("suggestedActionType"),
        suggestedActionTitle=doc.get("suggestedActionTitle"),
        suggestedActionDescription=doc.get("suggestedActionDescription"),
        entities=dict(doc.get("entities") or {}),
        confidence=doc.get("confidence"),
        analyzedAt=doc.get("analyzedAt"),
        model=doc.get("model"),
        version=doc.get("version") or ANALYSIS_VERSION,
        contentHash=doc.get("contentHash"),
        skipReason=doc.get("skipReason"),
        errorCode=doc.get("errorCode"),
        acceptedActionId=doc.get("acceptedActionId"),
        createdAt=doc.get("createdAt") or _utc_now_iso(),
        updatedAt=doc.get("updatedAt") or _utc_now_iso(),
    )


async def get_analysis(
    db, user_id: str, communication_id: str
) -> Optional[CommunicationAnalysisPublic]:
    doc = await db[COLLECTION].find_one(
        {"userId": user_id, "communicationId": communication_id},
        {"_id": 0},
    )
    return analysis_public(doc) if doc else None


async def _count_today(db, user_id: str) -> int:
    return await db[COLLECTION].count_documents(
        {
            "userId": user_id,
            "dayKey": _day_key(),
            "status": {"$in": [STATUS_READY, STATUS_ERROR]},
            "billed": True,
        }
    )


async def _load_communication(db, user_id: str, communication_id: str) -> Optional[dict]:
    return await db.communications.find_one(
        {"userId": user_id, "id": communication_id},
        {"_id": 0},
    )


async def analyze_communication(
    db,
    user_id: str,
    communication_id: str,
    *,
    force: bool = False,
    trigger: str = "manual",
) -> CommunicationAnalysisPublic:
    """Analyze one communication. Never raises to callers for AI failures — stores error status.

    Raises LookupError if communication missing.
    Raises PermissionError if feature disabled.
    Raises RuntimeError with code quota_exceeded / insufficient_credits when blocked before call.
    """
    if not ci_enabled():
        raise PermissionError("communication_intelligence_disabled")

    communication = await _load_communication(db, user_id, communication_id)
    if not communication:
        raise LookupError("communication_not_found")

    content_hash = build_content_hash(communication, version=ANALYSIS_VERSION)
    existing = await db[COLLECTION].find_one(
        {"userId": user_id, "communicationId": communication_id},
        {"_id": 0},
    )

    if (
        existing
        and not force
        and existing.get("status") == STATUS_READY
        and existing.get("contentHash") == content_hash
        and existing.get("version") == ANALYSIS_VERSION
    ):
        return analysis_public(existing)

    ok, skip_reason = eligibility_for_analysis(communication)
    now = _utc_now_iso()
    if not ok:
        doc = _base_doc(
            user_id,
            communication_id,
            existing=existing,
            now=now,
            content_hash=content_hash,
        )
        doc.update(
            {
                "status": STATUS_SKIPPED,
                "suggestionStatus": SUGGESTION_NONE,
                "skipReason": skip_reason,
                "analyzedAt": now,
                "updatedAt": now,
                "billed": False,
            }
        )
        await _upsert(db, doc)
        logger.info(
            "ci.analyze.skipped user=%s comm=%s reason=%s trigger=%s",
            user_id,
            communication_id,
            skip_reason,
            trigger,
        )
        return analysis_public(doc)

    # Daily technical cap
    used_today = await _count_today(db, user_id)
    if used_today >= ci_daily_limit():
        raise RuntimeError("quota_exceeded")

    # Credits preflight
    can, cost, _balance = await check_before_action(db, user_id, CREDIT_ACTION_KEY)
    if credits_enforced() and not can:
        raise InsufficientCreditsError(
            required=cost,
            available=_balance.totalRemaining,
            monthly_remaining=_balance.monthlyRemaining,
            permanent_remaining=_balance.permanentRemaining,
            action_key=CREDIT_ACTION_KEY,
        )

    doc = _base_doc(
        user_id,
        communication_id,
        existing=existing,
        now=now,
        content_hash=content_hash,
    )
    doc["status"] = "pending"
    doc["updatedAt"] = now
    await _upsert(db, doc)

    try:
        result, usage = await run_analyzer(communication)
    except Exception as exc:
        # Never lose the communication — store error, no credit debit.
        err_code = type(exc).__name__
        doc.update(
            {
                "status": STATUS_ERROR,
                "errorCode": err_code[:80],
                "analyzedAt": _utc_now_iso(),
                "updatedAt": _utc_now_iso(),
                "suggestionStatus": SUGGESTION_NONE,
                "billed": False,
                "dayKey": _day_key(),
            }
        )
        await _upsert(db, doc)
        await record_ai_usage_event(
            db,
            user_id=user_id,
            action_key=CREDIT_ACTION_KEY,
            model=usage_model_safe(exc),
            input_tokens=0,
            output_tokens=0,
            total_tokens=0,
            duration_ms=None,
            success=False,
            reference_type="communication",
            reference_id=communication_id,
            idempotency_key=f"ai-usage:ci-error:{communication_id}:{content_hash}:{err_code}",
            metadata={"trigger": trigger, "errorCode": err_code},
            error_message=str(exc)[:200],
        )
        logger.warning(
            "ci.analyze.failed user=%s comm=%s error=%s trigger=%s",
            user_id,
            communication_id,
            err_code,
            trigger,
        )
        return analysis_public(doc)

    suggestion = map_intent_to_suggestion(
        result["intent"],
        summary=result.get("summary"),
        entities=result.get("entities"),
    )

    # Debit credits (idempotent per hash)
    credits_consumed = 0
    credit_tx = None
    try:
        consume_result = await record_usage(
            db,
            AIUsageRequest(
                userId=user_id,
                actionKey=CREDIT_ACTION_KEY,
                idempotencyKey=f"ci:{communication_id}:{content_hash}",
                referenceType="communication",
                referenceId=communication_id,
                metadata={"trigger": trigger, "intent": result["intent"]},
            ),
        )
        credits_consumed = int(getattr(consume_result, "costApplied", 0) or 0)
        credit_tx = getattr(consume_result, "transactionId", None)
    except InsufficientCreditsError:
        # Race: mark error without content
        doc.update(
            {
                "status": STATUS_ERROR,
                "errorCode": "insufficient_credits",
                "analyzedAt": _utc_now_iso(),
                "updatedAt": _utc_now_iso(),
                "billed": False,
                "dayKey": _day_key(),
            }
        )
        await _upsert(db, doc)
        raise

    doc.update(
        {
            "status": STATUS_READY,
            "summary": result["summary"],
            "intent": result["intent"],
            "urgency": result["urgency"],
            "confidence": result["confidence"],
            "entities": result.get("entities") or {},
            "suggestedActionType": suggestion["type"],
            "suggestedActionTitle": suggestion["title"],
            "suggestedActionDescription": suggestion["description"],
            "suggestionStatus": SUGGESTION_PENDING,
            "model": result.get("model"),
            "analyzedAt": _utc_now_iso(),
            "updatedAt": _utc_now_iso(),
            "errorCode": None,
            "skipReason": None,
            "billed": True,
            "dayKey": _day_key(),
            "acceptedActionId": None,
        }
    )
    await _upsert(db, doc)

    await record_ai_usage_event(
        db,
        user_id=user_id,
        action_key=CREDIT_ACTION_KEY,
        model=usage.get("model"),
        input_tokens=usage.get("input_tokens"),
        output_tokens=usage.get("output_tokens"),
        total_tokens=usage.get("total_tokens"),
        duration_ms=usage.get("duration_ms"),
        success=True,
        reference_type="communication",
        reference_id=communication_id,
        idempotency_key=f"ai-usage:ci:{communication_id}:{content_hash}",
        metadata={
            "trigger": trigger,
            "intent": result["intent"],
            "urgency": result["urgency"],
            "previewChars": len(str(communication.get("preview") or "")),
        },
        credits_consumed=credits_consumed,
        credit_transaction_id=credit_tx,
    )
    logger.info(
        "ci.analyze.completed user=%s comm=%s intent=%s urgency=%s model=%s tokens=%s trigger=%s",
        user_id,
        communication_id,
        result["intent"],
        result["urgency"],
        usage.get("model"),
        usage.get("total_tokens"),
        trigger,
    )
    return analysis_public(doc)


def usage_model_safe(_exc: Exception) -> Optional[str]:
    try:
        from communication_intelligence.constants import ci_model

        return ci_model()
    except Exception:
        return None


def _base_doc(
    user_id: str,
    communication_id: str,
    *,
    existing: Optional[dict],
    now: str,
    content_hash: str,
) -> dict:
    return {
        "id": (existing or {}).get("id") or str(uuid.uuid4()),
        "userId": user_id,
        "communicationId": communication_id,
        "version": ANALYSIS_VERSION,
        "contentHash": content_hash,
        "createdAt": (existing or {}).get("createdAt") or now,
        "updatedAt": now,
        "suggestionStatus": (existing or {}).get("suggestionStatus") or SUGGESTION_NONE,
        "acceptedActionId": (existing or {}).get("acceptedActionId"),
    }


async def _upsert(db, doc: dict) -> None:
    await db[COLLECTION].update_one(
        {"userId": doc["userId"], "communicationId": doc["communicationId"]},
        {"$set": doc},
        upsert=True,
    )


async def accept_suggestion(
    db, user_id: str, communication_id: str
) -> Tuple[CommunicationAnalysisPublic, Optional[dict], bool]:
    """Accept suggestion → create Action Engine action (idempotent)."""
    if not ci_enabled():
        raise PermissionError("communication_intelligence_disabled")

    analysis = await db[COLLECTION].find_one(
        {"userId": user_id, "communicationId": communication_id},
        {"_id": 0},
    )
    if not analysis or analysis.get("status") != STATUS_READY:
        raise LookupError("analysis_not_ready")
    if analysis.get("suggestionStatus") == SUGGESTION_REJECTED:
        raise ValueError("suggestion_rejected")

    communication = await _load_communication(db, user_id, communication_id)
    if not communication:
        raise LookupError("communication_not_found")

    # Already accepted — return existing action if any
    if analysis.get("suggestionStatus") == SUGGESTION_ACCEPTED and analysis.get(
        "acceptedActionId"
    ):
        action_doc = await db.actions.find_one(
            {"userId": user_id, "id": analysis["acceptedActionId"]},
            {"_id": 0},
        )
        return (
            analysis_public(analysis),
            action_public(action_doc).model_dump() if action_doc else None,
            False,
        )

    action_type = analysis.get("suggestedActionType")
    title = analysis.get("suggestedActionTitle") or "Suivre ce message"
    description = analysis.get("suggestedActionDescription") or analysis.get("summary")
    priority = urgency_to_priority(analysis.get("urgency") or "normal")
    idempotency_key = f"ci_accept:{communication_id}:{analysis.get('intent') or 'other'}"

    proposal = _proposal(
        action_type=action_type,
        idempotency_key=idempotency_key,
        title=title,
        description=description,
        priority=priority,
        source=ACTION_SOURCE_COMMUNICATION,
        user_id=user_id,
        client_id=communication.get("clientId"),
        communication_id=communication_id,
        metadata={
            "fromIntelligence": True,
            "intent": analysis.get("intent"),
            "analysisId": analysis.get("id"),
            "clientName": (communication.get("metadata") or {}).get("clientName"),
            "fromEmail": (communication.get("metadata") or {}).get("fromEmail"),
        },
    )
    created_docs, skipped = await persist_proposals(db, [proposal])
    created = bool(created_docs)
    if created_docs:
        action_doc = created_docs[0]
    else:
        action_doc = await db.actions.find_one(
            {"userId": user_id, "idempotencyKey": idempotency_key},
            {"_id": 0},
        )

    now = _utc_now_iso()
    # Supersede auto-created reply_to_prospect for the same communication (avoid twin actions).
    try:
        from action_engine.constants import (
            ACTION_STATUS_DISMISSED,
            ACTION_STATUS_PENDING,
            ACTION_TYPE_REPLY_TO_PROSPECT,
        )

        accepted_id = (action_doc or {}).get("id")
        dismiss_filter = {
            "userId": user_id,
            "communicationId": communication_id,
            "status": ACTION_STATUS_PENDING,
            "type": ACTION_TYPE_REPLY_TO_PROSPECT,
            "idempotencyKey": {"$ne": idempotency_key},
        }
        if accepted_id:
            dismiss_filter["id"] = {"$ne": accepted_id}
        await db.actions.update_many(
            dismiss_filter,
            {
                "$set": {
                    "status": ACTION_STATUS_DISMISSED,
                    "updatedAt": now,
                    "metadata.dismissedReason": "superseded_by_ci_accept",
                    "metadata.supersededByActionId": accepted_id,
                }
            },
        )
    except Exception:
        logger.exception(
            "ci.accept.supersede_failed user=%s comm=%s", user_id, communication_id
        )

    await db[COLLECTION].update_one(
        {"userId": user_id, "communicationId": communication_id},
        {
            "$set": {
                "suggestionStatus": SUGGESTION_ACCEPTED,
                "acceptedActionId": (action_doc or {}).get("id"),
                "updatedAt": now,
            }
        },
    )
    updated = await db[COLLECTION].find_one(
        {"userId": user_id, "communicationId": communication_id},
        {"_id": 0},
    )
    logger.info(
        "ci.suggestion.accepted user=%s comm=%s action=%s created=%s skipped=%s",
        user_id,
        communication_id,
        (action_doc or {}).get("id"),
        created,
        skipped,
    )
    return (
        analysis_public(updated),
        action_public(action_doc).model_dump() if action_doc else None,
        created,
    )


async def reject_suggestion(
    db, user_id: str, communication_id: str
) -> CommunicationAnalysisPublic:
    if not ci_enabled():
        raise PermissionError("communication_intelligence_disabled")

    analysis = await db[COLLECTION].find_one(
        {"userId": user_id, "communicationId": communication_id},
        {"_id": 0},
    )
    if not analysis or analysis.get("status") != STATUS_READY:
        raise LookupError("analysis_not_ready")

    now = _utc_now_iso()
    await db[COLLECTION].update_one(
        {"userId": user_id, "communicationId": communication_id},
        {
            "$set": {
                "suggestionStatus": SUGGESTION_REJECTED,
                "updatedAt": now,
            }
        },
    )
    updated = await db[COLLECTION].find_one(
        {"userId": user_id, "communicationId": communication_id},
        {"_id": 0},
    )
    logger.info(
        "ci.suggestion.rejected user=%s comm=%s",
        user_id,
        communication_id,
    )
    return analysis_public(updated)
