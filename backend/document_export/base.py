"""DocumentExporter interface — all export backends implement this contract."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Set

from document_export.models import ExportContext, ExportFormat, ExportResult


class DocumentExporter(ABC):
    """Single interface for PDF, Factur-X, and future PDP routing."""

    format: ExportFormat

    @abstractmethod
    async def export(self, context: ExportContext) -> ExportResult:
        """Produce export bytes (or PDP dispatch metadata) for a commercial document."""

    @abstractmethod
    def supported_document_types(self) -> Set[str]:
        """Document kinds this exporter handles (`quote`, `invoice`)."""

    def supports(self, document_type: str) -> bool:
        return document_type in self.supported_document_types()
