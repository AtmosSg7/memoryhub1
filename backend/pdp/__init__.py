"""PDP (Plateforme de Dématérialisation Partenaire) abstractions — no real provider."""

from pdp.config import get_default_pdp_provider_key, get_pdp_environment, is_pdp_provider_registered
from pdp.constants import (
    DEFAULT_PDP_PROVIDER_KEY,
    ENV_PDP_ENV,
    ENV_PDP_PROVIDER,
    PDP_ENV_PRODUCTION,
    PDP_ENV_SANDBOX,
)
from pdp.models import (
    PdpCancelResult,
    PdpCapabilities,
    PdpDispatchRecord,
    PdpInvoicePayload,
    PdpInvoiceStatus,
    PdpSendResult,
    PdpStatusSyncResult,
    PdpTransmissionErrorDetail,
)
from pdp.provider import PdpProvider
from pdp.registry import (
    get_pdp_provider,
    list_pdp_providers,
    register_pdp_provider,
    reset_pdp_registry_for_tests,
    resolve_pdp_provider,
)
from pdp.service import PdpService, get_pdp_service, reset_pdp_service_for_tests

__all__ = [
    "DEFAULT_PDP_PROVIDER_KEY",
    "ENV_PDP_ENV",
    "ENV_PDP_PROVIDER",
    "PDP_ENV_PRODUCTION",
    "PDP_ENV_SANDBOX",
    "PdpCapabilities",
    "PdpCancelResult",
    "PdpDispatchRecord",
    "PdpInvoicePayload",
    "PdpInvoiceStatus",
    "PdpProvider",
    "PdpSendResult",
    "PdpService",
    "PdpStatusSyncResult",
    "PdpTransmissionErrorDetail",
    "get_default_pdp_provider_key",
    "get_pdp_environment",
    "get_pdp_provider",
    "get_pdp_service",
    "is_pdp_provider_registered",
    "list_pdp_providers",
    "register_pdp_provider",
    "reset_pdp_registry_for_tests",
    "reset_pdp_service_for_tests",
    "resolve_pdp_provider",
]
