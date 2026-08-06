"""Resolve the active PhoneProvider from configuration."""

from __future__ import annotations

from typing import Dict, Optional

from phone.config import phone_provider_mode
from phone.constants import (
    PHONE_VENDORS,
    VENDOR_AIRCALL,
    VENDOR_FREEPBX,
    VENDOR_MOCK,
    VENDOR_OVH,
    VENDOR_RINGOVER,
    VENDOR_3CX,
    VENDOR_TWILIO,
)
from phone.provider import PhoneProvider
from phone.providers.aircall import AircallPhoneProvider
from phone.providers.freepbx import FreePBXPhoneProvider
from phone.providers.mock_phone import MockPhoneProvider
from phone.providers.ovh import OvhPhoneProvider
from phone.providers.ringover import RingoverPhoneProvider
from phone.providers.threecx import ThreeCXPhoneProvider
from phone.providers.twilio import TwilioPhoneProvider

_PROVIDERS: Dict[str, PhoneProvider] = {
    VENDOR_MOCK: MockPhoneProvider(),
    VENDOR_TWILIO: TwilioPhoneProvider(),
    VENDOR_AIRCALL: AircallPhoneProvider(),
    VENDOR_RINGOVER: RingoverPhoneProvider(),
    VENDOR_OVH: OvhPhoneProvider(),
    VENDOR_3CX: ThreeCXPhoneProvider(),
    VENDOR_FREEPBX: FreePBXPhoneProvider(),
}


def get_phone_provider(vendor: Optional[str] = None) -> PhoneProvider:
    key = (vendor or phone_provider_mode() or VENDOR_MOCK).strip().lower()
    return _PROVIDERS.get(key) or _PROVIDERS[VENDOR_MOCK]


def list_phone_vendors() -> Dict[str, PhoneProvider]:
    return {k: _PROVIDERS[k] for k in PHONE_VENDORS if k in _PROVIDERS}
