"""Telephony vendor adapters."""

from phone.providers.mock_phone import MockPhoneProvider
from phone.providers.twilio import TwilioPhoneProvider
from phone.providers.aircall import AircallPhoneProvider
from phone.providers.ringover import RingoverPhoneProvider
from phone.providers.ovh import OvhPhoneProvider
from phone.providers.threecx import ThreeCXPhoneProvider
from phone.providers.freepbx import FreePBXPhoneProvider

__all__ = [
    "MockPhoneProvider",
    "TwilioPhoneProvider",
    "AircallPhoneProvider",
    "RingoverPhoneProvider",
    "OvhPhoneProvider",
    "ThreeCXPhoneProvider",
    "FreePBXPhoneProvider",
]
