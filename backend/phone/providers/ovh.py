"""OVH Téléphonie interface — architecture only."""

from __future__ import annotations

from phone.config import ovh_configured
from phone.constants import VENDOR_OVH
from phone.providers._vendor_stub import UnconfiguredVendorProvider


class OvhPhoneProvider(UnconfiguredVendorProvider):
    vendor_id = VENDOR_OVH
    display_name = "OVH Téléphonie"

    def is_configured(self) -> bool:
        return ovh_configured()

    def is_ready(self) -> bool:
        return False
