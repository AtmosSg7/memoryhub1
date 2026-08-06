"""Query normalization helpers for universal search — no invented scores."""

from __future__ import annotations

import re
import unicodedata
from typing import List, Optional, Set, Tuple

from integrations.matching import normalize_phone_fr

_ACCENT_GROUPS = {
    "a": "aàáâäãåā",
    "e": "eéèêëē",
    "i": "iíìîïī",
    "o": "oóòôöõō",
    "u": "uúùûüū",
    "c": "cç",
    "n": "nñ",
    "y": "yýÿ",
}

_PHONE_DIGITS_RE = re.compile(r"\d")
_AMOUNT_RE = re.compile(r"(?<!\w)(\d{2,7}(?:[.,]\d{1,2})?)\s*€?")


def strip_accents(value: str) -> str:
    text = unicodedata.normalize("NFKD", value or "")
    return "".join(ch for ch in text if not unicodedata.combining(ch))


def collapse_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def normalize_query(query: str) -> str:
    return collapse_spaces(query)


def is_phone_like(query: str) -> bool:
    digits = re.sub(r"\D", "", query or "")
    return len(digits) >= 8 and len(digits) <= 15 and sum(c.isdigit() for c in query) >= 6


def phone_query_variants(query: str) -> List[str]:
    """FR phone variants for regex OR matching (stored forms vary)."""
    if not is_phone_like(query):
        return []
    normalized = normalize_phone_fr(query)
    if not normalized:
        return []
    variants: Set[str] = {normalized, query.strip()}
    digits = re.sub(r"\D", "", normalized)
    if digits.startswith("0") and len(digits) >= 10:
        national = digits[1:]
        variants.update(
            {
                digits,
                f"+33{national}",
                f"0033{national}",
                f"33{national}",
                national,
            }
        )
    # Spaced / dotted FR mobile
    if len(digits) == 10 and digits.startswith("0"):
        parts = [digits[i : i + 2] for i in range(0, 10, 2)]
        variants.add(" ".join(parts))
        variants.add(".".join(parts))
        variants.add("-".join(parts))
    return [v for v in variants if v]


def accent_flexible_regex(query: str) -> str:
    """Build a regex that tolerates FR accents and case (caller adds $options i)."""
    parts: List[str] = []
    for ch in query:
        if ch.isspace():
            parts.append(r"\s+")
            continue
        base = strip_accents(ch).lower()
        group = _ACCENT_GROUPS.get(base)
        if group:
            parts.append("[" + "".join(re.escape(c) for c in group) + "]")
        else:
            parts.append(re.escape(ch))
    return "".join(parts)


def amount_cent_candidates(query: str) -> List[int]:
    """Map human amounts (e.g. 2450, 2 450 €) to stored cent values."""
    cleaned = (query or "").replace(" ", "").replace("\u00a0", "")
    match = _AMOUNT_RE.search(cleaned) or _AMOUNT_RE.search(query or "")
    if not match:
        digits = re.sub(r"[^\d]", "", query or "")
        if not digits or len(digits) < 2 or len(digits) > 7:
            return []
        n = int(digits)
    else:
        raw = match.group(1).replace(",", ".")
        try:
            n = int(round(float(raw) * (100 if "." in raw else 1)))
            if "." in raw:
                return [n]
            # bare integer: try both euros and cents interpretations
            return sorted({int(raw), int(raw) * 100})
        except ValueError:
            return []
    return sorted({n, n * 100})


def extract_doc_number_hint(query: str) -> Optional[str]:
    """Likely quote/invoice number fragment."""
    q = collapse_spaces(query)
    if re.search(r"(?i)\b(devis|facture|fact|d-|f-)\b", q):
        return q
    if re.fullmatch(r"[A-Za-z]{0,3}[-/]?\d{2,}[A-Za-z0-9/-]*", q.replace(" ", "")):
        return q
    return None


def field_match_tier(field: str, query: str, value: Optional[str]) -> int:
    """Lower is better. Exact > identity > title > body > ai."""
    if value is None:
        return 90
    v = str(value)
    q = query.strip()
    if not q:
        return 90
    vl = v.lower()
    ql = q.lower()
    if vl == ql:
        return 0
    if strip_accents(vl) == strip_accents(ql):
        return 1
    identity_fields = {
        "name",
        "company",
        "email",
        "phone",
        "emails.value",
        "phones.value",
        "number",
        "metadata.fromEmail",
        "metadata.toEmail",
    }
    title_fields = {
        "title",
        "subject",
        "name",
        "suggestedActionTitle",
        "lastSubject",
    }
    ai_fields = {"summary", "intelligence.summary", "intent"}
    if field in identity_fields and ql in vl:
        return 2 if vl.startswith(ql) else 3
    if field == "number" and ql in vl:
        return 2
    if field in title_fields and ql in strip_accents(vl):
        return 4
    if field in ai_fields:
        return 8
    if ql in strip_accents(vl):
        return 6
    return 10


def score_result(
    *,
    matched_fields: List[str],
    query: str,
    field_values: dict,
    occurred_at: str = "",
    linked_to_client: bool = False,
    active_status: bool = False,
) -> Tuple[int, float]:
    """Return (tier, sort_key) — lower tier wins; sort_key for recent boost (higher better)."""
    best = 50
    for field in matched_fields or ["title"]:
        best = min(best, field_match_tier(field, query, field_values.get(field)))
    # Recency boost as fractional component (ISO strings compare lexicographically)
    recency = 0.0
    if occurred_at:
        # Use string length-safe hash of timestamp for secondary sort only
        recency = float(len(occurred_at)) * 0.01
        try:
            # Prefer newer ISO timestamps
            digits = "".join(ch for ch in occurred_at if ch.isdigit())[:14]
            if digits:
                recency = float(digits) / 1e16
        except Exception:
            pass
    if linked_to_client:
        best = max(0, best - 1)
    if active_status:
        best = max(0, best - 1)
    return best, recency


def detect_matched_fields(query: str, candidates: dict) -> List[str]:
    q = strip_accents(query.lower())
    matched: List[str] = []
    for field, value in candidates.items():
        if value is None:
            continue
        hay = strip_accents(str(value).lower())
        if q and q in hay:
            matched.append(field)
    return matched
