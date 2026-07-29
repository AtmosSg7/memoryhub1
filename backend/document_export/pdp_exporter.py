"""Future PDP exporter — routes invoices through PdpService (no real provider yet)."""

from __future__ import annotations

from typing import Set

from document_export.base import DocumentExporter
from document_export.models import ExportContext, ExportFormat, ExportResult
from pdp.config import get_pdp_environment
from pdp.service import get_pdp_service


class FuturePdpExporter(DocumentExporter):
    """Dispatches structured invoice data to a PDP adapter instead of returning a file."""

    format = ExportFormat.PDP

    def supported_document_types(self) -> Set[str]:
        return {"invoice"}

    async def export(self, context: ExportContext) -> ExportResult:
        send_result = await get_pdp_service().send_invoice_from_context(context)

        return ExportResult(
            format=ExportFormat.PDP,
            contentType="application/json",
            filename=f"{context.document.get('number', context.documentId)}.pdp.json",
            data=send_result.model_dump_json().encode("utf-8"),
            metadata={
                "providerKey": send_result.providerKey or context.pdpProviderKey,
                "externalId": send_result.externalId,
                "status": send_result.status,
                "environment": send_result.environment or get_pdp_environment(),
            },
        )
