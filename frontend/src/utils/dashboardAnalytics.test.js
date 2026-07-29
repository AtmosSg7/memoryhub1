import {
  computeAnalyticsSeries,
  computeCommercialPipeline,
  computeDashboardKpis,
  enrichTopClients,
  formatTrendPercent,
} from "./dashboardAnalytics";

const NOW = new Date("2026-07-28T12:00:00.000Z");

describe("dashboardAnalytics", () => {
  it("computes pipeline counts from quotes and invoices", () => {
    const pipeline = computeCommercialPipeline(
      [
        { status: "draft" },
        { status: "sent" },
        { status: "sent" },
        { status: "accepted" },
        { status: "rejected" },
      ],
      [
        { status: "in_progress" },
        { status: "paid" },
        { status: "paid" },
        { status: "overdue" },
        { status: "cancelled" },
      ]
    );

    expect(pipeline.quotes).toEqual({ draft: 1, sent: 2, accepted: 1, rejected: 1 });
    expect(pipeline.invoices).toEqual({ pending: 1, paid: 2, overdue: 1 });
  });

  it("computes KPI revenue trend and new clients", () => {
    const kpis = computeDashboardKpis({
      statsKpis: {
        clientsTotal: 5,
        pendingQuotes: 2,
        unpaidInvoices: 1,
        quotesTotal: 4,
        invoicesTotal: 3,
        monthlyRevenue: { total: 20000, count: 1 },
      },
      quotes: [{ status: "accepted" }, { status: "sent" }, { status: "accepted" }],
      invoices: [
        { status: "paid", amountPaid: 10000, paidAt: "2026-06-10T00:00:00.000Z", amountTTC: 10000 },
        { status: "paid", amountPaid: 20000, paidAt: "2026-07-05T00:00:00.000Z", amountTTC: 20000 },
        { status: "in_progress", amountPaid: 0, amountTTC: 5000 },
      ],
      clients: [
        { id: "1", createdAt: "2026-07-02T00:00:00.000Z" },
        { id: "2", createdAt: "2026-06-02T00:00:00.000Z" },
      ],
      lang: "fr",
      now: NOW,
    });

    expect(kpis.quotes.accepted).toBe(2);
    expect(kpis.quotes.pending).toBe(2);
    expect(kpis.invoices.paid).toBe(2);
    expect(kpis.invoices.pending).toBe(1);
    expect(kpis.clients.newThisMonth).toBe(1);
    expect(kpis.revenue.trendPercent).toBe(100);
    expect(formatTrendPercent(kpis.revenue.trendPercent)).toBe("+100%");
  });

  it("builds analytics series buckets for 7d", () => {
    const series = computeAnalyticsSeries({
      invoices: [
        {
          status: "paid",
          amountPaid: 5000,
          paidAt: "2026-07-27T10:00:00.000Z",
          createdAt: "2026-07-27T10:00:00.000Z",
          amountTTC: 5000,
        },
      ],
      quotes: [{ status: "sent", createdAt: "2026-07-28T08:00:00.000Z" }],
      clients: [{ id: "c1", createdAt: "2026-07-28T09:00:00.000Z" }],
      period: "7d",
      lang: "fr",
      now: NOW,
    });

    expect(series).toHaveLength(7);
    expect(series[series.length - 2].revenue).toBe(5000);
    expect(series[series.length - 1].quotes).toBe(1);
    expect(series[series.length - 1].clients).toBe(1);
  });

  it("enriches top clients with last contact", () => {
    const enriched = enrichTopClients(
      [{ clientId: "c1", clientName: "Acme", total: 100, quoteCount: 1, invoiceCount: 2 }],
      [{ id: "c1", lastActivityAt: "2026-07-20T00:00:00.000Z" }]
    );
    expect(enriched[0].lastContactAt).toBe("2026-07-20T00:00:00.000Z");
  });
});
