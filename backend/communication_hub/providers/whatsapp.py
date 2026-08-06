"""WhatsApp provider stub — architecture only (no Meta Cloud API yet)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from communication_hub.constants import CHANNEL_WHATSAPP, PROVIDER_WHATSAPP
from communication_hub.providers.base import ChannelProvider


class WhatsAppProvider(ChannelProvider):
    """Reserved WhatsApp channel.

    Future wiring:
    - WA conversation id → Hub conversationKey
    - WA message id → communications.providerId
    - WA identity → whatsapp:<wa_id> / phone:<e164>
    - Timeline already maps type whatsapp via timeline_service
    """

    provider_id = PROVIDER_WHATSAPP
    channel = CHANNEL_WHATSAPP

    def is_configured(self) -> bool:
        return False

    def is_ready(self) -> bool:
        return False

    def normalize_identity(self, raw: Dict[str, Any]) -> Optional[str]:
        wa_id = (raw.get("waId") or raw.get("from") or raw.get("phone") or "").strip()
        if not wa_id:
            return None
        return f"whatsapp:{wa_id}"

    def conversation_key_parts(self, raw: Dict[str, Any]) -> List[str]:
        thread = (raw.get("conversationId") or raw.get("threadId") or "").strip()
        if thread:
            return [self.channel, self.provider_id, "thread", thread]
        identity = self.normalize_identity(raw)
        if identity:
            return [self.channel, self.provider_id, identity]
        return []

    async def sync(self, db, user_id: str, **kwargs: Any) -> Dict[str, Any]:
        raise NotImplementedError(
            "WhatsApp sync is reserved. Connect Meta Cloud API (or a BSP) to enable it."
        )
