"""Seed catalog data for plans, action costs, and credit packs (idempotent)."""

from __future__ import annotations

from credit_cost_service import seed_default_costs
from credit_pack_service import seed_default_credit_packs
from plan_service import seed_default_plans


async def seed_credit_catalog(db) -> None:
    await seed_default_plans(db)
    await seed_default_costs(db)
    await seed_default_credit_packs(db)
