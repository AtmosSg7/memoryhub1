"""Import anti-abuse validation with premium user-facing messages."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List

from fastapi import HTTPException

from import_constants import (
    IMAGE_EXTENSIONS,
    IMPORT_MAX_FILE_SIZE_BYTES as DEFAULT_MAX_FILE_SIZE,
    IMPORT_MAX_IMAGES as DEFAULT_MAX_IMAGES,
    IMPORT_MAX_PDF_PAGES as DEFAULT_MAX_PDF_PAGES,
    IMPORT_MAX_TOTAL_SIZE_BYTES as DEFAULT_MAX_TOTAL_SIZE,
    LIMIT_MESSAGE_EMPTY,
    LIMIT_MESSAGE_MIXED_TYPES,
    LIMIT_MESSAGE_TOO_LARGE,
    LIMIT_MESSAGE_TOO_MANY_IMAGES,
    LIMIT_MESSAGE_TOO_MANY_PAGES,
    LIMIT_MESSAGE_TOTAL_TOO_LARGE,
    PDF_EXTENSION,
)
from import_models import IMPORT_FILE_EXTENSIONS


@dataclass(frozen=True)
class ImportUploadInput:
    filename: str
    extension: str
    size_bytes: int


def _live_limit(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return max(0, int(raw))
    except ValueError:
        return default


def _normalize_extension(extension: str) -> str:
    return (extension or "").strip().lower().lstrip(".")


def _extension_from_filename(filename: str) -> str:
    parts = filename.rsplit(".", 1)
    if len(parts) < 2:
        return ""
    return _normalize_extension(parts[1])


def _limit_exceeded(message: str, *, code: str) -> HTTPException:
    return HTTPException(
        status_code=413,
        detail={"message": message, "code": code},
    )


def validate_upload_inputs(uploads: List[ImportUploadInput]) -> None:
    if not uploads:
        raise HTTPException(status_code=400, detail={"message": LIMIT_MESSAGE_EMPTY})

    max_file_size = _live_limit("IMPORT_MAX_FILE_SIZE_BYTES", DEFAULT_MAX_FILE_SIZE)
    max_images = _live_limit("IMPORT_MAX_IMAGES", DEFAULT_MAX_IMAGES)
    max_total_size = _live_limit("IMPORT_MAX_TOTAL_SIZE_BYTES", DEFAULT_MAX_TOTAL_SIZE)

    total_size = 0
    image_count = 0
    pdf_count = 0

    for upload in uploads:
        ext = _normalize_extension(upload.extension) or _extension_from_filename(upload.filename)
        if ext not in IMPORT_FILE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": (
                        "Ce format n'est pas pris en charge. "
                        "Utilisez PDF, JPG, PNG ou WEBP."
                    )
                },
            )

        if upload.size_bytes <= 0:
            raise HTTPException(status_code=400, detail={"message": LIMIT_MESSAGE_EMPTY})

        if max_file_size and upload.size_bytes > max_file_size:
            raise _limit_exceeded(LIMIT_MESSAGE_TOO_LARGE, code="import_file_too_large")

        total_size += upload.size_bytes

        if ext in IMAGE_EXTENSIONS:
            image_count += 1
        elif ext == PDF_EXTENSION:
            pdf_count += 1

    if pdf_count and image_count:
        raise HTTPException(status_code=400, detail={"message": LIMIT_MESSAGE_MIXED_TYPES})

    if max_images and image_count > max_images:
        raise _limit_exceeded(LIMIT_MESSAGE_TOO_MANY_IMAGES, code="import_too_many_images")

    if max_total_size and total_size > max_total_size:
        raise _limit_exceeded(LIMIT_MESSAGE_TOTAL_TOO_LARGE, code="import_total_too_large")


def validate_prepared_limits(
    *,
    page_count: int,
    image_count: int,
    total_size_bytes: int,
) -> None:
    max_pdf_pages = _live_limit("IMPORT_MAX_PDF_PAGES", DEFAULT_MAX_PDF_PAGES)
    max_images = _live_limit("IMPORT_MAX_IMAGES", DEFAULT_MAX_IMAGES)
    max_total_size = _live_limit("IMPORT_MAX_TOTAL_SIZE_BYTES", DEFAULT_MAX_TOTAL_SIZE)

    if max_pdf_pages and page_count > max_pdf_pages:
        raise _limit_exceeded(LIMIT_MESSAGE_TOO_MANY_PAGES, code="import_too_many_pages")

    if max_images and image_count > max_images:
        raise _limit_exceeded(LIMIT_MESSAGE_TOO_MANY_IMAGES, code="import_too_many_images")

    if max_total_size and total_size_bytes > max_total_size:
        raise _limit_exceeded(LIMIT_MESSAGE_TOTAL_TOO_LARGE, code="import_total_too_large")
