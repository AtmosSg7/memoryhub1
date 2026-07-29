import { formatKpiChangePercent, mapAnalyticsToDashboardHome } from "./mapAnalyticsOverview";

describe("mapAnalyticsOverview", () => {
  it("never fabricates a +100% change from a zero previous", () => {
    expect(formatKpiChangePercent(100, 0)).toBeNull();
    expect(formatKpiChangePercent(null, 10)).toBeNull();
    expect(formatKpiChangePercent(12.4, 100)).toBe("+12%");
    expect(formatKpiChangePercent(-5, 100)).toBe("-5%");
  });

  it("maps analytics payload into dashboard home shapes", () => {
    const mapped = mapAnalyticsToDashboardHome(
      {
        kpis: {
          collectedRevenue: { value: 12000, previous: 10000, changePercent: 20, unit: "currency_cents" },
          paidInvoices: { value: 3, previous: 2, changePercent: 50, unit: "count" },
          newClients: { value: 2, previous: 1, changePercent: 100, unit: "count" },
        },
        quotePipeline: { draft: 1, sent: 2, accepted: 3, rejected: 0, total: 6 },
        invoicePipeline: { pending: 1, paid: 4, overdue: 1, created: 6 },
        financialSeries: [{ key: "2026-07-01", label: "1 juil.", values: { collected: 5000 } }],
        commercialSeries: [
          { key: "2026-07-01", label: "1 juil.", values: { quotesCreated: 2, invoicesCreated: 1 } },
        ],
        clientSeries: [{ key: "2026-07-01", label: "1 juil.", values: { newClients: 1 } }],
        topClients: [
          {
            clientId: "c1",
            clientName: "Atelier Nord",
            collected: 5000,
            billed: 7000,
            quoteCount: 2,
            invoiceCount: 1,
            lastActivityAt: "2026-07-20T10:00:00Z",
          },
        ],
      },
      { lang: "fr", clientsTotal: 12 }
    );

    expect(mapped.kpis.revenue.value).toBe(12000);
    expect(mapped.kpis.revenue.trendPercent).toBe(20);
    expect(mapped.kpis.clients.total).toBe(12);
    expect(mapped.kpis.quotes.pending).toBe(2);
    expect(mapped.pipeline.invoices.overdue).toBe(1);
    expect(mapped.series[0]).toMatchObject({
      key: "2026-07-01",
      quotes: 2,
      invoices: 1,
      clients: 1,
      revenue: 5000,
    });
    expect(mapped.topClients[0]).toMatchObject({
      clientId: "c1",
      total: 5000,
      lastContactAt: "2026-07-20T10:00:00Z",
    });
  });
});
