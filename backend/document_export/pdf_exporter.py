"""PDF exporter — wraps existing ReportLab builder without duplicating layout code."""

from __future__ import annotations

from typing import Set

from document_export.base import DocumentExporter
from document_export.models import ExportContext, ExportFormat, ExportResult
from pdf_documents import build_invoice_pdf, build_quote_pdf
from pdf_logo_loader import load_pdf_logo_bytes, resolve_pdf_logo_storage_key


def _payload(context: ExportContext) -> dict:
    data = dict(context.document)
    if context.stripInternalNotes:
        data = {**data, "internalNotes": None}
    return data


class PdfExporter(DocumentExporter):
    format = ExportFormat.PDF

    def supported_document_types(self) -> Set[str]:
        return {"quote", "invoice"}

    async def export(self, context: ExportContext) -> ExportResult:
        lang = context.lang if context.lang in ("fr", "en") else "fr"
        payload = _payload(context)
        number = context.document.get("number") or context.documentId
        logo_bytes = await load_pdf_logo_bytes(resolve_pdf_logo_storage_key(context.seller))

        if context.documentType == "quote":
            data = build_quote_pdf(payload, lang=lang, seller=context.seller, logo_bytes=logo_bytes)
            filename = f"{number}.pdf"
        elif context.documentType == "invoice":
            data = build_invoice_pdf(payload, lang=lang, seller=context.seller, logo_bytes=logo_bytes)
            filename = f"{number}.pdf"
        else:
            raise ValueError(f"Unsupported document type: {context.documentType}")

        return ExportResult(
            format=ExportFormat.PDF,
            contentType="application/pdf",
            filename=filename,
            data=data,
            metadata={"engine": "reportlab", "lang": lang},
        )
