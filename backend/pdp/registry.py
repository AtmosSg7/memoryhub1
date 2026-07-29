"""PDP provider registry — empty by default until a real adapter is registered."""

from __future__ import annotations

from typing import Dict, List, Optional

from pdp.exceptions import PdpProviderNotConfiguredError
from pdp.provider import PdpProvider

_PROVIDERS: Dict[str, PdpProvider] = {}


def register_pdp_provider(provider: PdpProvider) -> None:
    _PROVIDERS[provider.provider_key] = provider


def get_pdp_provider(provider_key: str) -> Optional[PdpProvider]:
    return _PROVIDERS.get(provider_key)


def list_pdp_providers() -> List[str]:
    return sorted(_PROVIDERS.keys())


def resolve_pdp_provider(provider_key: Optional[str] = None) -> PdpProvider:
    """Resolve an explicit or configured default provider key."""
    from pdp.config import get_default_pdp_provider_key

    key = (provider_key or get_default_pdp_provider_key()).strip()
    provider = get_pdp_provider(key)
    if provider is None:
        raise PdpProviderNotConfiguredError(
            f"No PDP provider registered for key '{key}'. "
            "Register a PdpProvider implementation before dispatching invoices."
        )
    return provider


def reset_pdp_registry_for_tests() -> None:
    _PROVIDERS.clear()
