"""Append-only AI usage events — tokens, estimated OpenAI cost, credits consumed."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from ai_cost_config import estimate_cost_usd
from admin_constants import COLLECTION_AI_USAGE_EVENTS


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sanitize_error_message(message: Optional[str], *, max_len: int = 240) -> Optional[str]:
    if not message:
        return None
    cleaned = " ".join(str(message).split())
    if len(cleaned) > max_len:
        return cleaned[: max_len - 1] + "…"
    return cleaned


async def record_ai_usage_event(
    db,
    *,
    user_id: str,
    action_key: str,
    model: Optional[str],
    input_tokens: Optional[int],
    output_tokens: Optional[int],
    total_tokens: Optional[int],
    duration_ms: Optional[int],
    success: bool,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    credits_consumed: Optional[int] = None,
    credit_transaction_id: Optional[str] = None,
    tier_key: Optional[str] = None,
    document_type: Optional[str] = None,
    error_message: Optional[str] = None,
) -> dict:
    inp = max(0, int(input_tokens or 0))
    out = max(0, int(output_tokens or 0))
    total = max(0, int(total_tokens or (inp + out)))

    estimated_cost_usd, cost_known = estimate_cost_usd(
        model=model or "",
        input_tokens=inp,
        output_tokens=out,
    )

    safe_meta = dict(metadata or {})
    if tier_key and "tierKey" not in safe_meta:
        safe_meta["tierKey"] = tier_key

    if idempotency_key:
        existing = await db[COLLECTION_AI_USAGE_EVENTS].find_one(
            {"idempotencyKey": idempotency_key},
            {"_id": 0},
        )
        if existing:
            return existing

    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "actionKey": action_key,
        "model": model,
        "inputTokens": inp,
        "outputTokens": out,
        "totalTokens": total,
        "durationMs": duration_ms,
        "success": bool(success),
        "referenceType": reference_type,
        "referenceId": reference_id,
        "estimatedCostUsd": estimated_cost_usd,
        "costKnown": cost_known,
        "creditsConsumed": credits_consumed,
        "creditTransactionId": credit_transaction_id,
        "tierKey": tier_key,
        "documentType": document_type,
        "errorMessage": _sanitize_error_message(error_message),
        "metadata": safe_meta,
        "createdAt": _utc_now(),
    }
    if idempotency_key:
        doc["idempotencyKey"] = idempotency_key

    try:
        await db[COLLECTION_AI_USAGE_EVENTS].insert_one(doc)
    except Exception:
        if idempotency_key:
            existing = await db[COLLECTION_AI_USAGE_EVENTS].find_one(
                {"idempotencyKey": idempotency_key},
                {"_id": 0},
            )
            if existing:
                return existing
        raise

    doc.pop("_id", None)
    return doc


async def update_ai_usage_event(
    db,
    event_id: str,
    *,
    credits_consumed: Optional[int] = None,
    credit_transaction_id: Optional[str] = None,
    success: Optional[bool] = None,
    error_message: Optional[str] = None,
) -> None:
    update: Dict[str, Any] = {}
    if credits_consumed is not None:
        update["creditsConsumed"] = credits_consumed
    if credit_transaction_id is not None:
        update["creditTransactionId"] = credit_transaction_id
    if success is not None:
        update["success"] = success
    if error_message is not None:
        update["errorMessage"] = _sanitize_error_message(error_message)
    if not update:
        return
    await db[COLLECTION_AI_USAGE_EVENTS].update_one({"id": event_id}, {"$set": update})


async def record_import_ai_usage(
    db,
    *,
    user_id: str,
    session_id: str,
    model: Optional[str],
    token_usage: Optional[dict],
    duration_ms: Optional[int],
    success: bool,
    tier_key: Optional[str] = None,
    document_type: Optional[str] = None,
    credits_consumed: Optional[int] = None,
    credit_transaction_id: Optional[str] = None,
    error_message: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> dict:
    meta = dict(metadata or {})
    if tier_key:
        meta.setdefault("tierKey", tier_key)

    return await record_ai_usage_event(
        db,
        user_id=user_id,
        action_key="IMPORT_DOCUMENT",
        model=model,
        input_tokens=token_usage.get("inputTokens") if token_usage else None,
        output_tokens=token_usage.get("outputTokens") if token_usage else None,
        total_tokens=token_usage.get("totalTokens") if token_usage else None,
        duration_ms=duration_ms,
        success=success,
        reference_type="import_session",
        reference_id=session_id,
        idempotency_key=f"ai-usage:import:{session_id}",
        metadata=meta,
        credits_consumed=credits_consumed,
        credit_transaction_id=credit_transaction_id,
        tier_key=tier_key,
        document_type=document_type,
        error_message=error_message,
    )
