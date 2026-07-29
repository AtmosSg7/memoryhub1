"""Commercial export exceptions."""

from __future__ import annotations


class CommercialExportError(Exception):
    """Base export error."""


class CommercialExportNotReadyError(CommercialExportError):
    """Exporter exists but is not implemented yet (Factur-X, etc.)."""


class CommercialExportFormatError(CommercialExportError):
    """Unknown or unsupported export format."""


class CommercialExportWorkflowError(CommercialExportError):
    """Invoice is not in the correct export workflow state."""
