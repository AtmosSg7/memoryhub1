"""Shared date-range filters for commercial document list endpoints."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException

from kpi_definitions import (
    DEFAULT_ANALYTICS_TIMEZONE,
    day_bounds_utc,
    document_list_date_mode,
    mongo_date_expr_for_mode,
)


def parse_optional_ymd(value: Optional[str]) -> Optional[str]:
    """Return YYYY-MM-DD or None; ignore blank/invalid without raising."""
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        from kpi_definitions import parse_ymd

        parse_ymd(raw)
        return raw
    except ValueError:
        return None


def resolve_list_period(
    from_date: Optional[str],
    to_date: Optional[str],
    *,
    timezone_name: Optional[str] = None,
) -> Optional[Tuple[str, str]]:
    """
    Resolve inclusive YYYY-MM-DD bounds to UTC ISO [start, end) strings.
    Invalid params are ignored (None). Inverted ranges raise 422.
    """
    start_ymd = parse_optional_ymd(from_date)
    end_ymd = parse_optional_ymd(to_date)
    if not start_ymd and not end_ymd:
        return None
    if not start_ymd or not end_ymd:
        # One-sided ranges ignored cleanly (avoid surprising partial filters)
        return None
    try:
        start_utc, end_utc = day_bounds_utc(
            start_ymd,
            end_ymd,
            timezone_name=timezone_name or DEFAULT_ANALYTICS_TIMEZONE,
        )
    except ValueError as exc:
        if str(exc) == "invalid_range":
            raise HTTPException(
                status_code=422,
                detail={"message": "Invalid date range: 'to' must be on or after 'from'."},
            ) from exc
        return None
    return start_utc.isoformat(), end_utc.isoformat()


def period_aggregation_stages(
    *,
    kind: str,
    status: Optional[str],
    from_date: Optional[str],
    to_date: Optional[str],
    timezone_name: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Extra aggregation stages after $match on user/status/client.
    Adds _filterDate and optionally matches the period window.
    """
    bounds = resolve_list_period(from_date, to_date, timezone_name=timezone_name)
    mode = document_list_date_mode(kind=kind, status=status)
    date_expr = mongo_date_expr_for_mode(mode, kind=kind)
    stages: List[Dict[str, Any]] = [{"$addFields": {"_filterDate": date_expr}}]
    if bounds:
        start_iso, end_iso = bounds
        stages.append({"$match": {"_filterDate": {"$gte": start_iso, "$lt": end_iso}}})
    return stages
