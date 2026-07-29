"""Domain exceptions for Stripe integration."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class StripeIntegrationError(Exception):
    message: str
    code: str = "stripe_error"

    def __str__(self) -> str:
        return self.message


class StripeNotConfiguredError(StripeIntegrationError):
    def __init__(self):
        super().__init__(
            message="Stripe billing is not configured.",
            code="stripe_not_configured",
        )


class StripeWebhookError(StripeIntegrationError):
    def __init__(self, message: str = "Invalid Stripe webhook."):
        super().__init__(message=message, code="stripe_webhook_error")


class StripeCheckoutError(StripeIntegrationError):
    def __init__(self, message: str):
        super().__init__(message=message, code="stripe_checkout_error")


class StripeCustomerError(StripeIntegrationError):
    def __init__(self, message: str):
        super().__init__(message=message, code="stripe_customer_error")


class StripePlanError(StripeIntegrationError):
    def __init__(self, message: str):
        super().__init__(message=message, code="stripe_plan_error")


class StripeSubscriptionConflictError(StripeIntegrationError):
    def __init__(self, message: str = "User already has an active subscription."):
        super().__init__(message=message, code="subscription_conflict")


class StripePriceNotConfiguredError(StripeIntegrationError):
    def __init__(self, plan_id: str):
        self.plan_id = plan_id
        super().__init__(
            message=f"Stripe price is not configured for plan '{plan_id}'.",
            code="stripe_price_not_configured",
        )
