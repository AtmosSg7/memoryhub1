"""Centralized import engine configuration — no hard-coded product limits in routes."""

from __future__ import annotations

import os

IMAGE_EXTENSIONS = frozenset({"jpg", "jpeg", "png", "webp"})
PDF_EXTENSION = "pdf"


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return max(0, int(raw))
    except ValueError:
        return default


def _float_env(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


# Anti-abuse limits (0 = not enforced).
IMPORT_MAX_IMAGES = _int_env("IMPORT_MAX_IMAGES", 10)
IMPORT_MAX_PDF_PAGES = _int_env("IMPORT_MAX_PDF_PAGES", 20)
IMPORT_MAX_FILE_SIZE_BYTES = _int_env("IMPORT_MAX_FILE_SIZE_BYTES", 10_485_760)
IMPORT_MAX_TOTAL_SIZE_BYTES = _int_env(
    "IMPORT_MAX_TOTAL_SIZE_BYTES",
    _int_env("MAX_UPLOAD_BYTES", 26_214_400),
)

# Preprocessing tuning.
IMPORT_IMAGE_MAX_DIMENSION = _int_env("IMPORT_IMAGE_MAX_DIMENSION", 2400)
IMPORT_IMAGE_JPEG_QUALITY = min(95, max(50, _int_env("IMPORT_IMAGE_JPEG_QUALITY", 85)))
IMPORT_BLANK_PAGE_THRESHOLD = _float_env("IMPORT_BLANK_PAGE_THRESHOLD", 0.98)
IMPORT_BATCH_PAGE_LIMIT = _int_env("IMPORT_BATCH_PAGE_LIMIT", 5)

# Premium user-facing messages (never technical).
LIMIT_MESSAGE_TOO_LARGE = (
    "Votre document est trop volumineux. Découpez-le en plusieurs analyses."
)
LIMIT_MESSAGE_TOO_MANY_IMAGES = (
    "Trop de photos pour une seule analyse. Regroupez-les ou découpez votre import."
)
LIMIT_MESSAGE_TOO_MANY_PAGES = (
    "Ce PDF contient trop de pages. Découpez-le en plusieurs analyses."
)
LIMIT_MESSAGE_TOTAL_TOO_LARGE = (
    "L'ensemble des fichiers est trop volumineux. Découpez-le en plusieurs analyses."
)
LIMIT_MESSAGE_EMPTY = "Aucun fichier exploitable n'a été reçu."
LIMIT_MESSAGE_MIXED_TYPES = (
    "Mélangez pas PDF et photos dans un même import. Envoyez un PDF ou plusieurs photos."
)

# Align with frontend import CONFIDENCE_LEVELS.reliable.minScore
VAT_RATE_CONFIDENCE_THRESHOLD = _float_env("IMPORT_VAT_CONFIDENCE_THRESHOLD", 0.85)
