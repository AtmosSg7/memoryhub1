import { memo } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatLastInteraction } from "@/utils/clientDisplay";
import { useDashboardLang } from "@/hooks/useDashboardLang";

function LivingRemindersSection({ reminders, t }) {
  const navigate = useNavigate();
  const { lang } = useDashboardLang();
  const items = (reminders || []).slice(0, 6);

  return (
    <section className="space-y-2" data-testid="living-reminders">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-text-subtle">
        {t("livingDashboard.reminders.title")}
      </h2>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-dash-border bg-dash-surface-muted/40 px-4 py-6 text-sm text-dash-text-muted text-center">
          {t("livingDashboard.reminders.empty")}
        </div>
      ) : (
        <ul className="rounded-xl border border-dash-border bg-dash-surface divide-y divide-dash-border-soft overflow-hidden">
          {items.map((item) => {
            const id = item.id || item.personalReminderId || item.reminderId;
            const title = item.title || item.body || item.note || t("livingDashboard.reminders.untitled");
            const when = item.remindAt || item.dueAt || item.createdAt;
            const clientId = item.clientId;
            const rowClass =
              "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors";
            const content = (
              <>
                <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-dash-accent-soft text-dash-primary shrink-0">
                  <Bell className="w-3.5 h-3.5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-dash-text truncate">{title}</span>
                  <span className="block text-[11px] text-dash-text-subtle mt-0.5">
                    {formatLastInteraction(when, lang)}
                  </span>
                </span>
              </>
            );
            return (
              <li key={id || title}>
                {clientId ? (
                  <button
                    type="button"
                    className={`${rowClass} hover:bg-dash-bg`}
                    onClick={() => navigate(`/dashboard/clients/${clientId}`)}
                    data-testid={`living-reminder-${id || "row"}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={rowClass} data-testid={`living-reminder-${id || "row"}`}>
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default memo(LivingRemindersSection);
