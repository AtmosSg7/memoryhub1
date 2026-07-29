"""Exporter registry — single lookup for DocumentExportService."""

from __future__ import annotations

from typing import Dict, Optional

from document_export.base import DocumentExporter
from document_export.exceptions import CommercialExportFormatError
from document_export.facturx_exporter import FacturXExporter
from document_export.models import ExportFormat
from document_export.pdf_exporter import PdfExporter
from document_export.pdp_exporter import FuturePdpExporter

_EXPORTERS: Dict[ExportFormat, DocumentExporter] = {
    ExportFormat.PDF: PdfExporter(),
    ExportFormat.FACTURX: FacturXExporter(),
    ExportFormat.PDP: FuturePdpExporter(),
}


def get_exporter(fmt: ExportFormat | str) -> DocumentExporter:
    if isinstance(fmt, str):
        try:
            fmt = ExportFormat(fmt.lower())
        except ValueError as exc:
            raise CommercialExportFormatError(f"Unknown export format: {fmt}") from exc
    exporter = _EXPORTERS.get(fmt)
    if exporter is None:
        raise CommercialExportFormatError(f"No exporter registered for format: {fmt}")
    return exporter


def list_export_formats() -> list[str]:
    return [fmt.value for fmt in _EXPORTERS]
