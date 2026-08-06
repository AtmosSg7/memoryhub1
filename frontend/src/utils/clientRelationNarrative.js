/**
 * Client-side helpers for relation brief — never invent missing fields.
 */

export function hasActionableSummary(summary) {
  if (!summary) return false;
  return Boolean(
    summary.narrative ||
      summary.aiRelationSummary ||
      summary.latestIntelligenceSummary ||
      summary.openActionsCount > 0 ||
      summary.communicationCount > 0 ||
      summary.activeQuotesCount > 0 ||
      summary.unpaidCount > 0 ||
      summary.overdueInvoicesCount > 0 ||
      summary.totalRevenue > 0 ||
      summary.nextReminder ||
      (summary.topOpenActions && summary.topOpenActions.length)
  );
}

/** Metrics worth showing (hide zeros that are not risks). */
export function buildActionableMetrics(summary, t, formatAmount) {
  if (!summary) return [];
  const metrics = [];

  if (summary.lastExchangeAt) {
    metrics.push({
      key: "lastExchange",
      label: t("timelineV2.summary.lastExchange"),
      valueKey: "lastExchange",
    });
  }
  if (summary.openActionsCount > 0) {
    metrics.push({
      key: "openActions",
      label: t("timelineV2.summary.openActions"),
      value: String(summary.openActionsCount),
    });
  }
  if (summary.activeQuotesCount > 0) {
    metrics.push({
      key: "activeQuotes",
      label: t("clientBrief.metrics.activeQuotes"),
      value: String(summary.activeQuotesCount),
    });
  }
  if (summary.unpaidCount > 0 || summary.overdueInvoicesCount > 0) {
    metrics.push({
      key: "unpaid",
      label: t("timelineV2.summary.unpaid"),
      value: String(summary.unpaidCount || summary.overdueInvoicesCount || 0),
      danger: true,
    });
  }
  if (summary.totalRevenue > 0 && formatAmount) {
    metrics.push({
      key: "revenue",
      label: t("clientBrief.metrics.revenue"),
      value: formatAmount(summary.totalRevenue),
    });
  }
  if (summary.communicationCount > 0) {
    metrics.push({
      key: "comms",
      label: t("clientBrief.metrics.communications"),
      value: String(summary.communicationCount),
    });
  }
  if (summary.nextReminder?.remindAt) {
    metrics.push({
      key: "reminder",
      label: t("clientBrief.metrics.nextReminder"),
      valueKey: "nextReminder",
    });
  }
  return metrics;
}
