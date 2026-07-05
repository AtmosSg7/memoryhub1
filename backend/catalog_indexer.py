import re
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from commercial_models import CommercialLineItem

DEFAULT_CATALOG_SOURCE = "learned"


def normalize_catalog_description(text: str) -> str:
    raw = str(text or "").strip()
    if not raw:
        return ""
    normalized = unicodedata.normalize("NFKD", raw)
    without_accents = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    collapsed = re.sub(r"\s+", " ", without_accents.lower()).strip()
    return collapsed


def _resolve_default_vat_rate(vat_rate_counts: Dict[str, int], fallback: int) -> int:
    if not vat_rate_counts:
        return fallback
    best_rate = fallback
    best_count = -1
    for rate_text, count in vat_rate_counts.items():
        try:
            rate = int(rate_text)
        except (TypeError, ValueError):
            continue
        if count > best_count:
            best_count = count
            best_rate = rate
    return max(0, min(best_rate, 100))


def _coerce_line_item(line: Any) -> Optional[CommercialLineItem]:
    if isinstance(line, CommercialLineItem):
        return line
    if isinstance(line, dict):
        try:
            return CommercialLineItem.model_validate(line)
        except Exception:
            return None
    return None


async def index_catalog_line_items(
    db,
    user_id: str,
    line_items: Optional[List[Any]],
) -> None:
    if not line_items:
        return

    now = datetime.now(timezone.utc).isoformat()
    for raw_line in line_items:
        line = _coerce_line_item(raw_line)
        if not line or line.amountHT <= 0:
            continue

        normalized_key = normalize_catalog_description(line.description)
        if not normalized_key:
            continue

        existing = await db.catalog_items.find_one(
            {"userId": user_id, "normalizedKey": normalized_key},
            {"_id": 0},
        )

        unit_price = max(int(line.unitPriceHT), 0)
        vat_rate = max(0, min(int(line.vatRate), 100))
        description = line.description.strip()

        if existing:
            usage_count = int(existing.get("usageCount", 0)) + 1
            price_sum = int(existing.get("unitPriceHTSum", 0)) + unit_price
            vat_rate_counts = dict(existing.get("vatRateCounts") or {})
            vat_rate_counts[str(vat_rate)] = int(vat_rate_counts.get(str(vat_rate), 0)) + 1
            update_doc = {
                "description": description,
                "usageCount": usage_count,
                "unitPriceHTSum": price_sum,
                "unitPriceHTMin": min(int(existing.get("unitPriceHTMin", unit_price)), unit_price),
                "unitPriceHTMax": max(int(existing.get("unitPriceHTMax", unit_price)), unit_price),
                "unitPriceHTAvg": price_sum // usage_count,
                "vatRateCounts": vat_rate_counts,
                "defaultVatRate": _resolve_default_vat_rate(vat_rate_counts, vat_rate),
                "lastUsedAt": now,
                "updatedAt": now,
            }
            await db.catalog_items.update_one(
                {"userId": user_id, "normalizedKey": normalized_key},
                {"$set": update_doc},
            )
            continue

        vat_rate_counts = {str(vat_rate): 1}
        await db.catalog_items.insert_one(
            {
                "id": str(uuid.uuid4()),
                "userId": user_id,
                "normalizedKey": normalized_key,
                "description": description,
                "usageCount": 1,
                "unitPriceHTSum": unit_price,
                "unitPriceHTMin": unit_price,
                "unitPriceHTMax": unit_price,
                "unitPriceHTAvg": unit_price,
                "vatRateCounts": vat_rate_counts,
                "defaultVatRate": vat_rate,
                "source": DEFAULT_CATALOG_SOURCE,
                "lastUsedAt": now,
                "createdAt": now,
                "updatedAt": now,
            }
        )
