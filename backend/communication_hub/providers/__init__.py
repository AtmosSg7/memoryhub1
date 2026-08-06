"""Multi-channel provider registry (Hub V2)."""

from __future__ import annotations

from typing import Dict, Optional

from communication_hub.constants import (
    PROVIDER_GMAIL,
    PROVIDER_PHONE,
    PROVIDER_WHATSAPP,
)
from communication_hub.providers.base import ChannelProvider
from communication_hub.providers.phone import PhoneProvider
from communication_hub.providers.whatsapp import WhatsAppProvider


class GmailChannelAdapter(ChannelProvider):
    """Thin adapter: live Gmail sync stays in integrations.*; Hub only needs identity."""

    provider_id = PROVIDER_GMAIL
    channel = "email"

    def is_configured(self) -> bool:
        try:
            from integrations.config import gmail_configured

            return bool(gmail_configured())
        except Exception:
            return False

    def is_ready(self) -> bool:
        return self.is_configured()


_REGISTRY: Dict[str, ChannelProvider] = {
    PROVIDER_GMAIL: GmailChannelAdapter(),
    PROVIDER_PHONE: PhoneProvider(),
    PROVIDER_WHATSAPP: WhatsAppProvider(),
}


def get_channel_provider(provider_id: str) -> Optional[ChannelProvider]:
    return _REGISTRY.get((provider_id or "").strip().lower())


def list_channel_providers() -> Dict[str, ChannelProvider]:
    return dict(_REGISTRY)
