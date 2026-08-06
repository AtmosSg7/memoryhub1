"""Twilio Voice interface — architecture only."""

from __future__ import annotations

from phone.config import twilio_configured
from phone.constants import VENDOR_TWILIO
from phone.providers._vendor_stub import UnconfiguredVendorProvider


class TwilioPhoneProvider(UnconfiguredVendorProvider):
    vendor_id = VENDOR_TWILIO
    display_name = "Twilio"

    def is_configured(self) -> bool:
        return twilio_configured()

    def is_ready(self) -> bool:
        return False  # API client not wired yet
