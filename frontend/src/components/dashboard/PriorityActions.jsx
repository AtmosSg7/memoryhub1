import { AlertCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import {
  formatReminderDate,
  getReminderPriorityLabelKey,
  getReminderPriorityStyle,
} from "@/utils/reminderDisplay";

const DISPLAY_LIMIT = 10;

export default function PriorityActions({ reminders, loading, error }) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();
  const visible = reminders.slice(0, DISPLAY_LIMIT);

  const handleOpen = (link) => {
    if (link) navigate(link);
  };

  return (
    <section
      data-testid="priority-actions-section"
      className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-6"
    >
      <div className="flex items-start gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] flex items-center justify-center shrink-0">
          <AlertCircle className="w-4 h-4 text-[#991B1B]" strokeWidth={2} />
        </div>
        <div>
          <h3 className="font-cabinet text-lg font-bold text-[#111827] tracking-tight">
            {t("dashboardV2.priority.title")}
          </h3>
          <p className="text-xs text-[#6B7280] mt-0.5">{t("dashboardV2.priority.subtitle")}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-[#6B7280]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : error ? (
        <p className="text-sm text-[#991B1B] py-4">{error}</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-[#6B7280] py-4">{t("dashboardV2.priority.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((reminder) => {
            const style = getReminderPriorityStyle(reminder.priority);
            return (
              <li key={reminder.id}>
                <button
                  type="button"
                  onClick={() => handleOpen(reminder.link)}
                  disabled={!reminder.link}
                  className={[
                    "w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left",
                    style.border,
                    reminder.link ? "cursor-pointer" : "cursor-default",
                  ].join(" ")}
                  data-testid={`priority-reminder-${reminder.id}`}
                >
                  <span
                    className={[
                      "shrink-0 mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border",
                      style.badge,
                    ].join(" ")}
                  >
                    {t(getReminderPriorityLabelKey(reminder.priority))}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-medium text-[#111827]">{reminder.title}</p>
                      <span className="text-[11px] text-[#9CA3AF] shrink-0">
                        {formatReminderDate(reminder.date, lang)}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#4B5563] mt-0.5 leading-snug">
                      {reminder.description}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !error && reminders.length > DISPLAY_LIMIT && (
        <p className="text-xs text-[#6B7280] mt-4 text-center">
          {t("dashboardV2.priority.more").replace("{count}", String(reminders.length - DISPLAY_LIMIT))}
        </p>
      )}
    </section>
  );
}
