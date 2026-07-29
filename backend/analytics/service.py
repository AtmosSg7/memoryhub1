"""CRM Analytics service — assemble overview response."""

from __future__ import annotations

from datetime import timedelta
from typing import Optional

from analytics import cache as analytics_cache
from analytics.aggregations import (
    build_client_stats,
    build_revenue_breakdown,
    build_series,
    build_top_clients,
    change_percent,
    compute_window_metrics,
    load_user_docs,
)
from analytics.models import (
    AnalyticsKpis,
    AnalyticsOverviewResponse,
    ClientAnalyticsStats,
    ComparisonPeriodMeta,
    ComparisonStats,
    InvoicePipelineStats,
    KpiValue,
    PeriodMeta,
    QuotePipelineStats,
    RevenueBreakdownItem,
    SeriesPoint,
    TopClientRow,
)
from analytics.periods import PeriodWindow, resolve_period


def _kpi(value: float, previous: Optional[float], unit: str) -> KpiValue:
    prev = previous
    return KpiValue(
        value=value,
        previous=prev,
        changePercent=change_percent(value, prev) if prev is not None else None,
        unit=unit,  # type: ignore[arg-type]
    )


def _series_points(raw: list) -> list[SeriesPoint]:
    return [SeriesPoint(**item) for item in raw]


async def build_analytics_overview(
    db,
    user_id: str,
    *,
    period: str = "30d",
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    timezone_name: Optional[str] = None,
    sort_top: str = "collected",
) -> AnalyticsOverviewResponse:
    cache_parts = (period, from_date or "", to_date or "", timezone_name or "", sort_top)
    cached = analytics_cache.get_cached(user_id, "overview", *cache_parts)
    if cached is not None:
        payload = AnalyticsOverviewResponse(**cached)
        payload.fromCache = True
        return payload

    window = resolve_period(
        period,
        from_date=from_date,
        to_date=to_date,
        timezone_name=timezone_name,
    )

    clients, quotes, invoices = await load_user_docs(db, user_id)
    current = compute_window_metrics(
        clients=clients,
        quotes=quotes,
        invoices=invoices,
        start=window.start,
        end=window.end,
    )
    previous = compute_window_metrics(
        clients=clients,
        quotes=quotes,
        invoices=invoices,
        start=window.comparison_start,
        end=window.comparison_end,
    )

    financial_series, commercial_series, client_series = build_series(
        window=window,
        clients=clients,
        quotes=quotes,
        invoices=invoices,
    )

    top_clients = build_top_clients(current, sort=sort_top)
    breakdown = build_revenue_breakdown(current)
    client_stats = build_client_stats(current, clients, window)

    quote_pipeline = QuotePipelineStats(
        total=current["quotesCreated"],
        draft=current["quoteCounts"]["draft"],
        sent=current["quoteCounts"]["sent"],
        accepted=current["quoteCounts"]["accepted"],
        rejected=current["quoteCounts"]["rejected"],
        expired=current["quoteCounts"]["expired"],
        proposedAmount=current["proposedAmount"],
        acceptedAmount=current["acceptedAmount"],
        acceptanceRate=current["acceptanceRate"],
        avgAcceptanceDays=current["avgAcceptanceDays"],
    )
    # invoicePipeline.outstandingAmount = snapshot (all open before period end)
    # kpis.outstandingAmount = period-scoped (issued inside the window)
    invoice_pipeline = InvoicePipelineStats(
        created=current["invoiceCreated"],
        paid=current["paidInvoices"],
        pending=current["pending"],
        overdue=current["overdue"],
        billedAmount=current["billed"],
        collectedAmount=current["collected"],
        outstandingAmount=current["outstandingSnapshot"],
        avgPaymentDays=current["avgPaymentDays"],
    )

    empty = (
        len(clients) == 0
        and len(quotes) == 0
        and len(invoices) == 0
    )

    cmp_start_label = window.comparison_start.date().isoformat()
    cmp_end_label = (window.comparison_end - timedelta(seconds=1)).date().isoformat()

    response = AnalyticsOverviewResponse(
        period=PeriodMeta(
            key=window.key,
            fromDate=window.label_start,
            toDate=window.label_end,
            timezone=window.timezone,
            granularity=window.granularity,
        ),
        comparisonPeriod=ComparisonPeriodMeta(fromDate=cmp_start_label, toDate=cmp_end_label),
        kpis=AnalyticsKpis(
            collectedRevenue=_kpi(current["collected"], previous["collected"], "currency_cents"),
            billedRevenue=_kpi(current["billed"], previous["billed"], "currency_cents"),
            outstandingAmount=_kpi(current["outstanding"], previous["outstanding"], "currency_cents"),
            newClients=_kpi(current["newClients"], previous["newClients"], "count"),
            quotesCreated=_kpi(current["quotesCreated"], previous["quotesCreated"], "count"),
            quoteAcceptanceRate=_kpi(
                current["acceptanceRate"] if current["acceptanceRate"] is not None else 0,
                previous["acceptanceRate"],
                "ratio",
            ),
            paidInvoices=_kpi(current["paidInvoices"], previous["paidInvoices"], "count"),
            averageBasket=_kpi(current["averageBasket"], previous["averageBasket"], "currency_cents"),
        ),
        financialSeries=_series_points(financial_series),
        commercialSeries=_series_points(commercial_series),
        clientSeries=_series_points(client_series),
        quotePipeline=quote_pipeline,
        invoicePipeline=invoice_pipeline,
        clientStats=ClientAnalyticsStats(**client_stats),
        topClients=[TopClientRow(**row) for row in top_clients],
        revenueBreakdown=[RevenueBreakdownItem(**row) for row in breakdown],
        comparison=ComparisonStats(
            collectedRevenue=change_percent(current["collected"], previous["collected"]),
            billedRevenue=change_percent(current["billed"], previous["billed"]),
            newClients=change_percent(current["newClients"], previous["newClients"]),
            acceptedQuotes=change_percent(current["acceptedQuotes"], previous["acceptedQuotes"]),
            paidInvoices=change_percent(current["paidInvoices"], previous["paidInvoices"]),
        ),
        fromCache=False,
        empty=empty,
    )

    analytics_cache.set_cached(user_id, response.model_dump(), "overview", *cache_parts)
    return response


# re-export for typing convenience
__all__ = ["build_analytics_overview", "PeriodWindow", "resolve_period"]
