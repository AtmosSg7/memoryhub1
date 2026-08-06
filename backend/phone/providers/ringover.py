"""Ringover interface — architecture only."""

from __future__ import annotations

from phone.config import ringover_configured
from phone.constants import VENDOR_RINGOVER
from phone.providers._vendor_stub import UnconfiguredVendorProvider


class RingoverPhoneProvider(UnconfiguredVendorProvider):
    vendor_id = VENDOR_RINGOVER
    display_name = "Ringover"

    def is_configured(self) -> bool:
        return ringover_configured()

    def is_ready(self) -> bool:
        return False
