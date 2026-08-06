"""Aircall interface — architecture only."""

from __future__ import annotations

from phone.config import aircall_configured
from phone.constants import VENDOR_AIRCALL
from phone.providers._vendor_stub import UnconfiguredVendorProvider


class AircallPhoneProvider(UnconfiguredVendorProvider):
    vendor_id = VENDOR_AIRCALL
    display_name = "Aircall"

    def is_configured(self) -> bool:
        return aircall_configured()

    def is_ready(self) -> bool:
        return False
