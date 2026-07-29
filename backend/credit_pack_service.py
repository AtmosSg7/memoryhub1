"""Credit pack catalog — single source of truth for permanent credit purchases."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import List, Optional

from credit_constants import COLLECTION_CREDIT_PACKS
from credit_exceptions import CreditPackNotFoundError
from credit_models import CreditPackPublic


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _env_stripe_price(env_var: str) -> Optional[str]:
    value = os.environ.get(env_var, "").strip()
    return value or None


DEFAULT_CREDIT_PACKS = [
    {
        "packKey": "pack_10",
        "name": "10 analyses IA",
        "credits": 500,
        "priceCents": 990,
        "currency": "eur",
        "stripePriceEnv": "STRIPE_PRICE_CREDITS_10",
        "sortOrder": 1,
    },
    {
        "packKey": "pack_25",
        "name": "25 analyses IA",
        "credits": 1250,
        "priceCents": 3900,
        "currency": "eur",
        "stripePriceEnv": "STRIPE_PRICE_CREDITS_25",
        "sortOrder": 2,
    },
    {
        "packKey": "pack_50",
        "name": "50 analyses IA",
        "credits": 2500,
        "priceCents": 9900,
        "currency": "eur",
        "stripePriceEnv": "STRIPE_PRICE_CREDITS_50",
        "sortOrder": 3,
    },
]


def pack_public(doc: dict) -> CreditPackPublic:
    return CreditPackPublic(
        packKey=doc["packKey"],
        name=doc["name"],
        credits=doc["credits"],
        priceCents=doc["priceCents"],
        currency=doc.get("currency", "eur"),
        isActive=bool(doc.get("isActive", True)),
        sortOrder=int(doc.get("sortOrder", 0)),
        stripeConfigured=bool(doc.get("stripePriceId")),
    )


async def get_pack(db, pack_key: str) -> CreditPackPublic:
    doc = await db[COLLECTION_CREDIT_PACKS].find_one(
        {"packKey": pack_key, "isActive": True},
        {"_id": 0},
    )
    if not doc:
        raise CreditPackNotFoundError(pack_key)
    return pack_public(doc)


async def get_pack_doc(db, pack_key: str) -> dict:
    doc = await db[COLLECTION_CREDIT_PACKS].find_one(
        {"packKey": pack_key, "isActive": True},
        {"_id": 0},
    )
    if not doc:
        raise CreditPackNotFoundError(pack_key)
    return doc


async def list_active_packs(db) -> List[CreditPackPublic]:
    cursor = (
        db[COLLECTION_CREDIT_PACKS]
        .find({"isActive": True}, {"_id": 0})
        .sort("sortOrder", 1)
    )
    return [pack_public(doc) async for doc in cursor]


async def upsert_pack(db, entry: dict) -> CreditPackPublic:
    now = _now_iso()
    stripe_price_id = _env_stripe_price(entry.get("stripePriceEnv", ""))
    pack_key = entry["packKey"]
    doc = {
        "id": pack_key,
        "packKey": pack_key,
        "name": entry["name"],
        "credits": entry["credits"],
        "priceCents": entry["priceCents"],
        "currency": entry.get("currency", "eur"),
        "stripePriceId": stripe_price_id,
        "isActive": True,
        "sortOrder": entry.get("sortOrder", 0),
        "updatedAt": now,
    }
    result = await db[COLLECTION_CREDIT_PACKS].update_one(
        {"packKey": pack_key},
        {"$set": doc, "$setOnInsert": {"createdAt": now}},
        upsert=True,
    )
    if not result.upserted_id:
        existing = await db[COLLECTION_CREDIT_PACKS].find_one({"packKey": pack_key}, {"_id": 0})
        if existing:
            doc["createdAt"] = existing.get("createdAt", now)
    else:
        doc["createdAt"] = now
    return pack_public(doc)


async def dedupe_credit_packs(db) -> None:
    """Remove duplicate packKey rows left from legacy seeds before unique indexes."""
    pipeline = [
        {"$match": {"packKey": {"$exists": True, "$ne": None}}},
        {
            "$group": {
                "_id": "$packKey",
                "docs": {"$push": {"_id": "$_id", "createdAt": "$createdAt", "id": "$id"}},
                "count": {"$sum": 1},
            }
        },
        {"$match": {"count": {"$gt": 1}}},
    ]
    async for group in db[COLLECTION_CREDIT_PACKS].aggregate(pipeline):
        docs = sorted(
            group["docs"],
            key=lambda d: (
                0 if d.get("id") == group["_id"] else 1,
                d.get("createdAt") or "",
            ),
        )
        for doc in docs[1:]:
            await db[COLLECTION_CREDIT_PACKS].delete_one({"_id": doc["_id"]})


async def seed_default_credit_packs(db) -> None:
    await dedupe_credit_packs(db)
    for entry in DEFAULT_CREDIT_PACKS:
        await upsert_pack(db, entry)


def pack_stripe_price_id(pack_doc: dict) -> Optional[str]:
    return pack_doc.get("stripePriceId") or None
