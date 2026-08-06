"""PhoneProvider — ABC for telephony vendors (Twilio, Aircall, Ringover, …)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Optional

from phone.models import RemoteCall


class PhoneProvider(ABC):
    """Vendor connector contract.

    Real OAuth / API wiring lands in subclasses. Architecture-only vendors raise
    NotImplementedError from live methods until credentials exist.
    """

    vendor_id: str
    display_name: str

    @abstractmethod
    def is_configured(self) -> bool:
        """True when env credentials for this vendor are present."""

    @abstractmethod
    def is_ready(self) -> bool:
        """True when the vendor can list/sync calls (mock is ready without secrets)."""

    async def connect(self, *, user_id: str, credentials: Optional[dict] = None) -> dict:
        """Establish a connection. Returns token/profile payload for connected_accounts."""
        raise NotImplementedError(f"{self.vendor_id} connect is not implemented yet.")

    async def disconnect(self, *, access_token: Optional[str] = None) -> None:
        """Best-effort revoke / cleanup."""
        return None

    @abstractmethod
    async def list_calls(
        self,
        *,
        access_token: Optional[str] = None,
        max_results: int = 100,
    ) -> List[RemoteCall]:
        """Fetch recent calls (metadata only)."""

    async def count_calls(self, *, access_token: Optional[str] = None) -> int:
        calls = await self.list_calls(access_token=access_token, max_results=1000)
        return len(calls)

    async def fetch_call(
        self,
        *,
        provider_call_id: str,
        access_token: Optional[str] = None,
    ) -> Optional[RemoteCall]:
        calls = await self.list_calls(access_token=access_token, max_results=200)
        for call in calls:
            if call.providerCallId == provider_call_id:
                return call
        return None
