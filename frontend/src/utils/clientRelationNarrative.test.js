import {
  buildActionableMetrics,
  hasActionableSummary,
} from "./clientRelationNarrative";

const t = (key) => key;

describe("clientRelationNarrative", () => {
  it("hides empty summaries (no invented brief)", () => {
    expect(hasActionableSummary(null)).toBe(false);
    expect(hasActionableSummary({})).toBe(false);
    expect(
      hasActionableSummary({
        openActionsCount: 0,
        communicationCount: 0,
        unpaidCount: 0,
        totalRevenue: 0,
      })
    ).toBe(false);
  });

  it("shows summary when narrative or risk signals exist", () => {
    expect(hasActionableSummary({ narrative: "Client depuis mars 2025." })).toBe(true);
    expect(hasActionableSummary({ unpaidCount: 2 })).toBe(true);
    expect(hasActionableSummary({ openActionsCount: 1 })).toBe(true);
    expect(
      hasActionableSummary({
        latestIntelligenceSummary: "Demande un devis terrasse.",
      })
    ).toBe(true);
  });

  it("builds only actionable metrics", () => {
    const metrics = buildActionableMetrics(
      {
        lastExchangeAt: "2026-08-04T10:00:00.000Z",
        openActionsCount: 2,
        activeQuotesCount: 1,
        unpaidCount: 1,
        overdueInvoicesCount: 1,
        totalRevenue: 150000,
        communicationCount: 4,
        nextReminder: { remindAt: "2026-08-10T09:00:00.000Z" },
      },
      t,
      (cents) => `${cents}`
    );
    const keys = metrics.map((m) => m.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "lastExchange",
        "openActions",
        "activeQuotes",
        "unpaid",
        "revenue",
        "comms",
        "reminder",
      ])
    );
    expect(metrics.find((m) => m.key === "unpaid").danger).toBe(true);
  });

  it("omits zero vanity KPIs", () => {
    const metrics = buildActionableMetrics(
      {
        openActionsCount: 0,
        activeQuotesCount: 0,
        unpaidCount: 0,
        totalRevenue: 0,
        communicationCount: 0,
      },
      t,
      (cents) => `${cents}`
    );
    expect(metrics).toHaveLength(0);
  });
});
