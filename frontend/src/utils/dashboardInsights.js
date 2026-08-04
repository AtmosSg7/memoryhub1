const URGENT_TYPES = new Set(["invoice_overdue", "automation_follow_up_invoice"]);
const ATTENTION_TYPES = new Set([
  "invoice_unpaid",
  "invoice_due_soon",
  "quote_no_response",
  "quote_expiring_soon",
  "quote_accepted_pending_invoice",
  "quote_viewed_no_response",
  "quote_follow_up_second",
  "quote_follow_up_third",
  "invoice_follow_up_second",
  "invoice_follow_up_third",
  "import_pending",
  "personal_reminder",
]);

export function countRemindersByType(reminders, type) {
  return (reminders || []).filter((item) => item.type === type).length;
}

export function computeDashboardInsights(reminders, options = {}) {
  const list = reminders || [];
  const importsRemaining = options.importsRemaining;

  const counts = {
    invoiceOverdue: countRemindersByType(list, "invoice_overdue"),
    invoiceUnpaid: countRemindersByType(list, "invoice_unpaid"),
    invoiceDueSoon: countRemindersByType(list, "invoice_due_soon"),
    quoteNoResponse: countRemindersByType(list, "quote_no_response"),
    quoteExpiring: countRemindersByType(list, "quote_expiring_soon"),
    quoteAcceptedPendingInvoice: countRemindersByType(list, "quote_accepted_pending_invoice"),
    quoteViewedNoResponse: countRemindersByType(list, "quote_viewed_no_response"),
    quoteFollowUpSecond: countRemindersByType(list, "quote_follow_up_second"),
    quoteFollowUpThird: countRemindersByType(list, "quote_follow_up_third"),
    invoiceFollowUpSecond: countRemindersByType(list, "invoice_follow_up_second"),
    invoiceFollowUpThird: countRemindersByType(list, "invoice_follow_up_third"),
    automationArchiveInvoice: countRemindersByType(list, "automation_archive_invoice"),
    automationFollowUpInvoice: countRemindersByType(list, "automation_follow_up_invoice"),
    importPending: countRemindersByType(list, "import_pending"),
    personalReminders: countRemindersByType(list, "personal_reminder"),
  };

  const cards = [];

  if (counts.invoiceOverdue > 0) {
    cards.push({
      id: "invoice_overdue",
      tone: "urgent",
      count: counts.invoiceOverdue,
      link: "/dashboard/documents?kind=invoice",
    });
  }

  const quotesToFollow =
    counts.quoteNoResponse +
    counts.quoteExpiring +
    counts.quoteAcceptedPendingInvoice +
    counts.quoteViewedNoResponse +
    counts.quoteFollowUpSecond +
    counts.quoteFollowUpThird;
  if (quotesToFollow > 0) {
    cards.push({
      id: "quotes_follow_up",
      tone: counts.quoteNoResponse > 0 ? "attention" : "neutral",
      count: quotesToFollow,
      detailCount: counts.quoteNoResponse,
      link: "/dashboard/documents?kind=quote",
    });
  }

  const invoicesToCollect =
    counts.invoiceUnpaid +
    counts.invoiceDueSoon +
    counts.invoiceFollowUpSecond +
    counts.invoiceFollowUpThird +
    counts.automationFollowUpInvoice;
  if (invoicesToCollect > 0) {
    cards.push({
      id: "invoices_collect",
      tone: "attention",
      count: invoicesToCollect,
      link: "/dashboard/documents?kind=invoice",
    });
  }

  if (counts.personalReminders > 0) {
    cards.push({
      id: "reminders_today",
      tone: "neutral",
      count: counts.personalReminders,
      link: "#dashboard-actions",
    });
  }

  if (counts.automationArchiveInvoice > 0) {
    cards.push({
      id: "invoices_archive",
      tone: "neutral",
      count: counts.automationArchiveInvoice,
      link: "/dashboard/documents?kind=invoice",
    });
  }

  if (counts.quoteViewedNoResponse > 0) {
    cards.push({
      id: "quotes_viewed",
      tone: "attention",
      count: counts.quoteViewedNoResponse,
      link: "/dashboard/documents?kind=quote",
    });
  }

  if (counts.importPending > 0) {
    cards.push({
      id: "imports_pending",
      tone: "attention",
      count: counts.importPending,
      link: "/dashboard/files?import=1",
    });
  }

  if (
    typeof importsRemaining === "number" &&
    importsRemaining >= 0 &&
    importsRemaining <= 3
  ) {
    cards.push({
      id: "imports_low",
      tone: importsRemaining === 0 ? "urgent" : "neutral",
      count: importsRemaining,
      link: "/dashboard/billing",
    });
  }

  const urgentCount = list.filter((item) => URGENT_TYPES.has(item.type)).length;
  const attentionCount = list.filter((item) => ATTENTION_TYPES.has(item.type)).length;

  if (cards.length === 0) {
    cards.push({
      id: "all_clear",
      tone: "ok",
      link: null,
    });
  }

  return {
    cards,
    counts,
    urgentCount,
    attentionCount,
    hasUrgentWork: urgentCount > 0 || attentionCount > 0,
  };
}

export function getInsightMessageKey(card) {
  if (card.id === "all_clear") return "dashboardV2.insights.allClear";
  if (card.id === "invoice_overdue") {
    return card.count === 1
      ? "dashboardV2.insights.invoiceOverdueOne"
      : "dashboardV2.insights.invoiceOverdueMany";
  }
  if (card.id === "quotes_follow_up") {
    if (card.detailCount > 0) {
      return card.detailCount === 1
        ? "dashboardV2.insights.quotesWaitingOne"
        : "dashboardV2.insights.quotesWaitingMany";
    }
    return card.count === 1
      ? "dashboardV2.insights.quotesFollowOne"
      : "dashboardV2.insights.quotesFollowMany";
  }
  if (card.id === "invoices_collect") {
    return card.count === 1
      ? "dashboardV2.insights.invoicesCollectOne"
      : "dashboardV2.insights.invoicesCollectMany";
  }
  if (card.id === "quotes_viewed") {
    return card.count === 1
      ? "dashboardV2.insights.quotesViewedOne"
      : "dashboardV2.insights.quotesViewedMany";
  }
  if (card.id === "invoices_archive") {
    return card.count === 1
      ? "dashboardV2.insights.invoicesArchiveOne"
      : "dashboardV2.insights.invoicesArchiveMany";
  }
  if (card.id === "reminders_today") {
    return card.count === 1
      ? "dashboardV2.insights.remindersTodayOne"
      : "dashboardV2.insights.remindersTodayMany";
  }
  if (card.id === "imports_pending") {
    return card.count === 1
      ? "dashboardV2.insights.importsPendingOne"
      : "dashboardV2.insights.importsPendingMany";
  }
  if (card.id === "imports_low") {
    return card.count === 0
      ? "dashboardV2.insights.importsEmpty"
      : card.count === 1
        ? "dashboardV2.insights.importsLowOne"
        : "dashboardV2.insights.importsLowMany";
  }
  return "dashboardV2.insights.allClear";
}
