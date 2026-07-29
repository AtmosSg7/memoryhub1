"""Internal OpenAI model pricing — USD per 1M tokens. Backend only."""

from __future__ import annotations

import os
import re
from typing import Optional, Tuple

# Default reference prices (USD per 1M tokens) — override via env per model.
# GPT-5 official rates: https://developers.openai.com/api/docs/models/gpt-5
_DEFAULT_INPUT_PER_M = {
    "gpt-4o-mini": 0.15,
    "gpt-4o": 2.50,
    "gpt-4.1-mini": 0.40,
    "gpt-4.1": 2.00,
}

_DEFAULT_OUTPUT_PER_M = {
    "gpt-4o-mini": 0.60,
    "gpt-4o": 10.00,
    "gpt-4.1-mini": 1.60,
    "gpt-4.1": 8.00,
}

_SNAPSHOT_SUFFIX = re.compile(r"-\d{4}-\d{2}-\d{2}$")

# Longest-first so gpt-5-mini matches before gpt-5.
_GPT5_FAMILY_PREFIXES = ("gpt-5-nano", "gpt-5-mini", "gpt-5")


def _normalize_pricing_model(model: str) -> str:
    normalized = (model or "").strip().lower()
    if not normalized:
        return ""
    return _SNAPSHOT_SUFFIX.sub("", normalized)


def _model_env_suffix(model: str) -> str:
    return model.upper().replace("-", "_").replace(".", "_")


def _env_rate(prefix: str, model: str) -> Optional[float]:
    key = f"{prefix}_{_model_env_suffix(model)}"
    raw = os.environ.get(key, "").strip()
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _pricing_model_candidates(model: str) -> list[str]:
    normalized = (model or "").strip().lower()
    if not normalized:
        return []

    stripped = _normalize_pricing_model(normalized)
    candidates: list[str] = []
    for value in (normalized, stripped):
        if value and value not in candidates:
            candidates.append(value)

    for family in _GPT5_FAMILY_PREFIXES:
        if stripped == family or stripped.startswith(f"{family}-"):
            if family not in candidates:
                candidates.append(family)

    return candidates


def get_model_rates(model: str) -> Tuple[Optional[float], Optional[float]]:
    """Return (input_usd_per_1m, output_usd_per_1m) or (None, None) if unknown."""
    candidates = _pricing_model_candidates(model)
    if not candidates:
        return None, None

    input_rate: Optional[float] = None
    output_rate: Optional[float] = None

    for candidate in candidates:
        if input_rate is None:
            input_rate = _env_rate("OPENAI_INPUT_USD_PER_1M", candidate)
        if output_rate is None:
            output_rate = _env_rate("OPENAI_OUTPUT_USD_PER_1M", candidate)
        if input_rate is not None and output_rate is not None:
            break

    if input_rate is None or output_rate is None:
        for candidate in candidates:
            if input_rate is None:
                input_rate = _DEFAULT_INPUT_PER_M.get(candidate)
                if input_rate is None:
                    for key, rate in _DEFAULT_INPUT_PER_M.items():
                        if candidate.startswith(key):
                            input_rate = rate
                            break
            if output_rate is None:
                output_rate = _DEFAULT_OUTPUT_PER_M.get(candidate)
                if output_rate is None:
                    for key, rate in _DEFAULT_OUTPUT_PER_M.items():
                        if candidate.startswith(key):
                            output_rate = rate
                            break
            if input_rate is not None and output_rate is not None:
                break

    return input_rate, output_rate


def estimate_cost_usd(
    *,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> Tuple[Optional[float], bool]:
    """
    Estimate USD cost. Returns (amount, cost_known).
    If rates unknown, returns (None, False).
    """
    input_rate, output_rate = get_model_rates(model)
    if input_rate is None or output_rate is None:
        return None, False
    cost = (max(0, input_tokens) * input_rate / 1_000_000) + (
        max(0, output_tokens) * output_rate / 1_000_000
    )
    return round(cost, 6), True
