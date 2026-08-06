"""Phone provider stub — architecture only (no carrier / VoIP API yet)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from communication_hub.constants import CHANNEL_PHONE, PROVIDER_PHONE
from communication_hub.providers.base import ChannelProvider


class PhoneProvider(ChannelProvider):
    """Reserved phone channel.

    Future wiring:
    - Phone Conversation → communication_hub conversations (channel=phone)
    - Phone Event → communications.type=phone + timeline call_logged
    - Phone Identity → prospects.identity phone:<e164>
    - Phone Timeline → Timeline V2 COMM_TYPES already includes call_logged
    """

    provider_id = PROVIDER_PHONE
    channel = CHANNEL_PHONE

    def is_configured(self) -> bool:
        return False

    def is_ready(self) -> bool:
        return False

    def normalize_identity(self, raw: Dict[str, Any]) -> Optional[str]:
        phone = (raw.get("phone") or raw.get("fromPhone") or raw.get("toPhone") or "").strip()
        if not phone:
            return None
        digits = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
        return f"phone:{digits}" if digits else None

    def conversation_key_parts(self, raw: Dict[str, Any]) -> List[str]:
        identity = self.normalize_identity(raw)
        if identity:
            return [self.channel, self.provider_id, identity]
        call_id = (raw.get("callId") or raw.get("providerId") or "").strip()
        if call_id:
            return [self.channel, self.provider_id, "call", call_id]
        return []

    async def sync(self, db, user_id: str, **kwargs: Any) -> Dict[str, Any]:
        raise NotImplementedError(
            "Phone sync is reserved. Connect a telephony provider to enable it."
        )


def build_phone_event_stub(
    *,
    user_id: str,
    call_id: str,
    direction: str,
    from_phone: Optional[str] = None,
    to_phone: Optional[str] = None,
    duration_seconds: Optional[int] = None,
    client_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Shape of a future phone ingest payload (not persisted by itself)."""
    return {
        "userId": user_id,
        "type": CHANNEL_PHONE,
        "provider": PROVIDER_PHONE,
        "providerId": call_id,
        "direction": direction,
        "clientId": client_id,
        "fromPhone": from_phone,
        "toPhone": to_phone,
        "durationSeconds": duration_seconds,
        "channel": CHANNEL_PHONE,
    }
