"""3CX interface — architecture only."""

from __future__ import annotations

from phone.config import threecx_configured
from phone.constants import VENDOR_3CX
from phone.providers._vendor_stub import UnconfiguredVendorProvider


class ThreeCXPhoneProvider(UnconfiguredVendorProvider):
    vendor_id = VENDOR_3CX
    display_name = "3CX"

    def is_configured(self) -> bool:
        return threecx_configured()

    def is_ready(self) -> bool:
        return False
