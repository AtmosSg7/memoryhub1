"""PdpProvider interface — implement for any external PDP platform."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from pdp.constants import PdpEnvironment
from pdp.models import (
    PdpCancelResult,
    PdpCapabilities,
    PdpInvoicePayload,
    PdpInvoiceStatus,
    PdpSendResult,
    PdpStatusSyncResult,
)


class PdpProvider(ABC):
    """Contract for connecting a real PDP later without refactoring exporters."""

    provider_key: str

    @property
    def environment(self) -> PdpEnvironment:
        """Active runtime environment (sandbox or production)."""
        from pdp.config import get_pdp_environment

        return get_pdp_environment()

    @property
    def capabilities(self) -> PdpCapabilities:
        """Provider feature flags — override when a platform lacks a capability."""
        return PdpCapabilities()

    @abstractmethod
    async def send_invoice(self, payload: PdpInvoicePayload) -> PdpSendResult:
        """Submit an invoice to the PDP platform."""

    @abstractmethod
    async def get_status(self, external_id: str) -> PdpInvoiceStatus:
        """Fetch current PDP status for a previously submitted invoice."""

    @abstractmethod
    async def cancel_invoice(self, external_id: str) -> PdpCancelResult:
        """Request cancellation on the PDP when still allowed."""

    @abstractmethod
    async def sync_statuses(self, since: Optional[str] = None) -> PdpStatusSyncResult:
        """Bulk sync status updates from the PDP (webhook complement)."""
