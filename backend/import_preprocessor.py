"""Import document preprocessing — orientation, compression, blank pages, multi-image merge."""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

from fastapi import HTTPException
from PIL import Image, ImageOps

from import_constants import (
    IMAGE_EXTENSIONS,
    IMPORT_BLANK_PAGE_THRESHOLD,
    IMPORT_IMAGE_JPEG_QUALITY,
    IMPORT_IMAGE_MAX_DIMENSION,
    LIMIT_MESSAGE_EMPTY,
    PDF_EXTENSION,
)

try:
    from pypdf import PdfReader, PdfWriter
except ImportError:  # pragma: no cover
    PdfReader = None  # type: ignore
    PdfWriter = None  # type: ignore


@dataclass(frozen=True)
class ImportPage:
    index: int
    content: bytes
    mime_type: str
    extension: str


@dataclass
class PreparedImport:
    filename: str
    mime_type: str
    extension: str
    content: bytes
    pages: List[ImportPage]
    source_type: str
    page_count: int
    image_count: int
    total_size_bytes: int
    preprocessing_warnings: List[str] = field(default_factory=list)
    skipped_blank_pages: List[int] = field(default_factory=list)


@dataclass(frozen=True)
class RawUpload:
    filename: str
    content: bytes
    content_type: Optional[str] = None


def _normalize_extension(extension: str) -> str:
    return (extension or "").strip().lower().lstrip(".")


def _extension_from_filename(filename: str) -> str:
    return _normalize_extension(Path(filename).suffix.lstrip("."))


def _resize_if_needed(image: Image.Image) -> Image.Image:
    width, height = image.size
    max_dim = max(width, height)
    if max_dim <= IMPORT_IMAGE_MAX_DIMENSION:
        return image
    scale = IMPORT_IMAGE_MAX_DIMENSION / max_dim
    new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
    return image.resize(new_size, Image.Resampling.LANCZOS)


def _is_blank_image(image: Image.Image, threshold: float = IMPORT_BLANK_PAGE_THRESHOLD) -> bool:
    gray = image.convert("L")
    pixels = list(gray.getdata())
    if not pixels:
        return True
    white = sum(1 for value in pixels if value >= 250)
    return (white / len(pixels)) >= threshold


def _image_to_jpeg_bytes(image: Image.Image) -> bytes:
    rgb = image.convert("RGB")
    buffer = io.BytesIO()
    rgb.save(
        buffer,
        format="JPEG",
        quality=IMPORT_IMAGE_JPEG_QUALITY,
        optimize=True,
    )
    return buffer.getvalue()


def _process_image(content: bytes) -> Tuple[Optional[bytes], bool]:
    image = Image.open(io.BytesIO(content))
    image = ImageOps.exif_transpose(image)
    image = _resize_if_needed(image)
    if _is_blank_image(image):
        return None, True
    return _image_to_jpeg_bytes(image), False


def _is_blank_pdf_page(page) -> bool:
    try:
        text = (page.extract_text() or "").strip()
        if text:
            return False
    except Exception:
        pass

    try:
        content = page.get_contents()
        if content is None:
            return True
        data = content.get_data() if hasattr(content, "get_data") else content
        if isinstance(data, bytes):
            return len(data) < 48
    except Exception:
        return False
    return False


def _extract_pdf_pages(content: bytes) -> List[bytes]:
    if PdfReader is None:
        return [content]

    try:
        reader = PdfReader(io.BytesIO(content))
        pages: List[bytes] = []
        for page in reader.pages:
            writer = PdfWriter()
            writer.add_page(page)
            buffer = io.BytesIO()
            writer.write(buffer)
            pages.append(buffer.getvalue())
        return pages or [content]
    except Exception:
        return [content]


def _merge_pages_to_pdf(pages: List[ImportPage]) -> bytes:
    if PdfWriter is None or not pages:
        return pages[0].content if pages else b""

    try:
        writer = PdfWriter()
        for page in pages:
            if page.extension == PDF_EXTENSION:
                reader = PdfReader(io.BytesIO(page.content))
                for pdf_page in reader.pages:
                    writer.add_page(pdf_page)
            else:
                image = Image.open(io.BytesIO(page.content))
                image = image.convert("RGB")
                pdf_buffer = io.BytesIO()
                image.save(pdf_buffer, format="PDF")
                reader = PdfReader(io.BytesIO(pdf_buffer.getvalue()))
                for pdf_page in reader.pages:
                    writer.add_page(pdf_page)

        output = io.BytesIO()
        writer.write(output)
        return output.getvalue()
    except Exception:
        return pages[0].content


def _prepare_single_pdf(upload: RawUpload) -> PreparedImport:
    warnings: List[str] = []
    skipped: List[int] = []
    pages: List[ImportPage] = []

    raw_pages = _extract_pdf_pages(upload.content)
    for index, page_bytes in enumerate(raw_pages, start=1):
        if PdfReader is not None and len(raw_pages) > 1:
            try:
                page_obj = PdfReader(io.BytesIO(page_bytes)).pages[0]
                if _is_blank_pdf_page(page_obj):
                    skipped.append(index)
                    continue
            except Exception:
                pass

        pages.append(
            ImportPage(
                index=len(pages) + 1,
                content=page_bytes,
                mime_type="application/pdf",
                extension=PDF_EXTENSION,
            )
        )

    if not pages and raw_pages:
        pages.append(
            ImportPage(
                index=1,
                content=raw_pages[0],
                mime_type="application/pdf",
                extension=PDF_EXTENSION,
            )
        )
        warnings.append("Document très clair — la lisibilité sera vérifiée à l'analyse.")

    if not pages:
        raise HTTPException(status_code=400, detail={"message": LIMIT_MESSAGE_EMPTY})

    if skipped:
        warnings.append(
            f"{len(skipped)} page(s) blanche(s) ignorée(s) avant analyse."
        )

    merged = _merge_pages_to_pdf(pages) if len(pages) > 1 else pages[0].content
    safe_name = Path(upload.filename).stem + ".pdf"

    return PreparedImport(
        filename=safe_name,
        mime_type="application/pdf",
        extension=PDF_EXTENSION,
        content=merged,
        pages=pages,
        source_type="pdf",
        page_count=len(pages),
        image_count=0,
        total_size_bytes=len(merged),
        preprocessing_warnings=warnings,
        skipped_blank_pages=skipped,
    )


def _prepare_images(uploads: List[RawUpload]) -> PreparedImport:
    warnings: List[str] = []
    skipped: List[int] = []
    pages: List[ImportPage] = []

    for upload_index, upload in enumerate(uploads, start=1):
        processed, was_blank = _process_image(upload.content)
        if was_blank or processed is None:
            skipped.append(upload_index)
            continue
        pages.append(
            ImportPage(
                index=len(pages) + 1,
                content=processed,
                mime_type="image/jpeg",
                extension="jpg",
            )
        )

    if not pages and uploads:
        image = Image.open(io.BytesIO(uploads[0].content))
        image = ImageOps.exif_transpose(image)
        image = _resize_if_needed(image)
        processed = _image_to_jpeg_bytes(image)
        pages.append(
            ImportPage(
                index=1,
                content=processed,
                mime_type="image/jpeg",
                extension="jpg",
            )
        )
        warnings.append("Photo très claire — la lisibilité sera vérifiée à l'analyse.")

    if not pages:
        raise HTTPException(status_code=400, detail={"message": LIMIT_MESSAGE_EMPTY})

    if len(uploads) > 1:
        warnings.append(
            f"{len(pages)} photo(s) fusionnée(s) en un seul document."
        )
    if skipped:
        warnings.append(
            f"{len(skipped)} image(s) vide(s) ignorée(s) avant analyse."
        )

    merged_pdf = _merge_pages_to_pdf(pages)
    filename = (
        Path(uploads[0].filename).stem + "-fusion.pdf"
        if len(uploads) > 1
        else Path(uploads[0].filename).stem + ".jpg"
    )
    mime_type = "application/pdf" if len(pages) > 1 else "image/jpeg"
    extension = PDF_EXTENSION if len(pages) > 1 else "jpg"
    content = merged_pdf if len(pages) > 1 else pages[0].content

    return PreparedImport(
        filename=filename,
        mime_type=mime_type,
        extension=extension,
        content=content,
        pages=pages,
        source_type="multi_image" if len(uploads) > 1 else "image",
        page_count=len(pages),
        image_count=len(uploads),
        total_size_bytes=sum(len(page.content) for page in pages),
        preprocessing_warnings=warnings,
        skipped_blank_pages=skipped,
    )


def _prepare_single_image(upload: RawUpload) -> PreparedImport:
    return _prepare_images([upload])


def prepare_import_document(uploads: List[RawUpload]) -> PreparedImport:
    if not uploads:
        raise HTTPException(status_code=400, detail={"message": LIMIT_MESSAGE_EMPTY})

    extensions = {
        _extension_from_filename(upload.filename) for upload in uploads if upload.filename
    }
    extensions.discard("")

    if extensions & IMAGE_EXTENSIONS and PDF_EXTENSION in extensions:
        raise HTTPException(
            status_code=400,
            detail={
                "message": (
                    "Mélangez pas PDF et photos dans un même import. "
                    "Envoyez un PDF ou plusieurs photos."
                )
            },
        )

    if len(uploads) == 1:
        ext = next(iter(extensions), "")
        if ext == PDF_EXTENSION:
            return _prepare_single_pdf(uploads[0])
        if ext in IMAGE_EXTENSIONS:
            return _prepare_single_image(uploads[0])

    if extensions <= IMAGE_EXTENSIONS:
        return _prepare_images(uploads)

    raise HTTPException(
        status_code=400,
        detail={"message": "Ce format n'est pas pris en charge. Utilisez PDF, JPG, PNG ou WEBP."},
    )
