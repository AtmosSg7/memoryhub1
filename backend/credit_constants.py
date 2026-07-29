"""Central identifiers for the AI credit engine — single source of truth."""

from typing import Literal

# AI action keys — every AI consumption must reference one of these.
CreditActionKey = Literal[
    "IMPORT_DOCUMENT",
    "EMAIL_GENERATION",
    "SUMMARY",
    "CLIENT_ANALYSIS",
    "SEARCH_AI",
]

# Complexity tiers for variable-cost actions (import estimation via ai_import_estimator).
ImportComplexityTier = Literal["simple", "standard", "complex", "very_complex"]

# Ledger transaction categories.
CreditTransactionType = Literal[
    "debit",              # AI consumption
    "monthly_grant",      # subscription period allocation
    "permanent_grant",    # purchased credits
    "bonus",              # promotional credits (permanent)
    "admin_grant",        # manual operator grant (permanent)
    "refund",             # credit return (permanent)
    "rollback",           # reversal of a prior debit
    "monthly_expiry",     # unused monthly credits expired at period end
]

# Grant source labels stored on transactions for auditing.
CreditGrantSource = Literal[
    "subscription",
    "purchase",
    "bonus",
    "admin",
    "refund",
    "rollback",
]

DEFAULT_PLAN_ID = "solo"

# Collection names (documented for operators).
COLLECTION_PLANS = "credit_plans"
COLLECTION_COSTS = "credit_costs"
COLLECTION_ACCOUNTS = "user_credit_accounts"
COLLECTION_TRANSACTIONS = "credit_transactions"
COLLECTION_CREDIT_PACKS = "credit_packs"
COLLECTION_CREDIT_PURCHASES = "credit_purchases"
