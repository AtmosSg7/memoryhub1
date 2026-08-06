"""FreePBX / Asterisk AMI interface — architecture only."""

from __future__ import annotations

from phone.config import freepbx_configured
from phone.constants import VENDOR_FREEPBX
from phone.providers._vendor_stub import UnconfiguredVendorProvider


class FreePBXPhoneProvider(UnconfiguredVendorProvider):
    vendor_id = VENDOR_FREEPBX
    display_name = "FreePBX"

    def is_configured(self) -> bool:
        return freepbx_configured()

    def is_ready(self) -> bool:
        return False
