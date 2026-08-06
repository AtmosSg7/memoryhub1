"""Phone Hub constants — shared by telephony vendors (Twilio, Aircall, …)."""

from __future__ import annotations

from typing import Literal

# Canonical channel / account provider key in connected_accounts + communications.
PROVIDER_PHONE = "phone"
CHANNEL_PHONE = "phone"

# Vendor ids reserved for future OAuth / API connectors.
VENDOR_MOCK = "mock"
VENDOR_TWILIO = "twilio"
VENDOR_AIRCALL = "aircall"
VENDOR_RINGOVER = "ringover"
VENDOR_OVH = "ovh"
VENDOR_3CX = "3cx"
VENDOR_FREEPBX = "freepbx"

PHONE_VENDORS = (
    VENDOR_MOCK,
    VENDOR_TWILIO,
    VENDOR_AIRCALL,
    VENDOR_RINGOVER,
    VENDOR_OVH,
    VENDOR_3CX,
    VENDOR_FREEPBX,
)

CallDirection = Literal["incoming", "outgoing"]

CallStatus = Literal[
    "incoming",
    "outgoing",
    "missed",
    "voicemail",
    "rejected",
    "blocked",
    "spam",
    "answered",
    "busy",
    "failed",
    "unknown",
]

CALL_STATUSES = (
    "incoming",
    "outgoing",
    "missed",
    "voicemail",
    "rejected",
    "blocked",
    "spam",
    "answered",
    "busy",
    "failed",
    "unknown",
)

# Communication Center uses inbound/outbound; map from CallDirection.
DIRECTION_TO_COMM = {
    "incoming": "inbound",
    "outgoing": "outbound",
}

ACCOUNT_STATUS_CONNECTED = "connected"
ACCOUNT_STATUS_DISCONNECTED = "disconnected"
ACCOUNT_STATUS_ERROR = "error"

PHONE_SYNC_STATE_IDLE = "idle"
PHONE_SYNC_STATE_RUNNING = "running"
PHONE_SYNC_STATE_ERROR = "error"

PHONE_SYNC_MAX_CALLS = 100

CALL_RESULT_LINKED = "linked"
CALL_RESULT_UNMATCHED = "unmatched"
CALL_RESULT_SKIPPED = "skipped"
