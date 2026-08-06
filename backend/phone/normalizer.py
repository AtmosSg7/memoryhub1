"""PhoneNormalizer — FR-aware digits + identity keys for Phone Hub."""

from __future__ import annotations

import re
from typing import Optional

from phone.constants import CallDirection, CallStatus, CALL_STATUSES
from phone.models import PhoneCall, PhoneIdentity, RemoteCall

# Re-export shared FR normalizer so Phone Hub and Contacts stay aligned.
from integrations.matching import normalize_phone_fr


class PhoneNormalizer:
    """Normalize phones, directions, statuses and remote calls → PhoneCall."""

    @staticmethod
    def normalize_phone(value: Optional[str]) -> str:
        return normalize_phone_fr(value)

    @staticmethod
    def to_e164_fr(value: Optional[str]) -> Optional[str]:
        digits = normalize_phone_fr(value)
        if not digits:
            return None
        if digits.startswith("0") and len(digits) >= 9:
            return "+33" + digits[1:]
        if digits.startswith("33") and len(digits) >= 11:
            return "+" + digits
        if value and str(value).strip().startswith("+"):
            cleaned = re.sub(r"[^\d+]", "", str(value).strip())
            return cleaned or None
        return None

    @classmethod
    def identity(cls, value: Optional[str]) -> Optional[PhoneIdentity]:
        raw = (value or "").strip()
        normalized = cls.normalize_phone(raw)
        if not normalized:
            return None
        return PhoneIdentity(
            raw=raw,
            normalized=normalized,
            e164=cls.to_e164_fr(raw),
            identityKey=f"phone:{normalized}",
        )

    @staticmethod
    def normalize_direction(value: Optional[str]) -> CallDirection:
        v = (value or "").strip().lower()
        if v in {"outgoing", "outbound", "out", "placed"}:
            return "outgoing"
        return "incoming"

    @staticmethod
    def normalize_status(
        value: Optional[str],
        *,
        direction: CallDirection = "incoming",
        voicemail: bool = False,
    ) -> CallStatus:
        if voicemail:
            return "voicemail"
        v = (value or "").strip().lower()
        aliases = {
            "missed": "missed",
            "no-answer": "missed",
            "no_answer": "missed",
            "unanswered": "missed",
            "voicemail": "voicemail",
            "voice_mail": "voicemail",
            "rejected": "rejected",
            "declined": "rejected",
            "busy": "busy",
            "blocked": "blocked",
            "spam": "spam",
            "failed": "failed",
            "completed": "answered",
            "answered": "answered",
            "success": "answered",
            "incoming": "incoming",
            "outgoing": "outgoing",
        }
        mapped = aliases.get(v)
        if mapped in CALL_STATUSES:
            return mapped  # type: ignore[return-value]
        if direction == "outgoing":
            return "outgoing"
        if direction == "incoming":
            return "incoming"
        return "unknown"

    @classmethod
    def remote_to_phone_call(
        cls,
        remote: RemoteCall,
        *,
        client_id: Optional[str] = None,
        matched_by: Optional[str] = None,
        connected_account_id: Optional[str] = None,
    ) -> PhoneCall:
        phone = remote.counterpartyPhone or remote.phoneNumber
        identity = cls.identity(phone)
        direction = cls.normalize_direction(remote.direction)
        status = cls.normalize_status(
            remote.status, direction=direction, voicemail=bool(remote.voicemail)
        )
        return PhoneCall(
            provider=remote.provider or "phone",
            vendor=remote.vendor or "mock",
            providerCallId=remote.providerCallId,
            clientId=client_id,
            phoneNumber=phone or "",
            normalizedPhone=(identity.normalized if identity else ""),
            startedAt=remote.startedAt,
            endedAt=remote.endedAt,
            duration=remote.duration,
            direction=direction,
            status=status,
            recordingUrl=remote.recordingUrl,
            voicemail=bool(remote.voicemail) or status == "voicemail",
            notes=remote.notes,
            attachments=list(remote.attachments or []),
            matchedBy=matched_by,
            connectedAccountId=connected_account_id,
        )
