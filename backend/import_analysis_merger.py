"""Merge per-page import analysis results with resilience."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from import_classification import normalize_detected_kind
from import_constants import VAT_RATE_CONFIDENCE_THRESHOLD
from import_models import AnalysisResultData, DocumentKind, NormalizedCommercialFields


CONFIDENCE_FIELDS = (
    "clientName",
    "company",
    "email",
    "phone",
    "externalNumber",
    "documentDate",
    "amountHT",
    "vatRate",
    "amountTTC",
    "title",
)


def _best_kind(results: List[AnalysisResultData]) -> Tuple[DocumentKind, float]:
    best_kind: DocumentKind = "other"
    best_score = -1.0
    for result in results:
        score = result.detectedKindConfidence or 0.0
        if score > best_score:
            best_score = score
            best_kind = result.detectedKind
    return best_kind, max(best_score, 0.0)


def _pick_field(
    results: List[AnalysisResultData],
    field: str,
) -> Tuple[Optional[Any], float]:
    best_value = None
    best_score = -1.0
    for result in results:
        value = getattr(result.normalized, field, None)
        score = result.confidence.get(field, 0.0)
        if value is not None and value != "" and score >= best_score:
            best_value = value
            best_score = score
    return best_value, max(best_score, 0.0)


def _merge_line_items(results: List[AnalysisResultData]) -> List[Dict[str, Any]]:
    merged: List[Dict[str, Any]] = []
    seen_labels = set()
    for result in results:
        raw_items = (result.rawExtracted or {}).get("lineItems") or []
        if not isinstance(raw_items, list):
            continue
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            label = (item.get("label") or item.get("description") or "").strip().lower()
            if not label or label in seen_labels:
                continue
            seen_labels.add(label)
            merged.append(item)
    return merged[:50]


def merge_page_analyses(
    results: List[AnalysisResultData],
    *,
    failed_pages: List[int],
    provider: str,
    provider_version: str,
    analyzed_at: str,
    preprocessing_warnings: Optional[List[str]] = None,
) -> AnalysisResultData:
    successful = [result for result in results if not result.errors]
    if not successful:
        errors = []
        warnings = []
        for result in results:
            errors.extend(result.errors)
            warnings.extend(result.warnings)
        if failed_pages:
            warnings.append(
                f"Analyse impossible pour la ou les page(s) : {', '.join(map(str, failed_pages))}."
            )
        if preprocessing_warnings:
            warnings.extend(preprocessing_warnings)
        return AnalysisResultData(
            provider=provider,
            providerVersion=provider_version,
            analyzedAt=analyzed_at,
            detectedKind="other",
            detectedKindConfidence=0.0,
            errors=errors or ["Analyse IA indisponible."],
            warnings=warnings,
        )

    detected_kind, kind_confidence = _best_kind(successful)
    detected_kind = normalize_detected_kind(detected_kind)

    field_values: Dict[str, Any] = {}
    confidence: Dict[str, float] = {field: 0.0 for field in CONFIDENCE_FIELDS}
    for field in CONFIDENCE_FIELDS:
        value, score = _pick_field(successful, field)
        if value is not None and value != "":
            if field == "vatRate" and score < VAT_RATE_CONFIDENCE_THRESHOLD:
                confidence[field] = score
                continue
            field_values[field] = value
            confidence[field] = score

    normalized = NormalizedCommercialFields(
        clientName=field_values.get("clientName"),
        company=field_values.get("company"),
        contactName=field_values.get("contactName") or field_values.get("clientName"),
        email=field_values.get("email"),
        phone=field_values.get("phone"),
        address=field_values.get("address"),
        city=field_values.get("city"),
        externalNumber=field_values.get("externalNumber"),
        documentDate=field_values.get("documentDate"),
        title=field_values.get("title"),
        amountHT=field_values.get("amountHT"),
        vatRate=field_values.get("vatRate"),
        amountTTC=field_values.get("amountTTC"),
        internalNotes=field_values.get("internalNotes"),
        status="draft" if detected_kind == "quote" else "sent",
    )

    line_items = _merge_line_items(successful)
    warnings: List[str] = []
    errors: List[str] = []
    for result in results:
        warnings.extend(result.warnings)
        if result.errors:
            errors.extend(result.errors)

    if failed_pages:
        warnings.append(
            f"Certaines pages n'ont pas pu être analysées ({', '.join(map(str, failed_pages))}). "
            "Les données disponibles ont été conservées."
        )
    if preprocessing_warnings:
        warnings.extend(preprocessing_warnings)

    overall_values = [score for score in confidence.values() if score > 0]
    overall_confidence = (
        round(sum(overall_values) / len(overall_values), 4) if overall_values else 0.0
    )

    raw_extracted = dict(successful[0].rawExtracted or {})
    raw_extracted["lineItems"] = line_items
    raw_extracted["pageCount"] = len(results)
    raw_extracted["failedPages"] = failed_pages
    raw_extracted["mergedFromPages"] = len(successful)

    return AnalysisResultData(
        rawExtracted=raw_extracted,
        normalized=normalized,
        confidence=confidence,
        overallConfidence=overall_confidence,
        provider=provider,
        providerVersion=provider_version,
        analyzedAt=analyzed_at,
        detectedKind=detected_kind,
        detectedKindConfidence=kind_confidence,
        errors=[],
        warnings=warnings,
    )
