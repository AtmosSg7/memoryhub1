"""Single source of truth for public plan pricing and credit allocations."""

from __future__ import annotations

TRIAL_DAYS = 14

PLAN_CATALOG = (
    {
        "id": "solo",
        "name": "Solo",
        "monthlyPriceEur": 19,
        "monthlyCredits": 1000,
        "sortOrder": 1,
    },
    {
        "id": "pro",
        "name": "Pro",
        "monthlyPriceEur": 49,
        "monthlyCredits": 4000,
        "sortOrder": 2,
    },
    {
        "id": "team",
        "name": "Team",
        "monthlyPriceEur": 99,
        "monthlyCredits": 10000,
        "sortOrder": 3,
    },
)

PLAN_IDS = tuple(plan["id"] for plan in PLAN_CATALOG)
PLAN_CREDITS_BY_ID = {plan["id"]: plan["monthlyCredits"] for plan in PLAN_CATALOG}
PLAN_PRICE_EUR_BY_ID = {plan["id"]: plan["monthlyPriceEur"] for plan in PLAN_CATALOG}

DEFAULT_PLANS = [
    {
        "id": plan["id"],
        "name": plan["name"],
        "monthlyCredits": plan["monthlyCredits"],
        "sortOrder": plan["sortOrder"],
    }
    for plan in PLAN_CATALOG
]
