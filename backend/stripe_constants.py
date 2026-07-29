"""Stripe integration identifiers."""

from typing import Literal

COLLECTION_STRIPE_EVENTS = "stripe_events"

StripeEventStatus = Literal["processed", "ignored", "failed"]

HANDLED_STRIPE_EVENT_TYPES = frozenset({
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
})

STRIPE_TO_SUBSCRIPTION_STATUS = {
    "trialing": "trial",
    "active": "active",
    "past_due": "past_due",
    "canceled": "cancelled",
    "unpaid": "past_due",
    "paused": "suspended",
    "incomplete": "past_due",
    "incomplete_expired": "expired",
}
