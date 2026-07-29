"""CRM Analytics — period windows, comparison ranges, series granularity."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

PeriodKey = Literal["7d", "30d", "3m", "12m", "year", "prev_year", "custom"]
Granularity = Literal["day", "week", "month"]

VALID_PERIODS = frozenset({"7d", "30d", "3m", "12m", "year", "prev_year", "custom"})
MAX_CUSTOM_DAYS = 366 * 3  # ~3 years


@dataclass(frozen=True)
class PeriodWindow:
    key: str
    start: datetime  # inclusive, timezone-aware (user tz converted to UTC for storage compare)
    end: datetime  # exclusive
    timezone: str
    granularity: Granularity
    comparison_start: datetime
    comparison_end: datetime
    label_start: str  # YYYY-MM-DD in user tz
    label_end: str  # YYYY-MM-DD inclusive last day in user tz


def _tz(name: Optional[str]) -> ZoneInfo:
    raw = (name or "Europe/Paris").strip() or "Europe/Paris"
    try:
        return ZoneInfo(raw)
    except ZoneInfoNotFoundError:
        return ZoneInfo("Europe/Paris")


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _start_of_day(d: date, tz: ZoneInfo) -> datetime:
    return datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=tz)


def _parse_ymd(value: str) -> date:
    parts = value.strip().split("-")
    if len(parts) != 3:
        raise ValueError("invalid_date")
    year, month, day = (int(parts[0]), int(parts[1]), int(parts[2]))
    return date(year, month, day)


def _granularity_for(key: str, start: datetime, end: datetime) -> Granularity:
    if key in {"7d", "30d"}:
        return "day"
    if key == "3m":
        return "week"
    if key in {"12m", "year", "prev_year"}:
        return "month"
    days = max(1, (end - start).days)
    if days <= 45:
        return "day"
    if days <= 120:
        return "week"
    return "month"


def resolve_period(
    period: str,
    *,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    timezone_name: Optional[str] = None,
    now: Optional[datetime] = None,
) -> PeriodWindow:
    if period not in VALID_PERIODS:
        raise ValueError("invalid_period")

    tz = _tz(timezone_name)
    now_local = (now or datetime.now(timezone.utc)).astimezone(tz)
    today = now_local.date()

    if period == "custom":
        if not from_date or not to_date:
            raise ValueError("custom_requires_from_to")
        start_d = _parse_ymd(from_date)
        end_d = _parse_ymd(to_date)
        if end_d < start_d:
            raise ValueError("invalid_range")
        if (end_d - start_d).days > MAX_CUSTOM_DAYS:
            raise ValueError("range_too_large")
        start_local = _start_of_day(start_d, tz)
        end_local = _start_of_day(end_d + timedelta(days=1), tz)
    elif period == "7d":
        start_local = _start_of_day(today - timedelta(days=6), tz)
        end_local = _start_of_day(today + timedelta(days=1), tz)
    elif period == "30d":
        start_local = _start_of_day(today - timedelta(days=29), tz)
        end_local = _start_of_day(today + timedelta(days=1), tz)
    elif period == "3m":
        start_local = _start_of_day(today - timedelta(days=89), tz)
        end_local = _start_of_day(today + timedelta(days=1), tz)
    elif period == "12m":
        approx = date(today.year - 1, today.month, min(today.day, 28))
        start_local = _start_of_day(approx, tz)
        end_local = _start_of_day(today + timedelta(days=1), tz)
    elif period == "year":
        start_local = _start_of_day(date(today.year, 1, 1), tz)
        end_local = _start_of_day(today + timedelta(days=1), tz)
    elif period == "prev_year":
        start_local = _start_of_day(date(today.year - 1, 1, 1), tz)
        end_local = _start_of_day(date(today.year, 1, 1), tz)
    else:
        raise ValueError("invalid_period")

    duration = end_local - start_local
    comparison_end = start_local
    comparison_start = comparison_end - duration

    start_utc = _as_utc(start_local)
    end_utc = _as_utc(end_local)
    cmp_start_utc = _as_utc(comparison_start)
    cmp_end_utc = _as_utc(comparison_end)

    inclusive_end = (end_local - timedelta(seconds=1)).astimezone(tz).date()

    return PeriodWindow(
        key=period,
        start=start_utc,
        end=end_utc,
        timezone=str(tz),
        granularity=_granularity_for(period, start_utc, end_utc),
        comparison_start=cmp_start_utc,
        comparison_end=cmp_end_utc,
        label_start=start_local.date().isoformat(),
        label_end=inclusive_end.isoformat(),
    )


def iso_bounds(window_start: datetime, window_end: datetime) -> Tuple[str, str]:
    """Inclusive/exclusive ISO strings for lexicographic compare on stored ISO dates."""
    return window_start.astimezone(timezone.utc).isoformat(), window_end.astimezone(timezone.utc).isoformat()


def parse_stored_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def in_window(dt: Optional[datetime], start: datetime, end: datetime) -> bool:
    if dt is None:
        return False
    return start <= dt < end


def bucket_key(dt: datetime, granularity: Granularity, tz_name: str) -> str:
    local = dt.astimezone(_tz(tz_name))
    if granularity == "day":
        return local.date().isoformat()
    if granularity == "week":
        monday = local.date() - timedelta(days=local.weekday())
        return monday.isoformat()
    return f"{local.year:04d}-{local.month:02d}"


def build_empty_buckets(window: PeriodWindow) -> list[str]:
    keys: list[str] = []
    tz = _tz(window.timezone)
    cursor = window.start.astimezone(tz)
    end = window.end.astimezone(tz)
    if window.granularity == "day":
        d = cursor.date()
        end_d = end.date()
        while d < end_d:
            keys.append(d.isoformat())
            d += timedelta(days=1)
        return keys
    if window.granularity == "week":
        d = cursor.date() - timedelta(days=cursor.weekday())
        end_d = end.date()
        seen = set()
        while d < end_d:
            key = d.isoformat()
            if key not in seen:
                keys.append(key)
                seen.add(key)
            d += timedelta(days=7)
        return keys
    # month
    y, m = cursor.year, cursor.month
    end_y, end_m = end.year, end.month
    while (y, m) < (end_y, end_m) or (y == end_y and m == end_m and cursor < end):
        keys.append(f"{y:04d}-{m:02d}")
        if y == end_y and m == end_m:
            break
        m += 1
        if m > 12:
            m = 1
            y += 1
        if len(keys) > 48:
            break
    return keys
