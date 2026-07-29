"""Domain exceptions for the subscription engine."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class SubscriptionEngineError(Exception):
    message: str
    code: str = "subscription_error"

    def __str__(self) -> str:
        return self.message


class SubscriptionNotFoundError(SubscriptionEngineError):
    def __init__(self, user_id: str):
        self.user_id = user_id
        super().__init__(message="Subscription not found.", code="subscription_not_found")


class SubscriptionAlreadyExistsError(SubscriptionEngineError):
    def __init__(self, user_id: str):
        self.user_id = user_id
        super().__init__(
            message="User already has an active subscription.",
            code="subscription_already_exists",
        )


class InvalidSubscriptionTransitionError(SubscriptionEngineError):
    def __init__(self, *, current_status: str, action: str):
        self.current_status = current_status
        self.action = action
        super().__init__(
            message=f"Cannot {action} subscription in status '{current_status}'.",
            code="invalid_transition",
        )


class InvalidPlanChangeError(SubscriptionEngineError):
    def __init__(self, message: str):
        super().__init__(message=message, code="invalid_plan_change")


class SubscriptionConcurrencyError(SubscriptionEngineError):
    def __init__(self):
        super().__init__(
            message="Subscription operation conflict — please retry.",
            code="concurrency_conflict",
        )


class SubscriptionIdempotencyReplayError(SubscriptionEngineError):
    def __init__(self, idempotency_key: str):
        self.idempotency_key = idempotency_key
        super().__init__(
            message="Subscription event already processed.",
            code="idempotency_replay",
        )
