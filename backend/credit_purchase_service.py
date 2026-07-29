"""Credit pack purchase orchestration — dev simulation and Stripe fulfillment."""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from billing_service import record_credit_purchase
from credit_constants import COLLECTION_CREDIT_PURCHASES
from credit_exceptions import DevCreditPurchaseNotAllowedError
from credit_models import CreditBalancePublic, CreditPurchasePublic
from credit_pack_service import get_pack_doc, list_active_packs
from credit_service import get_balance
from credit_transaction_service import find_by_idempotency_key

logger = logging.getLogger(__name__)

PURCHASE_TYPE_CREDIT_PACK = "credit_pack"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _env_name() -> str:
    return os.environ.get("ENV", "development").lower()


def dev_credit_purchases_enabled() -> bool:
    if _env_name() not in {"development", "test"}:
        return False
    return os.environ.get("DEV_CREDIT_PURCHASES_ENABLED", "").lower() in {"1", "true", "yes"}


def credit_pack_checkout_available() -> bool:
    from stripe_config import stripe_configured

    return stripe_configured()


def purchase_public(doc: dict) -> CreditPurchasePublic:
    return CreditPurchasePublic(
        id=doc["id"],
        packKey=doc["packKey"],
        packName=doc.get("packName"),
        credits=doc["credits"],
        priceCents=doc["priceCents"],
        currency=doc.get("currency", "eur"),
        status=doc["status"],
        method=doc["method"],
        transactionId=doc.get("transactionId"),
        createdAt=doc["createdAt"],
        completedAt=doc.get("completedAt"),
    )


async def find_purchase_by_idempotency(db, user_id: str, idempotency_key: str) -> Optional[dict]:
    return await db[COLLECTION_CREDIT_PURCHASES].find_one(
        {"userId": user_id, "idempotencyKey": idempotency_key},
        {"_id": 0},
    )


async def find_purchase_by_id(db, user_id: str, purchase_id: str) -> Optional[dict]:
    return await db[COLLECTION_CREDIT_PURCHASES].find_one(
        {"userId": user_id, "id": purchase_id},
        {"_id": 0},
    )


async def list_user_credit_purchases(
    db,
    user_id: str,
    *,
    limit: int = 50,
) -> Tuple[List[CreditPurchasePublic], int]:
    query = {"userId": user_id}
    total = await db[COLLECTION_CREDIT_PURCHASES].count_documents(query)
    cursor = (
        db[COLLECTION_CREDIT_PURCHASES]
        .find(query, {"_id": 0})
        .sort("createdAt", -1)
        .limit(min(limit, 200))
    )
    items = [purchase_public(doc) async for doc in cursor]
    return items, total


async def simulate_dev_credit_purchase(
    db,
    user_id: str,
    pack_key: str,
    *,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    if not dev_credit_purchases_enabled():
        raise DevCreditPurchaseNotAllowedError()

    pack_doc = await get_pack_doc(db, pack_key)
    stable_key = idempotency_key or str(uuid.uuid4())
    idem = f"credit-purchase:dev:{user_id}:{stable_key}"

    existing = await find_purchase_by_idempotency(db, user_id, idem)
    if existing and existing.get("status") == "completed":
        balance = await get_balance(db, user_id)
        return {
            "purchase": purchase_public(existing),
            "balance": balance,
            "transactionId": existing.get("transactionId"),
            "idempotentReplay": True,
        }

    purchase_id = str(uuid.uuid4())
    now = _now_iso()

    balance = await record_credit_purchase(
        db,
        user_id,
        int(pack_doc["credits"]),
        payment_reference=purchase_id,
        pack_key=pack_doc["packKey"],
        purchase_id=purchase_id,
        idempotency_key=idem,
        method="development",
        price_cents=int(pack_doc["priceCents"]),
        currency=pack_doc.get("currency", "eur"),
    )

    tx = await find_by_idempotency_key(db, user_id, idem)
    purchase_doc = {
        "id": purchase_id,
        "userId": user_id,
        "packKey": pack_doc["packKey"],
        "packName": pack_doc["name"],
        "credits": int(pack_doc["credits"]),
        "priceCents": int(pack_doc["priceCents"]),
        "currency": pack_doc.get("currency", "eur"),
        "status": "completed",
        "method": "development",
        "transactionId": tx["id"] if tx else None,
        "idempotencyKey": idem,
        "createdAt": now,
        "completedAt": now,
    }

    try:
        await db[COLLECTION_CREDIT_PURCHASES].insert_one(purchase_doc)
    except Exception:
        existing = await find_purchase_by_idempotency(db, user_id, idem)
        if existing:
            purchase_doc = existing
        else:
            raise

    purchase_doc.pop("_id", None)
    logger.info(
        "credit_purchase.dev user=%s pack=%s credits=%s purchase=%s",
        user_id,
        pack_doc["packKey"],
        pack_doc["credits"],
        purchase_id,
    )
    return {
        "purchase": purchase_public(purchase_doc),
        "balance": balance,
        "transactionId": purchase_doc.get("transactionId"),
        "idempotentReplay": False,
    }


async def create_pending_stripe_purchase(
    db,
    user_id: str,
    pack_key: str,
    *,
    purchase_id: str,
    stripe_checkout_session_id: str,
) -> dict:
    pack_doc = await get_pack_doc(db, pack_key)
    now = _now_iso()
    idem = f"credit-purchase:stripe:{purchase_id}"
    doc = {
        "id": purchase_id,
        "userId": user_id,
        "packKey": pack_doc["packKey"],
        "packName": pack_doc["name"],
        "credits": int(pack_doc["credits"]),
        "priceCents": int(pack_doc["priceCents"]),
        "currency": pack_doc.get("currency", "eur"),
        "status": "pending",
        "method": "stripe",
        "transactionId": None,
        "idempotencyKey": idem,
        "stripeCheckoutSessionId": stripe_checkout_session_id,
        "createdAt": now,
    }
    await db[COLLECTION_CREDIT_PURCHASES].insert_one(doc)
    doc.pop("_id", None)
    return doc


async def fulfill_stripe_credit_purchase(
    db,
    *,
    user_id: str,
    pack_key: str,
    purchase_id: str,
    stripe_checkout_session_id: Optional[str],
    stripe_event_id: str,
    stripe_payment_intent_id: Optional[str] = None,
) -> Optional[str]:
    purchase = await find_purchase_by_id(db, user_id, purchase_id)
    if purchase and purchase.get("status") == "completed":
        return user_id

    idem = f"credit-purchase:stripe:{purchase_id}"
    existing_tx = await find_by_idempotency_key(db, user_id, idem)
    if existing_tx:
        if purchase:
            await db[COLLECTION_CREDIT_PURCHASES].update_one(
                {"id": purchase_id},
                {
                    "$set": {
                        "status": "completed",
                        "transactionId": existing_tx["id"],
                        "completedAt": _now_iso(),
                        "stripeEventId": stripe_event_id,
                        "stripePaymentIntentId": stripe_payment_intent_id,
                    }
                },
            )
        return user_id

    pack_doc = await get_pack_doc(db, pack_key)
    await record_credit_purchase(
        db,
        user_id,
        int(pack_doc["credits"]),
        payment_reference=purchase_id,
        pack_key=pack_key,
        purchase_id=purchase_id,
        idempotency_key=idem,
        method="stripe",
        price_cents=int(pack_doc["priceCents"]),
        currency=pack_doc.get("currency", "eur"),
    )

    tx = await find_by_idempotency_key(db, user_id, idem)
    now = _now_iso()
    update = {
        "status": "completed",
        "transactionId": tx["id"] if tx else None,
        "completedAt": now,
        "stripeEventId": stripe_event_id,
        "stripePaymentIntentId": stripe_payment_intent_id,
    }
    if stripe_checkout_session_id:
        update["stripeCheckoutSessionId"] = stripe_checkout_session_id

    if purchase:
        await db[COLLECTION_CREDIT_PURCHASES].update_one({"id": purchase_id, "userId": user_id}, {"$set": update})
    else:
        doc = {
            "id": purchase_id,
            "userId": user_id,
            "packKey": pack_doc["packKey"],
            "packName": pack_doc["name"],
            "credits": int(pack_doc["credits"]),
            "priceCents": int(pack_doc["priceCents"]),
            "currency": pack_doc.get("currency", "eur"),
            "method": "stripe",
            "idempotencyKey": idem,
            "createdAt": now,
            **update,
        }
        await db[COLLECTION_CREDIT_PURCHASES].insert_one(doc)

    logger.info(
        "credit_purchase.stripe user=%s pack=%s purchase=%s event=%s",
        user_id,
        pack_key,
        purchase_id,
        stripe_event_id,
    )
    return user_id


async def get_purchase_capabilities(db) -> dict:
    packs = await list_active_packs(db)
    return {
        "packs": packs,
        "devCreditPurchasesEnabled": dev_credit_purchases_enabled(),
        "stripeCreditCheckoutEnabled": credit_pack_checkout_available()
        and any(p.stripeConfigured for p in packs),
    }
