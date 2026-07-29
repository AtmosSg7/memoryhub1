"""PDP runtime configuration — environment selection only, no API credentials."""

from __future__ import annotations

import os
from typing import Optional

from pdp.constants import (
    DEFAULT_PDP_PROVIDER_KEY,
    ENV_PDP_ENV,
    ENV_PDP_PROVIDER,
    PDP_ENV_PRODUCTION,
    PDP_ENV_SANDBOX,
    PdpEnvironment,
)


def get_pdp_environment() -> PdpEnvironment:
    """Return active PDP environment (sandbox by default)."""
    raw = os.environ.get(ENV_PDP_ENV, PDP_ENV_SANDBOX).strip().lower()
    if raw == PDP_ENV_PRODUCTION:
        return PDP_ENV_PRODUCTION
    return PDP_ENV_SANDBOX


def get_default_pdp_provider_key() -> str:
    """Return configured default provider key when callers omit an explicit choice."""
    raw = os.environ.get(ENV_PDP_PROVIDER, DEFAULT_PDP_PROVIDER_KEY).strip()
    return raw or DEFAULT_PDP_PROVIDER_KEY


def is_pdp_provider_registered(provider_key: Optional[str] = None) -> bool:
    """True when at least one provider (or the requested key) is registered."""
    from pdp.registry import get_pdp_provider, list_pdp_providers

    if provider_key:
        return get_pdp_provider(provider_key) is not None
    return bool(list_pdp_providers())
