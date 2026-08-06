"""Centralized AI action costs — editable without touching application code."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from credit_constants import COLLECTION_COSTS, CreditActionKey
from credit_exceptions import CreditCostNotFoundError
from credit_models import CreditCostPublic


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def cost_public(doc: dict) -> CreditCostPublic:
    return CreditCostPublic(
        actionKey=doc["actionKey"],
        label=doc["label"],
        defaultCost=doc["defaultCost"],
        supportsTiers=bool(doc.get("supportsTiers", False)),
        tierCosts=doc.get("tierCosts"),
        isActive=bool(doc.get("isActive", True)),
    )


async def get_cost_config(db, action_key: str) -> CreditCostPublic:
    doc = await db[COLLECTION_COSTS].find_one(
        {"actionKey": action_key, "isActive": True},
        {"_id": 0},
    )
    if not doc:
        raise CreditCostNotFoundError(action_key)
    return cost_public(doc)


async def list_active_costs(db) -> List[CreditCostPublic]:
    cursor = db[COLLECTION_COSTS].find({"isActive": True}, {"_id": 0}).sort("actionKey", 1)
    return [cost_public(doc) async for doc in cursor]


async def resolve_cost(
    db,
    action_key: str,
    *,
    tier_key: Optional[str] = None,
    override_cost: Optional[int] = None,
) -> int:
    """Resolve the credit cost for an action. Override allows pre-calculated import costs."""
    if override_cost is not None:
        if override_cost < 0:
            raise ValueError("override_cost must be non-negative.")
        return override_cost

    config = await get_cost_config(db, action_key)
    if tier_key and config.supportsTiers and config.tierCosts:
        tier_cost = config.tierCosts.get(tier_key)
        if tier_cost is not None:
            return tier_cost
    return config.defaultCost


async def upsert_cost(
    db,
    *,
    action_key: CreditActionKey,
    label: str,
    default_cost: int,
    supports_tiers: bool = False,
    tier_costs: Optional[dict] = None,
    is_active: bool = True,
) -> CreditCostPublic:
    now = _now_iso()
    doc = {
        "id": action_key,
        "actionKey": action_key,
        "label": label,
        "defaultCost": default_cost,
        "supportsTiers": supports_tiers,
        "tierCosts": tier_costs,
        "isActive": is_active,
        "updatedAt": now,
    }
    existing = await db[COLLECTION_COSTS].find_one({"actionKey": action_key}, {"_id": 1, "createdAt": 1})
    if existing:
        doc["createdAt"] = existing.get("createdAt", now)
        await db[COLLECTION_COSTS].update_one({"actionKey": action_key}, {"$set": doc})
    else:
        doc["createdAt"] = now
        await db[COLLECTION_COSTS].insert_one(doc)
    return cost_public(doc)


DEFAULT_COSTS = [
    {
        "actionKey": "IMPORT_DOCUMENT",
        "label": "Import intelligent",
        "defaultCost": 12,
        "supportsTiers": True,
        "tierCosts": {
            "simple": 8,
            "standard": 12,
            "complex": 20,
            "very_complex": 35,
        },
    },
    {
        "actionKey": "EMAIL_GENERATION",
        "label": "Génération e-mail",
        "defaultCost": 3,
        "supportsTiers": False,
    },
    {
        "actionKey": "SUMMARY",
        "label": "Résumé client",
        "defaultCost": 5,
        "supportsTiers": False,
    },
    {
        "actionKey": "CLIENT_ANALYSIS",
        "label": "Analyse client",
        "defaultCost": 8,
        "supportsTiers": False,
    },
    {
        "actionKey": "SEARCH_AI",
        "label": "Recherche IA",
        "defaultCost": 2,
        "supportsTiers": False,
    },
    {
        "actionKey": "COMMUNICATION_ANALYSIS",
        "label": "Analyse de communication",
        "defaultCost": 5,
        "supportsTiers": False,
    },
]


async def seed_default_costs(db) -> None:
    for entry in DEFAULT_COSTS:
        await upsert_cost(
            db,
            action_key=entry["actionKey"],
            label=entry["label"],
            default_cost=entry["defaultCost"],
            supports_tiers=entry.get("supportsTiers", False),
            tier_costs=entry.get("tierCosts"),
        )
