"""Domain exceptions for the credit engine."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class CreditEngineError(Exception):
    message: str
    code: str = "credit_error"

    def __str__(self) -> str:
        return self.message


class InsufficientCreditsError(CreditEngineError):
    def __init__(
        self,
        *,
        required: int,
        available: int,
        monthly_remaining: int,
        permanent_remaining: int,
        action_key: Optional[str] = None,
    ):
        self.required = required
        self.available = available
        self.monthly_remaining = monthly_remaining
        self.permanent_remaining = permanent_remaining
        self.action_key = action_key
        super().__init__(
            message="Insufficient AI credits.",
            code="insufficient_credits",
        )


class CreditAccountNotFoundError(CreditEngineError):
    def __init__(self, user_id: str):
        self.user_id = user_id
        super().__init__(message="Credit account not found.", code="account_not_found")


class CreditCostNotFoundError(CreditEngineError):
    def __init__(self, action_key: str):
        self.action_key = action_key
        super().__init__(
            message=f"No active cost configuration for action '{action_key}'.",
            code="cost_not_found",
        )


class CreditPlanNotFoundError(CreditEngineError):
    def __init__(self, plan_id: str):
        self.plan_id = plan_id
        super().__init__(
            message=f"Plan '{plan_id}' not found or inactive.",
            code="plan_not_found",
        )


class CreditPackNotFoundError(CreditEngineError):
    def __init__(self, pack_key: str):
        self.pack_key = pack_key
        super().__init__(
            message=f"Credit pack '{pack_key}' not found or inactive.",
            code="pack_not_found",
        )


class DevCreditPurchaseNotAllowedError(CreditEngineError):
    def __init__(self):
        super().__init__(
            message="Simulated credit purchases are not available in this environment.",
            code="dev_purchase_not_allowed",
        )


class CreditTransactionNotFoundError(CreditEngineError):
    def __init__(self, transaction_id: str):
        self.transaction_id = transaction_id
        super().__init__(
            message="Credit transaction not found.",
            code="transaction_not_found",
        )


class CreditConcurrencyError(CreditEngineError):
    def __init__(self):
        super().__init__(
            message="Credit operation conflict — please retry.",
            code="concurrency_conflict",
        )


class CreditIdempotencyConflictError(CreditEngineError):
    def __init__(self, idempotency_key: str):
        self.idempotency_key = idempotency_key
        super().__init__(
            message="A transaction with this idempotency key already exists.",
            code="idempotency_conflict",
        )
