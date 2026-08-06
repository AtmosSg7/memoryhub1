"""Shared stub helpers for real telephony vendors (not wired yet)."""

from __future__ import annotations

from typing import List, Optional

from phone.models import RemoteCall
from phone.provider import PhoneProvider


class UnconfiguredVendorProvider(PhoneProvider):
    """Interface placeholder — connect/list raise until credentials + API are wired."""

    vendor_id = "vendor"
    display_name = "Vendor"

    def is_configured(self) -> bool:
        return False

    def is_ready(self) -> bool:
        return False

    async def connect(self, *, user_id: str, credentials: Optional[dict] = None) -> dict:
        raise NotImplementedError(
            f"{self.display_name} is reserved. Configure credentials then enable the connector."
        )

    async def list_calls(
        self,
        *,
        access_token: Optional[str] = None,
        max_results: int = 100,
    ) -> List[RemoteCall]:
        raise NotImplementedError(
            f"{self.display_name} call sync is not implemented yet."
        )
