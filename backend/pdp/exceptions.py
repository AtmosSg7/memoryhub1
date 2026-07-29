"""PDP integration exceptions."""

from __future__ import annotations

from typing import Any, Dict, Optional


class PdpError(Exception):
    """Base PDP error."""


class PdpProviderNotConfiguredError(PdpError):
    """No provider registered for the requested key."""


class PdpNotImplementedError(PdpError):
    """Provider slot exists but send/status methods are not wired."""


class PdpTransmissionError(PdpError):
    """Invoice could not be transmitted or synchronized with the PDP."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "pdp_transmission_error",
        retryable: bool = False,
        raw: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.raw = raw or {}


class PdpEnvironmentError(PdpError):
    """Requested operation is not allowed in the current PDP environment."""


class PdpProviderUnavailableError(PdpError):
    """Provider is registered but temporarily unavailable."""
