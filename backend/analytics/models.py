"""CRM Analytics response models."""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

FinancialMetric = Literal["collected", "billed", "outstanding"]
TopClientsSort = Literal["collected", "billed", "invoices", "activity"]


class PeriodMeta(BaseModel):
    key: str
    fromDate: str
    toDate: str
    timezone: str
    granularity: str


class ComparisonPeriodMeta(BaseModel):
    fromDate: str
    toDate: str


class KpiValue(BaseModel):
    value: float
    previous: Optional[float] = None
    changePercent: Optional[float] = None
    unit: Literal["currency_cents", "count", "ratio"] = "count"


class AnalyticsKpis(BaseModel):
    collectedRevenue: KpiValue
    billedRevenue: KpiValue
    outstandingAmount: KpiValue
    newClients: KpiValue
    quotesCreated: KpiValue
    quoteAcceptanceRate: KpiValue
    paidInvoices: KpiValue
    averageBasket: KpiValue


class SeriesPoint(BaseModel):
    key: str
    label: str
    values: Dict[str, float] = Field(default_factory=dict)


class QuotePipelineStats(BaseModel):
    total: int = 0
    draft: int = 0
    sent: int = 0
    accepted: int = 0
    rejected: int = 0
    expired: int = 0
    proposedAmount: int = 0
    acceptedAmount: int = 0
    acceptanceRate: Optional[float] = None
    avgAcceptanceDays: Optional[float] = None


class InvoicePipelineStats(BaseModel):
    created: int = 0
    paid: int = 0
    pending: int = 0
    overdue: int = 0
    billedAmount: int = 0
    collectedAmount: int = 0
    outstandingAmount: int = 0
    avgPaymentDays: Optional[float] = None


class ClientAnalyticsStats(BaseModel):
    newClients: int = 0
    revenueClients: int = 0
    inactiveClients: int = 0
    highValueClients: int = 0
    averageRevenuePerClient: int = 0
    topSharePercent: Optional[float] = None


class TopClientRow(BaseModel):
    clientId: str
    clientName: str
    collected: int = 0
    billed: int = 0
    quoteCount: int = 0
    invoiceCount: int = 0
    lastActivityAt: Optional[str] = None


class RevenueBreakdownItem(BaseModel):
    key: str
    label: str
    amount: int
    sharePercent: float


class ComparisonStats(BaseModel):
    collectedRevenue: Optional[float] = None
    billedRevenue: Optional[float] = None
    newClients: Optional[float] = None
    acceptedQuotes: Optional[float] = None
    paidInvoices: Optional[float] = None


class AnalyticsOverviewResponse(BaseModel):
    period: PeriodMeta
    comparisonPeriod: ComparisonPeriodMeta
    kpis: AnalyticsKpis
    financialSeries: List[SeriesPoint]
    commercialSeries: List[SeriesPoint]
    clientSeries: List[SeriesPoint]
    quotePipeline: QuotePipelineStats
    invoicePipeline: InvoicePipelineStats
    clientStats: ClientAnalyticsStats
    topClients: List[TopClientRow]
    revenueBreakdown: List[RevenueBreakdownItem]
    comparison: ComparisonStats
    fromCache: bool = False
    empty: bool = False
