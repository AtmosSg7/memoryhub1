"""PDP configuration constants — no vendor-specific values."""

from __future__ import annotations

from typing import Literal

PDP_ENV_SANDBOX = "sandbox"
PDP_ENV_PRODUCTION = "production"

PdpEnvironment = Literal["sandbox", "production"]

DEFAULT_PDP_PROVIDER_KEY = "default"

ENV_PDP_ENV = "PDP_ENV"
ENV_PDP_PROVIDER = "PDP_PROVIDER"

PdpDispatchStatus = Literal[
    "pending",
    "submitted",
    "accepted",
    "rejected",
    "cancelled",
]
