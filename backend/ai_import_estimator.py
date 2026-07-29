"""
Import AI credit estimator — single service for complexity tiers and credit preview.

Inputs: file extension, size, optional page count (PDF heuristic).
Outputs: tier key + human-readable factors for UI and billing.

All thresholds live here — never hard-code costs in routes or frontend.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, Literal, Optional

from credit_constants import ImportComplexityTier
from credit_cost_service import resolve_cost

IMAGE_EXTENSIONS = frozenset({"jpg", "jpeg", "png", "webp"})
PDF_EXTENSION = "pdf"

# Tunable heuristics — adjust without touching import flow.
SIMPLE_IMAGE_MAX_BYTES = 400_000
STANDARD_IMAGE_MAX_BYTES = 2_000_000
SIMPLE_PDF_MAX_BYTES = 500_000
STANDARD_PDF_MAX_PAGES = 3
COMPLEX_PDF_MAX_PAGES = 10
PDF_BYTES_PER_PAGE_FALLBACK = 100_000
MAX_PAGE_ESTIMATE = 200


@dataclass(frozen=True)
class ImportEstimateInput:
    extension: str
    size_bytes: int
    mime_type: Optional[str] = None


@dataclass(frozen=True)
class ImportEstimateResult:
    tier_key: ImportComplexityTier
    estimated_credits: int
    page_count_estimate: int
    requires_ocr: bool
    factors: Dict[str, Any] = field(default_factory=dict)


def _normalize_extension(extension: str) -> str:
    return (extension or "").strip().lower().lstrip(".")


def estimate_pdf_page_count(content: bytes) -> int:
    """Best-effort page count without external PDF libraries."""
    if not content:
        return 1

    sample = content[: min(len(content), 800_000)]
    page_markers = len(re.findall(rb"/Type\s*/Page\b", sample))
    if page_markers > 0:
        return max(1, min(page_markers, MAX_PAGE_ESTIMATE))

    count_matches = re.findall(rb"/Count\s+(\d+)", sample)
    if count_matches:
        try:
            return max(1, min(int(count_matches[-1]), MAX_PAGE_ESTIMATE))
        except ValueError:
            pass

    return max(1, min(MAX_PAGE_ESTIMATE, len(content) // PDF_BYTES_PER_PAGE_FALLBACK))


def estimate_page_count(*, extension: str, size_bytes: int, content: Optional[bytes] = None) -> int:
    ext = _normalize_extension(extension)
    if ext == PDF_EXTENSION and content:
        return estimate_pdf_page_count(content)
    if ext == PDF_EXTENSION:
        return max(1, min(MAX_PAGE_ESTIMATE, size_bytes // PDF_BYTES_PER_PAGE_FALLBACK))
    return 1


def resolve_import_tier(
    *,
    extension: str,
    size_bytes: int,
    page_count: int,
) -> ImportComplexityTier:
    ext = _normalize_extension(extension)
    size = max(0, int(size_bytes))
    pages = max(1, int(page_count))

    if ext in IMAGE_EXTENSIONS:
        if size <= SIMPLE_IMAGE_MAX_BYTES:
            return "simple"
        if size <= STANDARD_IMAGE_MAX_BYTES:
            return "standard"
        return "complex"

    if ext == PDF_EXTENSION:
        if pages <= 1 and size <= SIMPLE_PDF_MAX_BYTES:
            return "simple"
        if pages <= STANDARD_PDF_MAX_PAGES:
            return "standard"
        if pages <= COMPLEX_PDF_MAX_PAGES:
            return "complex"
        return "very_complex"

    # Unknown extension — conservative default.
    if size <= SIMPLE_PDF_MAX_BYTES:
        return "simple"
    if size <= 1_500_000:
        return "standard"
    return "complex"


def requires_ocr(*, extension: str) -> bool:
    return _normalize_extension(extension) in IMAGE_EXTENSIONS


async def estimate_import(
    db,
    payload: ImportEstimateInput,
    *,
    content: Optional[bytes] = None,
) -> ImportEstimateResult:
    ext = _normalize_extension(payload.extension)
    pages = estimate_page_count(
        extension=ext,
        size_bytes=payload.size_bytes,
        content=content,
    )
    tier = resolve_import_tier(
        extension=ext,
        size_bytes=payload.size_bytes,
        page_count=pages,
    )
    credits = await resolve_cost(db, "IMPORT_DOCUMENT", tier_key=tier)
    ocr = requires_ocr(extension=ext)

    factors = {
        "extension": ext,
        "sizeBytes": payload.size_bytes,
        "pageCountEstimate": pages,
        "requiresOcr": ocr,
        "tierKey": tier,
    }

    return ImportEstimateResult(
        tier_key=tier,
        estimated_credits=credits,
        page_count_estimate=pages,
        requires_ocr=ocr,
        factors=factors,
    )
