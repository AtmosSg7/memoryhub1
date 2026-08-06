"""Channel provider protocol — every future connector implements this shape."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class ChannelProvider(ABC):
    """Abstract multi-channel provider.

    Implementations normalize remote payloads into Communication Center docs.
    Phone / WhatsApp stubs exist so wiring a real API later is additive.
    """

    provider_id: str
    channel: str

    @abstractmethod
    def is_configured(self) -> bool:
        """True when credentials / env allow live use."""

    @abstractmethod
    def is_ready(self) -> bool:
        """True when the provider can sync (configured + not reserved-only)."""

    async def sync(self, db, user_id: str, **kwargs: Any) -> Dict[str, Any]:
        """Optional sync entrypoint. Default: not implemented."""
        raise NotImplementedError(f"{self.provider_id} sync is not implemented yet.")

    def normalize_identity(self, raw: Dict[str, Any]) -> Optional[str]:
        """Return a stable identity key for prospect / conversation grouping."""
        return None

    def conversation_key_parts(self, raw: Dict[str, Any]) -> List[str]:
        """Parts used to build a conversation key (channel-specific)."""
        return []
