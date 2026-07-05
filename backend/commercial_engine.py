import re
from typing import Any, List, Optional, Tuple

from commercial_models import (
    DEFAULT_COMMERCIAL_VAT_RATE,
    MAX_COMMERCIAL_LINES,
    CommercialDocumentAmounts,
    CommercialDocumentTotals,
    CommercialLineItem,
)

DEFAULT_VAT_RATE = DEFAULT_COMMERCIAL_VAT_RATE


def compute_global_totals(amount_ht: int, vat_rate: int) -> CommercialDocumentTotals:
    safe_ht = max(int(amount_ht), 0)
    safe_rate = max(0, min(int(vat_rate), 100))
    amount_ttc = (safe_ht * (100 + safe_rate)) // 100
    return CommercialDocumentTotals(amountHT=safe_ht, vatRate=safe_rate, amountTTC=amount_ttc)


def totals_from_lines(
    lines: List[CommercialLineItem],
    *,
    fallback_vat_rate: int = DEFAULT_VAT_RATE,
) -> CommercialDocumentTotals:
    if not lines:
        return compute_global_totals(0, fallback_vat_rate)

    total_ht = 0
    total_ttc = 0
    for line in lines:
        if line.amountHT <= 0:
            continue
        total_ht += line.amountHT
        total_ttc += (line.amountHT * (100 + line.vatRate)) // 100

    if total_ht <= 0:
        return compute_global_totals(0, fallback_vat_rate)

    vat_amount = total_ttc - total_ht
    effective_vat = int(round(vat_amount * 100 / total_ht))
    effective_vat = max(0, min(effective_vat, 100))
    return CommercialDocumentTotals(amountHT=total_ht, vatRate=effective_vat, amountTTC=total_ttc)


def serialize_line_items(lines: Optional[List[CommercialLineItem]]) -> Optional[List[dict]]:
    if not lines:
        return None
    return [line.model_dump() for line in lines]


def parse_line_items(raw_items: Any) -> List[CommercialLineItem]:
    if not isinstance(raw_items, list):
        return []

    parsed: List[CommercialLineItem] = []
    for raw in raw_items[:MAX_COMMERCIAL_LINES]:
        if not isinstance(raw, dict):
            continue
        line = normalize_line_item(raw)
        if line:
            parsed.append(line)
    return parsed


def normalize_line_item(raw: dict, *, default_vat_rate: int = DEFAULT_VAT_RATE) -> Optional[CommercialLineItem]:
    description = str(raw.get("description") or raw.get("label") or "").strip()
    if not description:
        return None

    quantity = _parse_quantity(raw.get("quantity") or raw.get("qty"))
    unit_price_ht = _parse_cents(raw.get("unitPriceHT") or raw.get("unitPrice") or raw.get("priceHT"))
    amount_ht = _parse_cents(raw.get("amountHT") or raw.get("totalHT") or raw.get("lineTotal") or raw.get("amount"))
    discount = raw.get("discount") or raw.get("remise")

    if amount_ht is None and unit_price_ht is not None:
        amount_ht = int(round(quantity * unit_price_ht))
    if unit_price_ht is None and amount_ht is not None and quantity:
        unit_price_ht = int(round(amount_ht / quantity))
    if amount_ht is None:
        amount_ht = unit_price_ht or 0

    amount_ht = _apply_discount(amount_ht, discount)
    if amount_ht <= 0:
        return None

    if unit_price_ht is None:
        unit_price_ht = int(round(amount_ht / quantity)) if quantity else amount_ht

    vat_rate = _parse_vat_rate(raw.get("vatRate") or raw.get("vat"), default_vat_rate)
    item = CommercialLineItem(
        description=description,
        quantity=quantity,
        unitPriceHT=max(unit_price_ht, 0),
        vatRate=vat_rate,
        amountHT=amount_ht,
    )
    if discount:
        item.discount = str(discount).strip()
    return item


def convert_analysis_line_items(
    raw_items: Any,
    *,
    default_vat_rate: int = DEFAULT_VAT_RATE,
) -> List[CommercialLineItem]:
    if not isinstance(raw_items, list) or not raw_items:
        return []

    lines: List[CommercialLineItem] = []
    for raw in raw_items[:MAX_COMMERCIAL_LINES]:
        if not isinstance(raw, dict):
            continue
        line = normalize_line_item(raw, default_vat_rate=default_vat_rate)
        if line:
            lines.append(line)
    return lines


def resolve_document_amounts(
    line_items: Optional[List[CommercialLineItem]],
    *,
    fallback_amount_ht: int,
    fallback_vat_rate: int = DEFAULT_VAT_RATE,
) -> CommercialDocumentAmounts:
    if line_items:
        valid = [
            line
            for line in line_items
            if line.description.strip() and line.amountHT > 0
        ]
        if valid:
            return CommercialDocumentAmounts(
                lineItems=valid,
                totals=totals_from_lines(valid, fallback_vat_rate=fallback_vat_rate),
            )
    return CommercialDocumentAmounts(
        lineItems=None,
        totals=compute_global_totals(fallback_amount_ht, fallback_vat_rate),
    )


def resolve_import_document_amounts(
    raw_items: Any,
    *,
    fallback_amount_ht: int,
    fallback_vat_rate: int,
) -> CommercialDocumentAmounts:
    lines = convert_analysis_line_items(raw_items, default_vat_rate=fallback_vat_rate)
    if lines:
        return CommercialDocumentAmounts(
            lineItems=lines,
            totals=totals_from_lines(lines, fallback_vat_rate=fallback_vat_rate),
        )
    return CommercialDocumentAmounts(
        lineItems=None,
        totals=compute_global_totals(fallback_amount_ht, fallback_vat_rate),
    )


def compute_document_totals(
    lines: Any,
    *,
    fallback_vat_rate: int = DEFAULT_VAT_RATE,
) -> Tuple[int, int, int]:
    if isinstance(lines, list) and lines and isinstance(lines[0], CommercialLineItem):
        parsed = lines
    else:
        parsed = parse_line_items(lines)
    totals = totals_from_lines(parsed, fallback_vat_rate=fallback_vat_rate)
    return totals.amountHT, totals.vatRate, totals.amountTTC


async def load_import_analysis_line_items(
    db,
    user_id: str,
    import_session_id: str,
) -> List[dict]:
    if not import_session_id:
        return []

    session = await db.import_sessions.find_one(
        {"userId": user_id, "id": import_session_id},
        {"_id": 0, "analysis.rawExtracted.lineItems": 1},
    )
    if not session:
        return []

    raw_items = session.get("analysis", {}).get("rawExtracted", {}).get("lineItems")
    if not isinstance(raw_items, list):
        return []
    return raw_items


def _parse_cents(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return max(value, 0)
    if isinstance(value, float):
        if not float(value).is_integer():
            return max(int(round(value * 100)), 0)
        whole = int(round(value))
        if whole >= 10000:
            return max(whole, 0)
        return max(int(round(float(whole) * 100)), 0)
    text = str(value).strip()
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    if not digits:
        return None
    amount = int(digits)
    return amount if amount >= 10000 else int(round(amount * 100))


def _parse_quantity(value: Any) -> float:
    if value is None or value == "":
        return 1.0
    if isinstance(value, bool):
        return 1.0
    if isinstance(value, (int, float)):
        qty = float(value)
        return qty if qty > 0 else 1.0
    match = re.search(r"(\d+(?:\.\d+)?)", str(value).replace(",", "."))
    if not match:
        return 1.0
    qty = float(match.group(1))
    return qty if qty > 0 else 1.0


def _parse_vat_rate(value: Any, default: int) -> int:
    if value is None or value == "":
        return default
    try:
        rate = int(round(float(value)))
    except (TypeError, ValueError):
        match = re.search(r"(\d+(?:\.\d+)?)", str(value))
        if not match:
            return default
        rate = int(round(float(match.group(1).replace(",", "."))))
    return max(0, min(rate, 100))


def _apply_discount(amount_ht: int, discount: Any) -> int:
    if amount_ht <= 0 or not discount:
        return amount_ht
    text = str(discount).strip()
    match = re.search(r"(\d+(?:[.,]\d+)?)\s*%", text)
    if match:
        percent = float(match.group(1).replace(",", "."))
        if 0 < percent <= 100:
            return max(int(round(amount_ht * (100 - percent) / 100)), 0)
    if text.isdigit():
        percent = int(text)
        if 0 < percent <= 100:
            return max(int(round(amount_ht * (100 - percent) / 100)), 0)
    return amount_ht
