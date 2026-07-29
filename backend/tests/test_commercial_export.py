"""Document export architecture tests."""

import uuid

import pytest

from document_export.facturx_exporter import FacturXExporter
from document_export.models import ExportContext, ExportFormat
from document_export.registry import get_exporter, list_export_formats
from document_export.exceptions import CommercialExportNotReadyError, CommercialExportFormatError
from document_export.pdf_exporter import PdfExporter
from tests.conftest import create_client_record, create_quote_record, register_user


def test_registry_lists_all_formats():
    formats = list_export_formats()
    assert ExportFormat.PDF.value in formats
    assert ExportFormat.FACTURX.value in formats
    assert ExportFormat.PDP.value in formats


def test_pdf_exporter_supports_quotes_and_invoices():
    exporter = get_exporter(ExportFormat.PDF)
    assert isinstance(exporter, PdfExporter)
    assert exporter.supports("quote")
    assert exporter.supports("invoice")


def test_facturx_exporter_is_stub():
    exporter = get_exporter(ExportFormat.FACTURX)
    context = ExportContext(
        userId="u1",
        documentType="invoice",
        documentId="inv1",
        document={"id": "inv1", "number": "FAC-2026-0001", "clientId": "c1"},
    )
    with pytest.raises(CommercialExportNotReadyError):
        import asyncio

        asyncio.get_event_loop().run_until_complete(exporter.export(context))


def test_unknown_format_raises():
    with pytest.raises(CommercialExportFormatError):
        get_exporter("xml")


def test_facturx_planned_output_documented():
    shape = FacturXExporter.planned_output_shape()
    assert shape["format"] == "facturx"
    assert "metadataKeys" in shape


def test_pdf_export_api_still_works(client):
    register_user(client, suffix=uuid.uuid4().hex)
    owned_client = create_client_record(client)
    quote = create_quote_record(client, owned_client["id"])
    res = client.get(f"/api/quotes/{quote['id']}/pdf")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/pdf")
    assert res.content[:4] == b"%PDF"
