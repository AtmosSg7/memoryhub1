"""Append-only credit ledger — history, idempotency, transaction mapping."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from credit_constants import COLLECTION_TRANSACTIONS, CreditTransactionType
from credit_exceptions import CreditTransactionNotFoundError
from credit_models import CreditTransactionPublic


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _user_filter(user_id: str) -> dict:
    return {"userId": user_id}


def transaction_public(doc: dict) -> CreditTransactionPublic:
    return CreditTransactionPublic(
        id=doc["id"],
        type=doc["type"],
        actionKey=doc.get("actionKey"),
        tierKey=doc.get("tierKey"),
        costApplied=doc.get("costApplied"),
        monthlyDelta=doc["monthlyDelta"],
        permanentDelta=doc["permanentDelta"],
        monthlyBalanceAfter=doc["monthlyBalanceAfter"],
        permanentBalanceAfter=doc["permanentBalanceAfter"],
        source=doc.get("source"),
        referenceType=doc.get("referenceType"),
        referenceId=doc.get("referenceId"),
        label=doc.get("label"),
        metadata=doc.get("metadata"),
        createdAt=doc["createdAt"],
    )


async def find_by_idempotency_key(db, user_id: str, idempotency_key: str) -> Optional[dict]:
    return await db[COLLECTION_TRANSACTIONS].find_one(
        {**_user_filter(user_id), "idempotencyKey": idempotency_key},
        {"_id": 0},
    )


async def get_transaction(db, user_id: str, transaction_id: str) -> CreditTransactionPublic:
    doc = await db[COLLECTION_TRANSACTIONS].find_one(
        {**_user_filter(user_id), "id": transaction_id},
        {"_id": 0},
    )
    if not doc:
        raise CreditTransactionNotFoundError(transaction_id)
    return transaction_public(doc)


async def list_transactions(
    db,
    user_id: str,
    *,
    limit: int = 50,
    transaction_type: Optional[CreditTransactionType] = None,
) -> tuple[List[CreditTransactionPublic], int]:
    query = _user_filter(user_id)
    if transaction_type:
        query["type"] = transaction_type
    total = await db[COLLECTION_TRANSACTIONS].count_documents(query)
    cursor = (
        db[COLLECTION_TRANSACTIONS]
        .find(query, {"_id": 0, "userId": 0, "idempotencyKey": 0})
        .sort("createdAt", -1)
        .limit(limit)
    )
    items = [transaction_public(doc) async for doc in cursor]
    return items, total


async def append_transaction(
    db,
    *,
    user_id: str,
    transaction_type: CreditTransactionType,
    monthly_delta: int,
    permanent_delta: int,
    monthly_balance_after: int,
    permanent_balance_after: int,
    action_key: Optional[str] = None,
    tier_key: Optional[str] = None,
    cost_applied: Optional[int] = None,
    source: Optional[str] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    label: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    reversed_transaction_id: Optional[str] = None,
) -> CreditTransactionPublic:
    now = _now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "type": transaction_type,
        "monthlyDelta": monthly_delta,
        "permanentDelta": permanent_delta,
        "monthlyBalanceAfter": monthly_balance_after,
        "permanentBalanceAfter": permanent_balance_after,
        "actionKey": action_key,
        "tierKey": tier_key,
        "costApplied": cost_applied,
        "source": source,
        "referenceType": reference_type,
        "referenceId": reference_id,
        "label": label,
        "metadata": metadata or {},
        "reversedTransactionId": reversed_transaction_id,
        "createdAt": now,
    }
    if idempotency_key:
        doc["idempotencyKey"] = idempotency_key
    await db[COLLECTION_TRANSACTIONS].insert_one(doc)
    return transaction_public(doc)
