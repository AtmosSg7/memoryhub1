"""PDP abstraction tests — interfaces only, no real provider."""

from __future__ import annotations

import asyncio

import pytest

from document_export.models import ExportContext
from document_export.pdp_exporter import FuturePdpExporter
from pdp.config import get_default_pdp_provider_key, get_pdp_environment
from pdp.constants import DEFAULT_PDP_PROVIDER_KEY, PDP_ENV_PRODUCTION, PDP_ENV_SANDBOX
from pdp.exceptions import PdpProviderNotConfiguredError, PdpTransmissionError
from pdp.models import (
    PdpCancelResult,
    PdpCapabilities,
    PdpInvoicePayload,
    PdpInvoiceStatus,
    PdpSendResult,
    PdpStatusSyncResult,
)
from pdp.provider import PdpProvider
from pdp.registry import (
    get_pdp_provider,
    list_pdp_providers,
    register_pdp_provider,
    reset_pdp_registry_for_tests,
    resolve_pdp_provider,
)
from pdp.service import get_pdp_service, reset_pdp_service_for_tests


class _FakePdpProvider(PdpProvider):
    provider_key = "fake"

    async def send_invoice(self, payload: PdpInvoicePayload) -> PdpSendResult:
        return PdpSendResult(
            externalId="ext-123",
            status="submitted",
            providerKey=self.provider_key,
            environment=self.environment,
        )

    async def get_status(self, external_id: str) -> PdpInvoiceStatus:
        return PdpInvoiceStatus(externalId=external_id, status="accepted")

    async def cancel_invoice(self, external_id: str) -> PdpCancelResult:
        return PdpCancelResult(externalId=external_id, cancelled=True)

    async def sync_statuses(self, since=None) -> PdpStatusSyncResult:
        from datetime import datetime, timezone

        return PdpStatusSyncResult(
            items=[],
            syncedAt=datetime.now(timezone.utc).isoformat(),
            providerKey=self.provider_key,
            environment=self.environment,
        )


class _NoSyncPdpProvider(_FakePdpProvider):
    provider_key = "no-sync"

    @property
    def capabilities(self) -> PdpCapabilities:
        return PdpCapabilities(supports_status_sync=False)


@pytest.fixture(autouse=True)
def _reset_pdp_state():
    reset_pdp_registry_for_tests()
    reset_pdp_service_for_tests()
    yield
    reset_pdp_registry_for_tests()
    reset_pdp_service_for_tests()


def _sample_context(**overrides):
    base = {
        "userId": "u1",
        "documentType": "invoice",
        "documentId": "inv1",
        "document": {
            "id": "inv1",
            "number": "FAC-2026-0001",
            "clientId": "c1",
            "invoiceDate": "2026-07-14",
            "amountHT": 100,
            "vatRate": 20,
            "amountTTC": 120,
        },
        "pdpProviderKey": "fake",
    }
    base.update(overrides)
    return ExportContext(**base)


def test_no_provider_registered_by_default():
    assert list_pdp_providers() == []
    assert get_pdp_provider("default") is None


def test_pdp_exporter_requires_registered_provider():
    exporter = FuturePdpExporter()
    context = _sample_context()

    with pytest.raises(PdpProviderNotConfiguredError):
        asyncio.get_event_loop().run_until_complete(exporter.export(context))


def test_registered_provider_can_be_called():
    register_pdp_provider(_FakePdpProvider())
    assert "fake" in list_pdp_providers()

    payload = PdpInvoicePayload(
        invoiceId="inv1",
        invoiceNumber="FAC-2026-0001",
        userId="u1",
        clientId="c1",
        invoiceDate="2026-07-14",
        amountHT=100,
        vatRate=20,
        amountTTC=120,
    )
    result = asyncio.get_event_loop().run_until_complete(_FakePdpProvider().send_invoice(payload))
    assert result.externalId == "ext-123"


def test_pdp_service_send_invoice(monkeypatch):
    monkeypatch.setenv("PDP_ENV", PDP_ENV_SANDBOX)
    register_pdp_provider(_FakePdpProvider())

    payload = PdpInvoicePayload(
        invoiceId="inv1",
        invoiceNumber="FAC-2026-0001",
        userId="u1",
        clientId="c1",
        invoiceDate="2026-07-14",
        amountHT=100,
        vatRate=20,
        amountTTC=120,
    )
    result = asyncio.get_event_loop().run_until_complete(
        get_pdp_service().send_invoice(payload, provider_key="fake")
    )
    assert result.externalId == "ext-123"
    assert result.providerKey == "fake"
    assert result.environment == PDP_ENV_SANDBOX


def test_pdp_service_sync_invoice(monkeypatch):
    register_pdp_provider(_FakePdpProvider())
    status = asyncio.get_event_loop().run_until_complete(
        get_pdp_service().sync_invoice("ext-123", provider_key="fake")
    )
    assert status.externalId == "ext-123"
    assert status.status == "accepted"


def test_pdp_service_sync_statuses(monkeypatch):
    register_pdp_provider(_FakePdpProvider())
    result = asyncio.get_event_loop().run_until_complete(
        get_pdp_service().sync_statuses(provider_key="fake")
    )
    assert result.providerKey == "fake"
    assert result.items == []


def test_pdp_service_rejects_unsupported_bulk_sync():
    register_pdp_provider(_NoSyncPdpProvider())

    with pytest.raises(PdpTransmissionError) as exc:
        asyncio.get_event_loop().run_until_complete(
            get_pdp_service().sync_statuses(provider_key="no-sync")
        )
    assert exc.value.code == "bulk_sync_not_supported"


def test_pdp_exporter_uses_service_layer(monkeypatch):
    monkeypatch.setenv("PDP_ENV", PDP_ENV_PRODUCTION)
    register_pdp_provider(_FakePdpProvider())

    result = asyncio.get_event_loop().run_until_complete(
        FuturePdpExporter().export(_sample_context())
    )
    assert result.metadata["externalId"] == "ext-123"
    assert result.metadata["environment"] == PDP_ENV_PRODUCTION


def test_resolve_provider_uses_default_key(monkeypatch):
    monkeypatch.delenv("PDP_PROVIDER", raising=False)
    register_pdp_provider(_FakePdpProvider())

    with pytest.raises(PdpProviderNotConfiguredError):
        resolve_pdp_provider()

    class _DefaultProvider(_FakePdpProvider):
        provider_key = DEFAULT_PDP_PROVIDER_KEY

    register_pdp_provider(_DefaultProvider())
    provider = resolve_pdp_provider()
    assert provider.provider_key == DEFAULT_PDP_PROVIDER_KEY


def test_pdp_environment_config(monkeypatch):
    monkeypatch.setenv("PDP_ENV", PDP_ENV_PRODUCTION)
    assert get_pdp_environment() == PDP_ENV_PRODUCTION

    monkeypatch.setenv("PDP_ENV", "invalid")
    assert get_pdp_environment() == PDP_ENV_SANDBOX


def test_default_provider_key_config(monkeypatch):
    monkeypatch.setenv("PDP_PROVIDER", "custom-provider")
    assert get_default_pdp_provider_key() == "custom-provider"

    monkeypatch.delenv("PDP_PROVIDER", raising=False)
    assert get_default_pdp_provider_key() == DEFAULT_PDP_PROVIDER_KEY
