"""Phone Hub configuration from environment."""

from __future__ import annotations

import os
from typing import Optional

from phone.constants import (
    PHONE_SYNC_MAX_CALLS,
    VENDOR_AIRCALL,
    VENDOR_FREEPBX,
    VENDOR_MOCK,
    VENDOR_OVH,
    VENDOR_RINGOVER,
    VENDOR_3CX,
    VENDOR_TWILIO,
)


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def phone_provider_mode() -> str:
    """Active vendor mode: mock | twilio | aircall | ringover | ovh | 3cx | freepbx."""
    explicit = _env("INTEGRATIONS_PHONE_PROVIDER").lower()
    if explicit in {
        VENDOR_MOCK,
        VENDOR_TWILIO,
        VENDOR_AIRCALL,
        VENDOR_RINGOVER,
        VENDOR_OVH,
        VENDOR_3CX,
        VENDOR_FREEPBX,
    }:
        return explicit
    # Prefer first vendor that has credentials; default mock for local/dev.
    for vendor, checker in (
        (VENDOR_TWILIO, twilio_configured),
        (VENDOR_AIRCALL, aircall_configured),
        (VENDOR_RINGOVER, ringover_configured),
        (VENDOR_OVH, ovh_configured),
        (VENDOR_3CX, threecx_configured),
        (VENDOR_FREEPBX, freepbx_configured),
    ):
        if checker():
            return vendor
    return VENDOR_MOCK


def phone_configured() -> bool:
    """True when a real vendor has credentials (mock is always usable but not 'configured')."""
    mode = phone_provider_mode()
    if mode == VENDOR_MOCK:
        return _env("INTEGRATIONS_PHONE_MOCK", "1").lower() in {"1", "true", "yes", "on"}
    return {
        VENDOR_TWILIO: twilio_configured,
        VENDOR_AIRCALL: aircall_configured,
        VENDOR_RINGOVER: ringover_configured,
        VENDOR_OVH: ovh_configured,
        VENDOR_3CX: threecx_configured,
        VENDOR_FREEPBX: freepbx_configured,
    }.get(mode, lambda: False)()


def phone_ready() -> bool:
    """Hub readiness: mock always ready; real vendors need credentials."""
    mode = phone_provider_mode()
    if mode == VENDOR_MOCK:
        return True
    return phone_configured()


def phone_sync_max_calls() -> int:
    raw = _env("PHONE_SYNC_MAX_CALLS")
    if not raw:
        return PHONE_SYNC_MAX_CALLS
    try:
        return max(1, min(500, int(raw)))
    except ValueError:
        return PHONE_SYNC_MAX_CALLS


def twilio_configured() -> bool:
    return bool(_env("TWILIO_ACCOUNT_SID") and _env("TWILIO_AUTH_TOKEN"))


def aircall_configured() -> bool:
    return bool(_env("AIRCALL_API_ID") and _env("AIRCALL_API_TOKEN"))


def ringover_configured() -> bool:
    return bool(_env("RINGOVER_API_KEY"))


def ovh_configured() -> bool:
    return bool(
        _env("OVH_APPLICATION_KEY")
        and _env("OVH_APPLICATION_SECRET")
        and _env("OVH_CONSUMER_KEY")
    )


def threecx_configured() -> bool:
    return bool(_env("THREECX_API_URL") and _env("THREECX_API_TOKEN"))


def freepbx_configured() -> bool:
    return bool(_env("FREEPBX_AMI_HOST") and _env("FREEPBX_AMI_SECRET"))


def vendor_credential_hint(vendor: Optional[str] = None) -> str:
    v = (vendor or phone_provider_mode()).lower()
    hints = {
        VENDOR_TWILIO: "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN",
        VENDOR_AIRCALL: "Set AIRCALL_API_ID and AIRCALL_API_TOKEN",
        VENDOR_RINGOVER: "Set RINGOVER_API_KEY",
        VENDOR_OVH: "Set OVH_APPLICATION_KEY, OVH_APPLICATION_SECRET, OVH_CONSUMER_KEY",
        VENDOR_3CX: "Set THREECX_API_URL and THREECX_API_TOKEN",
        VENDOR_FREEPBX: "Set FREEPBX_AMI_HOST and FREEPBX_AMI_SECRET",
        VENDOR_MOCK: "Mock phone provider (no carrier credentials)",
    }
    return hints.get(v, "Unknown phone vendor")
