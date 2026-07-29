"""Mongo-backed analytics aggregations for a single user.

KPI formulas live in kpi_definitions (module docstring). This module loads
projected collections (capped at 10_000 quotes/invoices, 5_000 clients) and
computes window metrics in Python. Indexes on userId help the initial scan;
further Mongo $group aggregation is optional for larger volumes.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from invoice_payments import compute_amount_due, get_amount_paid
from kpi_definitions import (
    QUOTE_STATUSES,
    client_created_at,
    invoice_event_date,
    invoice_paid_date,
    normalize_invoice_status,
    quote_accepted_at,
    quote_event_date,
)

from analytics.periods import (
    PeriodWindow,
    bucket_key,
    build_empty_buckets,
    in_window,
    parse_stored_datetime,
)

INACTIVE_DAYS = 60
TOP_CLIENTS_LIMIT = 10
BREAKDOWN_LIMIT = 6
# Documented scan ceiling — analytics loads at most this many docs per collection.
ANALYTICS_DOC_SCAN_LIMIT = 10_000
ANALYTICS_CLIENT_SCAN_LIMIT = 5_000


def change_percent(current: float, previous: float) -> Optional[float]:
    if previous == 0:
        return None if current == 0 else None  # never invent +100% from zero
    return round(((current - previous) / previous) * 1000) / 10


def safe_ratio(numerator: float, denominator: float) -> Optional[float]:
    if denominator <= 0:
        return None
    return round((numerator / denominator) * 1000) / 1000


async def load_user_docs(db, user_id: str) -> Tuple[List[dict], List[dict], List[dict]]:
    """Load projected collections once — filtered by userId only."""
    client_proj = {"id": 1, "name": 1, "company": 1, "contactName": 1, "createdAt": 1, "updatedAt": 1, "lastActivityAt": 1}
    quote_proj = {
        "id": 1,
        "clientId": 1,
        "clientName": 1,
        "status": 1,
        "amountTTC": 1,
        "quoteDate": 1,
        "createdAt": 1,
        "updatedAt": 1,
        "acceptedAt": 1,
        "portalAcceptedAt": 1,
        "sentAt": 1,
    }
    invoice_proj = {
        "id": 1,
        "clientId": 1,
        "clientName": 1,
        "status": 1,
        "amountTTC": 1,
        "amountPaid": 1,
        "invoiceDate": 1,
        "createdAt": 1,
        "updatedAt": 1,
        "paidAt": 1,
    }
    user_filter = {"userId": user_id}
    clients = await db.clients.find(user_filter, client_proj).to_list(ANALYTICS_CLIENT_SCAN_LIMIT)
    quotes = await db.quotes.find(user_filter, quote_proj).to_list(ANALYTICS_DOC_SCAN_LIMIT)
    invoices = await db.invoices.find(user_filter, invoice_proj).to_list(ANALYTICS_DOC_SCAN_LIMIT)
    return clients, quotes, invoices


def _client_display_name(client: dict) -> str:
    return (
        (client.get("company") or "").strip()
        or (client.get("name") or "").strip()
        or (client.get("contactName") or "").strip()
        or "Client"
    )


def compute_window_metrics(
    *,
    clients: List[dict],
    quotes: List[dict],
    invoices: List[dict],
    start: datetime,
    end: datetime,
) -> Dict[str, Any]:
    collected = 0
    billed = 0
    paid_count = 0
    invoice_created = 0
    payment_days: List[float] = []

    quote_counts = {s: 0 for s in QUOTE_STATUSES}
    quotes_created = 0
    proposed_amount = 0
    accepted_amount = 0
    acceptance_days: List[float] = []
    decided = 0  # accepted + rejected + expired

    new_clients = 0
    clients_by_id = {c.get("id"): c for c in clients if c.get("id")}

    for client in clients:
        created = client_created_at(client)
        if in_window(created, start, end):
            new_clients += 1

    for quote in quotes:
        status = quote.get("status") or "draft"
        if status not in quote_counts:
            continue
        created = quote_event_date(quote)
        if not in_window(created, start, end):
            continue
        quotes_created += 1
        quote_counts[status] += 1
        amount = int(quote.get("amountTTC") or 0)
        proposed_amount += amount
        if status == "accepted":
            accepted_amount += amount
            decided += 1
            accepted_at = quote_accepted_at(quote)
            if created and accepted_at and accepted_at >= created:
                acceptance_days.append((accepted_at - created).total_seconds() / 86400)
        elif status in {"rejected", "expired"}:
            decided += 1

    revenue_client_ids = set()
    client_collected: Dict[str, int] = defaultdict(int)
    client_billed: Dict[str, int] = defaultdict(int)
    client_quotes: Dict[str, int] = defaultdict(int)
    client_invoices: Dict[str, int] = defaultdict(int)

    for quote in quotes:
        created = quote_event_date(quote)
        if in_window(created, start, end) and quote.get("clientId"):
            client_quotes[quote["clientId"]] += 1

    for inv in invoices:
        status = normalize_invoice_status(inv.get("status"))
        if status == "cancelled":
            continue
        amount_ttc = int(inv.get("amountTTC") or 0)
        paid = get_amount_paid(inv)
        due = compute_amount_due(amount_ttc, paid)
        event_date = invoice_event_date(inv)
        paid_date = invoice_paid_date(inv) if paid > 0 else None
        client_id = inv.get("clientId") or ""

        if in_window(event_date, start, end):
            invoice_created += 1
            billed += amount_ttc
            if client_id:
                client_billed[client_id] += amount_ttc
                client_invoices[client_id] += 1

        if paid > 0 and in_window(paid_date, start, end):
            collected += paid
            paid_count += 1
            if client_id:
                client_collected[client_id] += paid
                revenue_client_ids.add(client_id)
            issued = event_date
            if issued and paid_date and paid_date >= issued:
                payment_days.append((paid_date - issued).total_seconds() / 86400)

    # Open invoices: snapshot (all open before period end) vs period (issued in window)
    pending = 0
    overdue = 0
    outstanding_snapshot = 0
    outstanding_period = 0
    for inv in invoices:
        status = normalize_invoice_status(inv.get("status"))
        if status not in {"in_progress", "overdue"}:
            continue
        event_date = invoice_event_date(inv)
        if event_date and event_date >= end:
            continue
        due = compute_amount_due(int(inv.get("amountTTC") or 0), get_amount_paid(inv))
        if due <= 0:
            continue
        outstanding_snapshot += due
        if status == "overdue":
            overdue += 1
        else:
            pending += 1
        if in_window(event_date, start, end):
            outstanding_period += due

    acceptance_rate = safe_ratio(quote_counts["accepted"], decided)
    avg_acceptance = round(sum(acceptance_days) / len(acceptance_days), 1) if acceptance_days else None
    avg_payment = round(sum(payment_days) / len(payment_days), 1) if payment_days else None
    avg_basket = int(collected / len(revenue_client_ids)) if revenue_client_ids else 0

    return {
        "collected": collected,
        "billed": billed,
        "outstanding": outstanding_period,
        "outstandingSnapshot": outstanding_snapshot,
        "newClients": new_clients,
        "quotesCreated": quotes_created,
        "quoteCounts": quote_counts,
        "proposedAmount": proposed_amount,
        "acceptedAmount": accepted_amount,
        "acceptanceRate": acceptance_rate,
        "avgAcceptanceDays": avg_acceptance,
        "paidInvoices": paid_count,
        "invoiceCreated": invoice_created,
        "pending": pending,
        "overdue": overdue,
        "avgPaymentDays": avg_payment,
        "averageBasket": avg_basket,
        "revenueClientIds": revenue_client_ids,
        "clientCollected": dict(client_collected),
        "clientBilled": dict(client_billed),
        "clientQuotes": dict(client_quotes),
        "clientInvoices": dict(client_invoices),
        "clientsById": clients_by_id,
        "acceptedQuotes": quote_counts["accepted"],
    }


def build_series(
    *,
    window: PeriodWindow,
    clients: List[dict],
    quotes: List[dict],
    invoices: List[dict],
) -> Tuple[List[dict], List[dict], List[dict]]:
    keys = build_empty_buckets(window)
    financial = {k: {"collected": 0, "billed": 0, "outstanding": 0} for k in keys}
    commercial = {k: {"quotesCreated": 0, "quotesAccepted": 0, "invoicesCreated": 0, "invoicesPaid": 0} for k in keys}
    client_series = {k: {"newClients": 0, "activeClients": 0} for k in keys}
    active_sets = {k: set() for k in keys}

    for inv in invoices:
        status = normalize_invoice_status(inv.get("status"))
        if status == "cancelled":
            continue
        amount_ttc = int(inv.get("amountTTC") or 0)
        paid = get_amount_paid(inv)
        due = compute_amount_due(amount_ttc, paid)
        event_date = invoice_event_date(inv)
        paid_date = invoice_paid_date(inv) if paid > 0 else None
        client_id = inv.get("clientId")

        if in_window(event_date, window.start, window.end):
            bk = bucket_key(event_date, window.granularity, window.timezone)
            if bk in financial:
                financial[bk]["billed"] += amount_ttc
                commercial[bk]["invoicesCreated"] += 1
                if due > 0 and status in {"in_progress", "overdue"}:
                    financial[bk]["outstanding"] += due
                if client_id:
                    active_sets[bk].add(client_id)

        if paid > 0 and in_window(paid_date, window.start, window.end):
            bk = bucket_key(paid_date, window.granularity, window.timezone)
            if bk in financial:
                financial[bk]["collected"] += paid
                commercial[bk]["invoicesPaid"] += 1
                if client_id:
                    active_sets[bk].add(client_id)

    for quote in quotes:
        created = quote_event_date(quote)
        if not in_window(created, window.start, window.end):
            continue
        bk = bucket_key(created, window.granularity, window.timezone)
        if bk not in commercial:
            continue
        commercial[bk]["quotesCreated"] += 1
        if quote.get("status") == "accepted":
            commercial[bk]["quotesAccepted"] += 1
        if quote.get("clientId"):
            active_sets[bk].add(quote["clientId"])

    for client in clients:
        created = client_created_at(client)
        if in_window(created, window.start, window.end):
            bk = bucket_key(created, window.granularity, window.timezone)
            if bk in client_series:
                client_series[bk]["newClients"] += 1

    for bk, ids in active_sets.items():
        client_series[bk]["activeClients"] = len(ids)

    def to_points(mapping: Dict[str, Dict[str, float]]) -> List[dict]:
        points = []
        for key in keys:
            points.append({"key": key, "label": key, "values": mapping[key]})
        return points

    return to_points(financial), to_points(commercial), to_points(client_series)


def build_top_clients(
    metrics: Dict[str, Any],
    *,
    sort: str = "collected",
    limit: int = TOP_CLIENTS_LIMIT,
) -> List[dict]:
    clients_by_id: Dict[str, dict] = metrics["clientsById"]
    ids = set(metrics["clientCollected"]) | set(metrics["clientBilled"]) | set(metrics["clientQuotes"]) | set(
        metrics["clientInvoices"]
    )
    rows = []
    for client_id in ids:
        client = clients_by_id.get(client_id) or {}
        rows.append(
            {
                "clientId": client_id,
                "clientName": _client_display_name(client) if client else client_id,
                "collected": int(metrics["clientCollected"].get(client_id, 0)),
                "billed": int(metrics["clientBilled"].get(client_id, 0)),
                "quoteCount": int(metrics["clientQuotes"].get(client_id, 0)),
                "invoiceCount": int(metrics["clientInvoices"].get(client_id, 0)),
                "lastActivityAt": client.get("lastActivityAt") or client.get("updatedAt"),
            }
        )

    sort_key = {
        "collected": lambda r: (r["collected"], r["billed"]),
        "billed": lambda r: (r["billed"], r["collected"]),
        "invoices": lambda r: (r["invoiceCount"], r["collected"]),
        "activity": lambda r: (r["lastActivityAt"] or "", r["collected"]),
    }.get(sort, lambda r: (r["collected"], r["billed"]))

    reverse = sort != "activity"
    rows.sort(key=sort_key, reverse=True if reverse else False)
    if sort == "activity":
        rows.sort(key=lambda r: r["lastActivityAt"] or "", reverse=True)
    return rows[:limit]


def build_revenue_breakdown(metrics: Dict[str, Any]) -> List[dict]:
    items = [
        {"key": cid, "label": _client_display_name(metrics["clientsById"].get(cid) or {"name": cid}), "amount": amount}
        for cid, amount in metrics["clientCollected"].items()
        if amount > 0
    ]
    items.sort(key=lambda x: x["amount"], reverse=True)
    total = sum(i["amount"] for i in items) or 1
    top = items[:BREAKDOWN_LIMIT]
    rest = items[BREAKDOWN_LIMIT:]
    result = [
        {
            **item,
            "sharePercent": round(item["amount"] / total * 1000) / 10,
        }
        for item in top
    ]
    if rest:
        other_amount = sum(i["amount"] for i in rest)
        result.append(
            {
                "key": "other",
                "label": "Autres",
                "amount": other_amount,
                "sharePercent": round(other_amount / total * 1000) / 10,
            }
        )
    return result


def build_client_stats(metrics: Dict[str, Any], clients: List[dict], window: PeriodWindow) -> Dict[str, Any]:
    revenue_ids = metrics["revenueClientIds"]
    high_value = 0
    if revenue_ids:
        amounts = [metrics["clientCollected"].get(cid, 0) for cid in revenue_ids]
        threshold = sorted(amounts, reverse=True)[max(0, min(len(amounts) // 5, len(amounts) - 1))] if amounts else 0
        high_value = sum(1 for a in amounts if a >= threshold and a > 0)

    inactive = 0
    cutoff = window.end
    for client in clients:
        last = parse_stored_datetime(client.get("lastActivityAt") or client.get("updatedAt") or client.get("createdAt"))
        if last is None:
            inactive += 1
            continue
        if (cutoff - last).days >= INACTIVE_DAYS:
            inactive += 1

    top_share = None
    collected = metrics["collected"]
    if collected > 0:
        top3 = sum(r["collected"] for r in build_top_clients(metrics, limit=3))
        top_share = round(top3 / collected * 1000) / 10

    avg = int(collected / len(revenue_ids)) if revenue_ids else 0
    return {
        "newClients": metrics["newClients"],
        "revenueClients": len(revenue_ids),
        "inactiveClients": inactive,
        "highValueClients": high_value,
        "averageRevenuePerClient": avg,
        "topSharePercent": top_share,
    }
