"""Factur-X exporter stub — structure documented for future EN16931 / CII implementation.

Implementation checklist (future):
1. Build EN16931-compliant CII XML from ExportContext (seller, buyer, lines, VAT breakdown).
2. Generate PDF/A-3 with embedded XML (`application/xml` attachment).
3. Validate against French CIUS / Factur-X profile before returning bytes.
4. Store export metadata on invoice (`facturxProfile`, `xmlChecksum`).

This class is intentionally not implemented — only the contract and entry point exist.
"""

from __future__ import annotations

from typing import Set

from document_export.base import DocumentExporter
from document_export.exceptions import CommercialExportNotReadyError
from document_export.models import ExportContext, ExportFormat, ExportResult


class FacturXExporter(DocumentExporter):
    format = ExportFormat.FACTURX

    def supported_document_types(self) -> Set[str]:
        return {"invoice"}

    async def export(self, context: ExportContext) -> ExportResult:
        raise CommercialExportNotReadyError(
            "Factur-X export is not implemented yet. "
            "Implement CII XML generation and PDF/A-3 embedding in FacturXExporter.export(). "
            f"Invoice {context.document.get('number')} is ready for wiring."
        )

    @staticmethod
    def planned_output_shape() -> dict:
        """Document the expected future ExportResult for tests and integrators."""
        return {
            "format": ExportFormat.FACTURX.value,
            "contentType": "application/pdf",
            "filenameSuffix": "-factur-x.pdf",
            "metadataKeys": ["facturxProfile", "xmlAttachmentName", "en16931Profile"],
        }
