"""Import engine tests — preprocessing, limits, classification, multi-file."""

from __future__ import annotations

import io
import os
import uuid

import pytest
from fastapi import HTTPException
from PIL import Image
from pypdf import PdfWriter

os.environ.setdefault("IMPORT_MAX_IMAGES", "3")
os.environ.setdefault("IMPORT_MAX_PDF_PAGES", "5")
os.environ.setdefault("IMPORT_MAX_FILE_SIZE_BYTES", "500000")
os.environ.setdefault("IMPORT_MAX_TOTAL_SIZE_BYTES", "1000000")

from import_classification import (  # noqa: E402
    get_document_type,
    is_confirmable_kind,
    normalize_detected_kind,
)
from import_constants import (  # noqa: E402
    LIMIT_MESSAGE_TOO_LARGE,
    LIMIT_MESSAGE_TOO_MANY_IMAGES,
)
from import_limits import ImportUploadInput, validate_prepared_limits, validate_upload_inputs  # noqa: E402
from import_preprocessor import RawUpload, prepare_import_document  # noqa: E402


def _jpeg_bytes(width: int = 200, height: int = 300, color: str = "#336699") -> bytes:
    image = Image.new("RGB", (width, height), color=color)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


def _png_bytes() -> bytes:
    image = Image.new("RGBA", (120, 120), color=(255, 0, 0, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _pdf_bytes(page_count: int = 2) -> bytes:
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=200, height=200)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def test_normalize_detected_kind_aliases():
    assert normalize_detected_kind("devis") == "quote"
    assert normalize_detected_kind("facture fournisseur") == "supplier_invoice"
    assert normalize_detected_kind("document administratif") == "administrative_document"
    assert normalize_detected_kind("ticket") == "receipt"


def test_document_type_registry_confirmable():
    assert is_confirmable_kind("quote") is True
    assert is_confirmable_kind("invoice") is True
    assert is_confirmable_kind("delivery_note") is False
    assert get_document_type("administrative_document").label_fr == "Document administratif"


def test_validate_upload_rejects_too_many_images():
    uploads = [
        ImportUploadInput(filename=f"photo-{index}.jpg", extension="jpg", size_bytes=1000)
        for index in range(4)
    ]
    with pytest.raises(HTTPException) as exc:
        validate_upload_inputs(uploads)
    assert exc.value.status_code == 413
    assert exc.value.detail["message"] == LIMIT_MESSAGE_TOO_MANY_IMAGES


def test_validate_upload_rejects_oversized_file():
    uploads = [ImportUploadInput(filename="big.pdf", extension="pdf", size_bytes=600_000)]
    with pytest.raises(HTTPException) as exc:
        validate_upload_inputs(uploads)
    assert exc.value.status_code == 413
    assert exc.value.detail["message"] == LIMIT_MESSAGE_TOO_LARGE


def test_prepare_single_image_compresses_and_orients():
    prepared = prepare_import_document(
        [RawUpload(filename="scan.jpg", content=_jpeg_bytes(), content_type="image/jpeg")]
    )
    assert prepared.page_count == 1
    assert prepared.source_type == "image"
    assert prepared.extension in {"jpg", "pdf"}
    assert len(prepared.content) > 0


def test_prepare_multi_images_merges_into_single_document():
    uploads = [
        RawUpload(filename="page-1.jpg", content=_jpeg_bytes(color="red")),
        RawUpload(filename="page-2.jpg", content=_jpeg_bytes(color="blue")),
    ]
    prepared = prepare_import_document(uploads)
    assert prepared.page_count == 2
    assert prepared.source_type == "multi_image"
    assert prepared.image_count == 2
    assert "fusion" in prepared.preprocessing_warnings[0].lower() or "photo" in prepared.preprocessing_warnings[0].lower()


def test_prepare_pdf_multi_pages():
    prepared = prepare_import_document(
        [RawUpload(filename="doc.pdf", content=_pdf_bytes(page_count=3), content_type="application/pdf")]
    )
    assert prepared.page_count >= 1
    assert prepared.source_type == "pdf"
    assert prepared.extension == "pdf"


def test_validate_prepared_limits_pages():
    with pytest.raises(HTTPException) as exc:
        validate_prepared_limits(page_count=6, image_count=0, total_size_bytes=1000)
    assert exc.value.status_code == 413


def test_prepare_png_and_webp_supported():
    prepared_png = prepare_import_document(
        [RawUpload(filename="scan.png", content=_png_bytes(), content_type="image/png")]
    )
    assert prepared_png.page_count == 1

    webp_image = Image.new("RGB", (80, 80), color="green")
    webp_buffer = io.BytesIO()
    webp_image.save(webp_buffer, format="WEBP")
    prepared_webp = prepare_import_document(
        [RawUpload(filename="scan.webp", content=webp_buffer.getvalue(), content_type="image/webp")]
    )
    assert prepared_webp.page_count == 1


def test_mixed_pdf_and_images_rejected():
    uploads = [
        RawUpload(filename="doc.pdf", content=_pdf_bytes(1)),
        RawUpload(filename="photo.jpg", content=_jpeg_bytes()),
    ]
    with pytest.raises(HTTPException) as exc:
        prepare_import_document(uploads)
    assert exc.value.status_code == 400
