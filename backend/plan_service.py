"""Plan catalog — subscription tiers and monthly credit allocations."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from credit_constants import COLLECTION_PLANS
from credit_exceptions import CreditPlanNotFoundError
from analysis_presentation_service import credits_to_analyses
from credit_models import CreditPlanPublic
from commercial_constants import DEFAULT_PLANS


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def plan_public(doc: dict) -> CreditPlanPublic:
    return CreditPlanPublic(
        id=doc["id"],
        name=doc["name"],
        monthlyAnalyses=credits_to_analyses(int(doc["monthlyCredits"])),
        isActive=bool(doc.get("isActive", True)),
        sortOrder=int(doc.get("sortOrder", 0)),
    )


async def get_plan_doc(db, plan_id: str) -> dict:
    doc = await db[COLLECTION_PLANS].find_one(
        {"id": plan_id, "isActive": True},
        {"_id": 0},
    )
    if not doc:
        raise CreditPlanNotFoundError(plan_id)
    return doc


async def get_plan(db, plan_id: str) -> CreditPlanPublic:
    return plan_public(await get_plan_doc(db, plan_id))


async def list_active_plans(db) -> List[CreditPlanPublic]:
    cursor = (
        db[COLLECTION_PLANS]
        .find({"isActive": True}, {"_id": 0})
        .sort("sortOrder", 1)
    )
    return [plan_public(doc) async for doc in cursor]


async def upsert_plan(
    db,
    *,
    plan_id: str,
    name: str,
    monthly_credits: int,
    sort_order: int = 0,
    is_active: bool = True,
) -> CreditPlanPublic:
    now = _now_iso()
    doc = {
        "id": plan_id,
        "name": name,
        "monthlyCredits": monthly_credits,
        "isActive": is_active,
        "sortOrder": sort_order,
        "updatedAt": now,
    }
    existing = await db[COLLECTION_PLANS].find_one({"id": plan_id}, {"_id": 1, "createdAt": 1})
    if existing:
        doc["createdAt"] = existing.get("createdAt", now)
        await db[COLLECTION_PLANS].update_one({"id": plan_id}, {"$set": doc})
    else:
        doc["createdAt"] = now
        await db[COLLECTION_PLANS].insert_one(doc)
    return plan_public(doc)


async def seed_default_plans(db) -> None:
    for plan in DEFAULT_PLANS:
        await upsert_plan(
            db,
            plan_id=plan["id"],
            name=plan["name"],
            monthly_credits=plan["monthlyCredits"],
            sort_order=plan["sortOrder"],
        )
