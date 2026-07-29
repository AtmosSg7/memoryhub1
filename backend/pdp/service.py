"""PDP orchestration service — single entry point for the rest of the SaaS."""

from __future__ import annotations

from typing import Optional

from document_export.models import ExportContext
from pdp.config import get_pdp_environment
from pdp.exceptions import PdpProviderNotConfiguredError, PdpTransmissionError
from pdp.models import (
    PdpCancelResult,
    PdpInvoicePayload,
    PdpInvoiceStatus,
    PdpSendResult,
    PdpStatusSyncResult,
)
from pdp.registry import resolve_pdp_provider

_service: Optional["PdpService"] = None


class PdpService:
    """Facade over registered PdpProvider implementations.

    Commercial modules, exporters, schedulers and future API routes should call
    this service instead of importing a concrete provider adapter.
    """

    async def send_invoice(
        self,
        payload: PdpInvoicePayload,
        *,
        provider_key: Optional[str] = None,
    ) -> PdpSendResult:
        provider = resolve_pdp_provider(provider_key)
        enriched = payload.model_copy(
            update={
                "metadata": {
                    **payload.metadata,
                    "providerKey": provider.provider_key,
                    "environment": get_pdp_environment(),
                }
            }
        )
        try:
            result = await provider.send_invoice(enriched)
            return result.model_copy(
                update={
                    "providerKey": result.providerKey or provider.provider_key,
                    "environment": result.environment or get_pdp_environment(),
                }
            )
        except PdpTransmissionError:
            raise
        except Exception as exc:
            raise PdpTransmissionError(
                "PDP invoice transmission failed.",
                code="transmission_failed",
                retryable=True,
            ) from exc

    async def send_invoice_from_context(
        self,
        context: ExportContext,
        *,
        provider_key: Optional[str] = None,
    ) -> PdpSendResult:
        payload = PdpInvoicePayload.from_export_context(context)
        key = provider_key or context.pdpProviderKey
        return await self.send_invoice(payload, provider_key=key)

    async def sync_invoice(
        self,
        external_id: str,
        *,
        provider_key: Optional[str] = None,
    ) -> PdpInvoiceStatus:
        """Fetch the latest PDP status for a previously submitted invoice."""
        provider = resolve_pdp_provider(provider_key)
        try:
            return await provider.get_status(external_id)
        except PdpTransmissionError:
            raise
        except Exception as exc:
            raise PdpTransmissionError(
                "PDP status synchronization failed.",
                code="status_sync_failed",
                retryable=True,
            ) from exc

    async def cancel_invoice(
        self,
        external_id: str,
        *,
        provider_key: Optional[str] = None,
    ) -> PdpCancelResult:
        provider = resolve_pdp_provider(provider_key)
        if not provider.capabilities.supports_cancellation:
            raise PdpTransmissionError(
                "This PDP provider does not support cancellation.",
                code="cancellation_not_supported",
                retryable=False,
            )
        try:
            return await provider.cancel_invoice(external_id)
        except PdpTransmissionError:
            raise
        except Exception as exc:
            raise PdpTransmissionError(
                "PDP cancellation request failed.",
                code="cancellation_failed",
                retryable=True,
            ) from exc

    async def sync_statuses(
        self,
        *,
        since: Optional[str] = None,
        provider_key: Optional[str] = None,
    ) -> PdpStatusSyncResult:
        """Bulk status pull — complement to provider webhooks when available."""
        provider = resolve_pdp_provider(provider_key)
        if not provider.capabilities.supports_status_sync:
            raise PdpTransmissionError(
                "This PDP provider does not support bulk status synchronization.",
                code="bulk_sync_not_supported",
                retryable=False,
            )
        try:
            return await provider.sync_statuses(since)
        except PdpTransmissionError:
            raise
        except Exception as exc:
            raise PdpTransmissionError(
                "PDP bulk status synchronization failed.",
                code="bulk_sync_failed",
                retryable=True,
            ) from exc


def get_pdp_service() -> PdpService:
    global _service
    if _service is None:
        _service = PdpService()
    return _service


def reset_pdp_service_for_tests() -> None:
    global _service
    _service = None
