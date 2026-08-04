"""Single source of truth for public plan pricing and credit allocations."""

from __future__ import annotations

from analysis_constants import CREDITS_PER_ANALYSIS

TRIAL_DAYS = 14

# User-facing imports/month → internal credits (1 import = CREDITS_PER_ANALYSIS credits).
_STARTER_IMPORTS = 10
_PRO_IMPORTS = 20
_BUSINESS_IMPORTS = 50

PLAN_CATALOG = (
    {
        "id": "solo",
        "name": "Starter",
        "monthlyPriceEur": 4.9,
        "monthlyCredits": _STARTER_IMPORTS * CREDITS_PER_ANALYSIS,
        "sortOrder": 1,
    },
    {
        "id": "pro",
        "name": "Pro",
        "monthlyPriceEur": 9.9,
        "monthlyCredits": _PRO_IMPORTS * CREDITS_PER_ANALYSIS,
        "sortOrder": 2,
    },
    {
        "id": "team",
        "name": "Business",
        "monthlyPriceEur": 19.9,
        "monthlyCredits": _BUSINESS_IMPORTS * CREDITS_PER_ANALYSIS,
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
