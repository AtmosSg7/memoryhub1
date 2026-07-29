"""Stripe configuration from environment — no secrets in code."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict, Optional

from stripe_exceptions import StripeNotConfiguredError, StripePriceNotConfiguredError


@dataclass(frozen=True)
class StripeSettings:
    secret_key: str
    webhook_secret: str
    price_solo: str
    price_pro: str
    price_team: str
    success_url: str
    cancel_url: str
    is_test_mode: bool


def _is_test_key(key: str) -> bool:
    return key.startswith("sk_test_")


def stripe_configured() -> bool:
    key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    return bool(key)


def get_stripe_settings() -> Optional[StripeSettings]:
    secret = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    if not secret:
        return None
    webhook = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()
    solo = os.environ.get("STRIPE_PRICE_SOLO", "").strip()
    pro = os.environ.get("STRIPE_PRICE_PRO", "").strip()
    team = os.environ.get("STRIPE_PRICE_TEAM", "").strip()
    success = os.environ.get("STRIPE_SUCCESS_URL", "").strip()
    cancel = os.environ.get("STRIPE_CANCEL_URL", "").strip()
    if not all([webhook, solo, pro, team, success, cancel]):
        return None
    return StripeSettings(
        secret_key=secret,
        webhook_secret=webhook,
        price_solo=solo,
        price_pro=pro,
        price_team=team,
        success_url=success,
        cancel_url=cancel,
        is_test_mode=_is_test_key(secret),
    )


def require_stripe_settings() -> StripeSettings:
    settings = get_stripe_settings()
    if not settings:
        raise StripeNotConfiguredError()
    return settings


def plan_to_price_id(plan_id: str) -> str:
    settings = require_stripe_settings()
    mapping = {
        "solo": settings.price_solo,
        "pro": settings.price_pro,
        "team": settings.price_team,
    }
    price_id = mapping.get(plan_id)
    if not price_id:
        raise StripePriceNotConfiguredError(plan_id)
    return price_id


def price_id_to_plan_id(price_id: str) -> Optional[str]:
    settings = get_stripe_settings()
    if not settings:
        return None
    mapping: Dict[str, str] = {
        settings.price_solo: "solo",
        settings.price_pro: "pro",
        settings.price_team: "team",
    }
    return mapping.get(price_id)


def configured_price_ids() -> Dict[str, str]:
    settings = get_stripe_settings()
    if not settings:
        return {}
    return {
        "solo": settings.price_solo,
        "pro": settings.price_pro,
        "team": settings.price_team,
    }
