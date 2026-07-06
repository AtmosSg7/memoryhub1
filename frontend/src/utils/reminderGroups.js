const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

export const TODAY_ACTION_LIMIT = 5;

export function getTodayActions(reminders, limit = TODAY_ACTION_LIMIT) {
  return [...reminders]
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, limit);
}

export function computeDashboardStatus(reminders) {
  const actions = getTodayActions(reminders);
  if (actions.length === 0) {
    return { level: "ok", count: 0 };
  }

  const urgentCount = reminders.filter(
    (r) => r.priority === "critical" || r.priority === "high"
  ).length;
  if (urgentCount > 0) {
    return { level: "urgent", count: urgentCount };
  }

  return { level: "attention", count: actions.length };
}

export function getReminderIconType(type) {
  if (type.startsWith("invoice")) return "invoice";
  if (type.startsWith("quote")) return "quote";
  return "default";
}
