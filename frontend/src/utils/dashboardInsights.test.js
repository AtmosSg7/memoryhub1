import {
  computeDashboardInsights,
  countRemindersByType,
  getInsightMessageKey,
} from "./dashboardInsights";

describe("dashboardInsights", () => {
  const reminders = [
    { id: "1", type: "invoice_overdue", priority: "critical" },
    { id: "2", type: "invoice_overdue", priority: "critical" },
    { id: "3", type: "quote_no_response", priority: "high" },
    { id: "4", type: "personal_reminder", priority: "medium" },
    { id: "5", type: "import_pending", priority: "medium" },
  ];

  it("counts reminders by type", () => {
    expect(countRemindersByType(reminders, "invoice_overdue")).toBe(2);
    expect(countRemindersByType(reminders, "quote_no_response")).toBe(1);
  });

  it("builds prioritized insight cards", () => {
    const result = computeDashboardInsights(reminders, { importsRemaining: 2 });

    expect(result.cards[0].id).toBe("invoice_overdue");
    expect(result.cards.some((card) => card.id === "quotes_follow_up")).toBe(true);
    expect(result.cards.some((card) => card.id === "reminders_today")).toBe(true);
    expect(result.cards.some((card) => card.id === "imports_pending")).toBe(true);
    expect(result.hasUrgentWork).toBe(true);
  });

  it("shows all clear when nothing needs attention", () => {
    const result = computeDashboardInsights([], { importsRemaining: 10 });

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].id).toBe("all_clear");
    expect(result.hasUrgentWork).toBe(false);
  });

  it("uses plural message keys", () => {
    const card = { id: "invoice_overdue", count: 2 };
    expect(getInsightMessageKey(card)).toBe("dashboardV2.insights.invoiceOverdueMany");
  });

  it("uses singular message keys", () => {
    const card = { id: "quotes_follow_up", count: 1, detailCount: 1 };
    expect(getInsightMessageKey(card)).toBe("dashboardV2.insights.quotesWaitingOne");
  });
});
