import { personalReminderToDashboardAction } from "@/utils/personalReminderDisplay";

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

export function pendingImportToReminder(session, t) {
  const hasErrors = (session.analysis?.errors?.length ?? 0) > 0;
  const fileName = session.file?.name || t("common.document");

  return {
    id: `import_pending:${session.id}`,
    type: "import_pending",
    priority: hasErrors ? "high" : "medium",
    title: hasErrors ? t("dashboardV2.actions.importFix") : t("dashboardV2.actions.importConfirm"),
    description: fileName,
    link: `/dashboard/files?import=${session.id}`,
    date: session.createdAt || session.updatedAt,
    resolved: false,
  };
}

export function mergeDashboardActions(reminders, pendingImports, personalReminders, t, lang = "fr") {
  const importActions = (pendingImports || []).map((session) => pendingImportToReminder(session, t));
  const personalActions = (personalReminders || []).map((item) =>
    personalReminderToDashboardAction(item, t, lang)
  );
  return [...(reminders || []), ...personalActions, ...importActions].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  );
}
