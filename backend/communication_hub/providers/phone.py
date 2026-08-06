"""Hub ChannelProvider adapter — delegates normalize/readiness to Phone Hub."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from communication_hub.constants import CHANNEL_PHONE, PROVIDER_PHONE
from communication_hub.providers.base import ChannelProvider


class PhoneProvider(ChannelProvider):
    """Hub-facing phone channel.

    Live sync / vendor APIs live in ``phone.*`` (Phone Hub). This adapter only
    exposes readiness + identity for Hub registry / conversation keys.
    """

    provider_id = PROVIDER_PHONE
    channel = CHANNEL_PHONE

    def is_configured(self) -> bool:
        try:
            from phone.config import phone_configured

            return bool(phone_configured())
        except Exception:
            return False

    def is_ready(self) -> bool:
        try:
            from phone.config import phone_ready

            return bool(phone_ready())
        except Exception:
            return False

    def normalize_identity(self, raw: Dict[str, Any]) -> Optional[str]:
        try:
            from phone.normalizer import PhoneNormalizer

            identity = PhoneNormalizer.identity(
                raw.get("phone")
                or raw.get("fromPhone")
                or raw.get("toPhone")
                or raw.get("phoneNumber")
            )
            return identity.identityKey if identity else None
        except Exception:
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
        from phone.sync_service import sync_phone

        result = await sync_phone(db, user_id)
        return result.model_dump() if hasattr(result, "model_dump") else dict(result)


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
    """Legacy stub shape — prefer ``phone.models.RemoteCall`` for new code."""
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
