import asyncio
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import get_current_user, get_db
from invoice_payments import compute_amount_due, get_amount_paid
from kpi_definitions import (
    DEFAULT_ANALYTICS_TIMEZONE,
    invoice_paid_date,
    normalize_invoice_status,
    resolve_timezone,
)

dashboard_router = APIRouter(prefix="/dashboard", tags=["dashboard"])

TOP_CLIENT_LIMIT = 5


class MonthlyRevenueStats(BaseModel):
    total: int
    count: int


class TopClientStats(BaseModel):
    clientId: str
    clientName: str
    total: int
    quoteCount: int
    invoiceCount: int


class DashboardKpis(BaseModel):
    clientsTotal: int
    quotesTotal: int
    pendingQuotes: int
    invoicesTotal: int
    unpaidInvoices: int
    monthlyRevenue: MonthlyRevenueStats


class DashboardStatsResponse(BaseModel):
    kpis: DashboardKpis
    topClients: List[TopClientStats]


async def _compute_monthly_revenue(db, user_id: str) -> MonthlyRevenueStats:
    """Collected revenue for the current calendar month (Europe/Paris), same paid-date rule as analytics."""
    tz = resolve_timezone(DEFAULT_ANALYTICS_TIMEZONE)
    now_local = datetime.now(timezone.utc).astimezone(tz)
    month = now_local.month
    year = now_local.year
    total = 0
    count = 0
    query = {"userId": user_id, "status": {"$ne": "cancelled"}}
    projection = {"amountPaid": 1, "amountTTC": 1, "status": 1, "paidAt": 1, "invoiceDate": 1, "createdAt": 1}
    async for doc in db.invoices.find(query, projection):
        paid = get_amount_paid(doc)
        if paid <= 0:
            continue
        paid_dt = invoice_paid_date(doc)
        if not paid_dt:
            continue
        local = paid_dt.astimezone(tz)
        if local.month == month and local.year == year:
            total += paid
            count += 1
    return MonthlyRevenueStats(total=total, count=count)


async def _count_unpaid_invoices(db, user_id: str) -> int:
    """Open unpaid invoice count (snapshot) — matches analytics invoicePipeline pending+overdue."""
    count = 0
    query = {
        "userId": user_id,
        "status": {"$in": ["in_progress", "overdue", "sent", "draft"]},
    }
    projection = {"amountTTC": 1, "amountPaid": 1, "status": 1}
    async for doc in db.invoices.find(query, projection):
        status = normalize_invoice_status(doc.get("status"))
        if status not in {"in_progress", "overdue"}:
            continue
        if compute_amount_due(doc.get("amountTTC", 0), get_amount_paid(doc)) > 0:
            count += 1
    return count


async def _compute_top_clients(db, user_id: str) -> List[TopClientStats]:
    """Top clients by collected revenue (all-time), aligned with analytics collected definition."""
    totals: dict[str, dict] = {}

    quote_pipeline = [
        {"$match": {"userId": user_id}},
        {
            "$group": {
                "_id": "$clientId",
                "clientName": {"$max": "$clientName"},
                "quoteCount": {"$sum": 1},
            }
        },
    ]
    async for row in db.quotes.aggregate(quote_pipeline):
        client_id = row.get("_id") or ""
        if not client_id:
            continue
        totals[client_id] = {
            "clientId": client_id,
            "clientName": row.get("clientName") or "",
            "total": 0,
            "quoteCount": int(row.get("quoteCount") or 0),
            "invoiceCount": 0,
        }

    invoice_cursor = db.invoices.find(
        {"userId": user_id, "status": {"$ne": "cancelled"}},
        {
            "clientId": 1,
            "clientName": 1,
            "amountPaid": 1,
            "amountTTC": 1,
            "status": 1,
        },
    )
    async for doc in invoice_cursor:
        client_id = doc.get("clientId") or ""
        if not client_id:
            continue
        entry = totals.get(client_id) or {
            "clientId": client_id,
            "clientName": doc.get("clientName") or "",
            "total": 0,
            "quoteCount": 0,
            "invoiceCount": 0,
        }
        entry["total"] += get_amount_paid(doc)
        entry["invoiceCount"] += 1
        entry["clientName"] = entry["clientName"] or doc.get("clientName") or ""
        totals[client_id] = entry

    ranked = sorted(totals.values(), key=lambda item: item["total"], reverse=True)
    return [TopClientStats(**item) for item in ranked[:TOP_CLIENT_LIMIT]]


async def build_dashboard_stats(db, user_id: str) -> DashboardStatsResponse:
    user_filter = {"userId": user_id}

    (
        clients_total,
        quotes_total,
        pending_quotes,
        invoices_total,
        unpaid_invoices,
        monthly_revenue,
        top_clients,
    ) = await asyncio.gather(
        db.clients.count_documents(user_filter),
        db.quotes.count_documents(user_filter),
        db.quotes.count_documents({**user_filter, "status": "sent"}),
        db.invoices.count_documents({**user_filter, "status": {"$ne": "cancelled"}}),
        _count_unpaid_invoices(db, user_id),
        _compute_monthly_revenue(db, user_id),
        _compute_top_clients(db, user_id),
    )

    return DashboardStatsResponse(
        kpis=DashboardKpis(
            clientsTotal=clients_total,
            quotesTotal=quotes_total,
            pendingQuotes=pending_quotes,
            invoicesTotal=invoices_total,
            unpaidInvoices=unpaid_invoices,
            monthlyRevenue=monthly_revenue,
        ),
        topClients=top_clients,
    )


@dashboard_router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await build_dashboard_stats(db, current_user["id"])
