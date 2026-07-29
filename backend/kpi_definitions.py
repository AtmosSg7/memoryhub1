"""
Shared KPI definitions — single source of truth for Dashboard, Analytics, Client 360.

Business definitions (artisan-facing):

- collectedRevenue (Encaissé):
  Sum of payments recorded in the period (get_amount_paid), dated by
  paidAt → invoiceDate → createdAt. Cancelled invoices excluded.

- billedRevenue (Facturé):
  Sum of amountTTC for non-cancelled invoices whose issue date
  (invoiceDate → createdAt) falls in the period.

- outstandingAmount / outstandingPeriod (Reste à encaisser — période):
  Amount still due on unpaid invoices (status in_progress|overdue, amount_due > 0)
  issued during the period.

- outstandingSnapshot (Reste à encaisser — stock):
  Same unpaid rule, for all open invoices issued before the period end
  (not limited to invoices created inside the period). Used by invoicePipeline.

- paidInvoices:
  Count of invoices with a payment landing in the period (same date as collected).

- pending invoices:
  Count of open in_progress invoices with amount_due > 0 issued before period end.

- overdue invoices:
  Count of stored status == overdue with amount_due > 0 issued before period end.
  Overdue is persisted by sync_overdue_invoices (due = issue date + INVOICE_PAYMENT_DAYS).

- quotesCreated / quote pipeline counts:
  Quotes whose quoteDate → createdAt falls in the period, grouped by stored status.

- quoteAcceptanceRate:
  accepted / (accepted + rejected + expired) among quotes created in the period.
  None when no decided quotes (do not show 0%).

- newClients:
  Clients whose createdAt falls in the period.

- averageBasket (Panier moyen):
  collectedRevenue / number of distinct clients with a payment in the period.

- client totalRevenue (Client 360 / liste clients):
  Sum of get_amount_paid across all non-cancelled invoices for that client
  (all-time, not period-scoped).

Date windows use [start, end) in UTC after resolving local calendar days
in the user timezone (default Europe/Paris). The inclusive UI end date is
label_end (last local calendar day).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from invoice_payments import compute_amount_due, get_amount_paid

LEGACY_INVOICE_STATUSES = frozenset({"draft", "sent"})
VALID_INVOICE_STATUSES = frozenset({"in_progress", "paid", "overdue", "cancelled"})
OPEN_INVOICE_STATUSES = frozenset({"in_progress", "overdue"})
QUOTE_STATUSES = ("draft", "sent", "accepted", "rejected", "expired")
DEFAULT_ANALYTICS_TIMEZONE = "Europe/Paris"


def normalize_invoice_status(status: Optional[str]) -> str:
    """Normalize stored invoice payment status (legacy draft/sent → in_progress)."""
    if not status or status in LEGACY_INVOICE_STATUSES:
        return "in_progress"
    if status in VALID_INVOICE_STATUSES:
        return status
    return "in_progress"


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


def invoice_event_date(doc: dict) -> Optional[datetime]:
    """Issue date for billed / created KPIs."""
    return parse_stored_datetime(doc.get("invoiceDate") or doc.get("createdAt"))


def invoice_paid_date(doc: dict) -> Optional[datetime]:
    """Payment date for collected / paid-count KPIs."""
    return parse_stored_datetime(doc.get("paidAt") or doc.get("invoiceDate") or doc.get("createdAt"))


def quote_event_date(doc: dict) -> Optional[datetime]:
    """Creation/event date for quote KPIs and period filters."""
    return parse_stored_datetime(doc.get("quoteDate") or doc.get("createdAt"))


def quote_accepted_at(doc: dict) -> Optional[datetime]:
    """Best available acceptance timestamp (portal or manual update)."""
    return parse_stored_datetime(
        doc.get("acceptedAt") or doc.get("portalAcceptedAt") or doc.get("updatedAt")
    )


def client_created_at(doc: dict) -> Optional[datetime]:
    return parse_stored_datetime(doc.get("createdAt"))


def resolve_timezone(name: Optional[str]) -> ZoneInfo:
    raw = (name or DEFAULT_ANALYTICS_TIMEZONE).strip() or DEFAULT_ANALYTICS_TIMEZONE
    try:
        return ZoneInfo(raw)
    except ZoneInfoNotFoundError:
        return ZoneInfo(DEFAULT_ANALYTICS_TIMEZONE)


def parse_ymd(value: str):
    from datetime import date

    parts = value.strip().split("-")
    if len(parts) != 3:
        raise ValueError("invalid_date")
    year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
    return date(year, month, day)


def day_bounds_utc(
    from_ymd: str,
    to_ymd: str,
    *,
    timezone_name: Optional[str] = None,
) -> Tuple[datetime, datetime]:
    """
    Inclusive local calendar days → UTC [start, end) window.
    Invalid or inverted ranges raise ValueError.
    """
    from datetime import date, timedelta

    tz = resolve_timezone(timezone_name)
    start_d = parse_ymd(from_ymd)
    end_d = parse_ymd(to_ymd)
    if end_d < start_d:
        raise ValueError("invalid_range")
    start_local = datetime(start_d.year, start_d.month, start_d.day, 0, 0, 0, tzinfo=tz)
    end_local = datetime(end_d.year, end_d.month, end_d.day, 0, 0, 0, tzinfo=tz) + timedelta(days=1)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def in_window(dt: Optional[datetime], start: datetime, end: datetime) -> bool:
    if dt is None:
        return False
    return start <= dt < end


def sum_client_collected_revenue(invoices: List[dict]) -> int:
    """All-time collected revenue for a client (non-cancelled invoices)."""
    total = 0
    for inv in invoices:
        if normalize_invoice_status(inv.get("status")) == "cancelled":
            continue
        total += get_amount_paid(inv)
    return total


async def compute_client_collected_revenue(db, user_id: str, client_id: str) -> int:
    """Mongo-backed all-time collected revenue for Client 360 / list consistency."""
    total = 0
    cursor = db.invoices.find(
        {"userId": user_id, "clientId": client_id, "status": {"$ne": "cancelled"}},
        {"amountPaid": 1, "amountTTC": 1, "status": 1},
    )
    async for inv in cursor:
        total += get_amount_paid(inv)
    return total


def is_open_unpaid(inv: dict) -> bool:
    status = normalize_invoice_status(inv.get("status"))
    if status not in OPEN_INVOICE_STATUSES:
        return False
    due = compute_amount_due(int(inv.get("amountTTC") or 0), get_amount_paid(inv))
    return due > 0


def document_list_date_mode(*, kind: str, status: Optional[str]) -> str:
    """
    Which date drives Documents period filters so deep-links match KPIs.
    - invoice + paid → paid date (collected)
    - otherwise → event/issue date
    """
    if kind == "invoice" and status == "paid":
        return "paid"
    return "event"


def mongo_date_expr_for_mode(mode: str, *, kind: str) -> Dict[str, Any]:
    """Mongo expression producing the ISO date string used for period filtering."""
    if kind == "quote":
        return {"$ifNull": ["$quoteDate", "$createdAt"]}
    if mode == "paid":
        return {"$ifNull": ["$paidAt", {"$ifNull": ["$invoiceDate", "$createdAt"]}]}
    return {"$ifNull": ["$invoiceDate", "$createdAt"]}
