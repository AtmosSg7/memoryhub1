import { commercialDocumentsPath } from "@/utils/commercialDocumentsPath";

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

export const TODAY_ACTION_LIMIT = 12;

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
  if (type === "import_pending") return "import";
  if (type === "personal_reminder") return "personal";
  if (type.startsWith("invoice")) return "invoice";
  if (type.startsWith("quote")) return "quote";
  return "default";
}

const GROUP_DEFS = [
  {
    id: "money",
    icon: "receipt",
    labelKey: "dashboardV2.actions.groups.money",
    types: ["invoice_overdue", "invoice_unpaid", "invoice_due_soon"],
    link: commercialDocumentsPath({ kind: "invoice" }),
  },
  {
    id: "quotes",
    icon: "quote",
    labelKey: "dashboardV2.actions.groups.quotes",
    types: ["quote_no_response", "quote_expiring_soon", "quote_accepted_pending_invoice"],
    link: commercialDocumentsPath({ kind: "quote" }),
  },
  {
    id: "imports",
    icon: "file",
    labelKey: "dashboardV2.actions.groups.imports",
    types: ["import_pending"],
    link: "/dashboard/files?import=1",
  },
];

export function groupReminders(reminders) {
  const groups = [];

  for (const def of GROUP_DEFS) {
    const items = (reminders || []).filter((reminder) => def.types.includes(reminder.type));
    if (items.length === 0) continue;

    const priority = items.reduce((best, item) => {
      return PRIORITY_RANK[item.priority] < PRIORITY_RANK[best] ? item.priority : best;
    }, items[0].priority);

    groups.push({
      id: def.id,
      icon: def.icon,
      labelKey: def.labelKey,
      count: items.length,
      items,
      priority,
      link: def.link,
    });
  }

  return groups.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}
