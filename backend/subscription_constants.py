"""Central identifiers for the subscription engine."""

from typing import Literal

from commercial_constants import TRIAL_DAYS

SubscriptionStatus = Literal[
    "trial",
    "active",
    "past_due",
    "cancelled",
    "expired",
    "suspended",
]

SubscriptionEvent = Literal[
    "created",
    "trial_started",
    "activated",
    "renewed",
    "plan_changed",
    "upgraded",
    "downgraded",
    "cancelled",
    "cancellation_scheduled",
    "reactivated",
    "expired",
    "suspended",
    "resumed",
    "past_due",
]

# Plan tier ordering for upgrade/downgrade detection.
PLAN_TIER_ORDER = {
    "solo": 1,
    "pro": 2,
    "team": 3,
}

# Statuses that entitle the user to monthly credit allocation.
CREDIT_ELIGIBLE_STATUSES = frozenset({"trial", "active", "past_due"})

COLLECTION_SUBSCRIPTIONS = "user_subscriptions"
COLLECTION_HISTORY = "subscription_history"
