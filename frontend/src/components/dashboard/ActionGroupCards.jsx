import { useState } from "react";
import { FileText, Receipt, User, UserX, Loader2, ChevronRight, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { groupReminders } from "@/utils/reminderGroups";
import {
  formatReminderDate,
  getReminderPriorityStyle,
} from "@/utils/reminderDisplay";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GROUP_ICONS = {
  file: Upload,
  receipt: Receipt,
  quote: FileText,
  user: User,
  userInactive: UserX,
};

const GROUP_STYLES = {
  critical: "border-[var(--dash-danger-border)] bg-[var(--dash-danger-bg)] hover:brightness-110",
  high: "border-[var(--dash-danger-border)] bg-[var(--dash-danger-bg)] hover:brightness-110",
  medium: "border-[var(--dash-warning-border)] bg-[var(--dash-warning-bg)] hover:brightness-110",
  low: "border-dash-border bg-dash-surface-muted hover:bg-dash-surface-elevated",
};

export default function ActionGroupCards({ reminders, loading, error }) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();
  const [openGroup, setOpenGroup] = useState(null);

  const groups = groupReminders(reminders);

  const handleOpenGroup = (group) => {
    if (group.count === 1 && group.items[0]?.link) {
      navigate(group.items[0].link);
      return;
    }
    setOpenGroup(group);
  };

  const handleOpenReminder = (link) => {
    if (link) {
      setOpenGroup(null);
      navigate(link);
    }
  };

  return (
    <>
      <section
        id="dashboard-actions"
        data-testid="priority-actions-section"
        className="space-y-3"
      >
        {loading ? (
          <div className="flex items-center justify-center py-8 text-dash-text-muted">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-[#991B1B] py-4">{error}</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-dash-text-muted py-2">{t("dashboardV2.priority.empty")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {groups.map((group) => {
              const Icon = GROUP_ICONS[group.icon] || FileText;
              const cardStyle = GROUP_STYLES[group.priority] || GROUP_STYLES.medium;
              const label = t(group.labelKey).replace("{count}", String(group.count));

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleOpenGroup(group)}
                  data-testid={`action-group-${group.id}`}
                  className={[
                    "w-full flex items-center gap-3 p-4 rounded-xl border transition-colors text-left",
                    cardStyle,
                  ].join(" ")}
                >
                  <div className="w-10 h-10 rounded-lg bg-dash-surface/70 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-dash-text" strokeWidth={1.75} />
                  </div>
                  <span className="flex-1 text-[15px] font-semibold text-dash-text leading-snug">
                    {label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-dash-text-subtle shrink-0" strokeWidth={2} />
                </button>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={!!openGroup} onOpenChange={(open) => !open && setOpenGroup(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col bg-[var(--dash-modal-bg,#FFFFFF)] backdrop-blur-none">
          {openGroup && (
            <>
              <DialogHeader>
                <DialogTitle className="font-cabinet text-lg">
                  {t(openGroup.labelKey).replace("{count}", String(openGroup.count))}
                </DialogTitle>
              </DialogHeader>
              <ul className="overflow-y-auto space-y-2 -mx-1 px-1">
                {openGroup.items.map((reminder) => {
                  const style = getReminderPriorityStyle(reminder.priority);
                  return (
                    <li key={reminder.id}>
                      <button
                        type="button"
                        onClick={() => handleOpenReminder(reminder.link)}
                        disabled={!reminder.link}
                        data-testid={`priority-reminder-${reminder.id}`}
                        className={[
                          "w-full flex items-start gap-2 p-3 rounded-lg border transition-colors text-left",
                          style.border,
                          reminder.link ? "cursor-pointer hover:bg-dash-surface-muted" : "cursor-default",
                        ].join(" ")}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-dash-text truncate">
                            {reminder.title}
                          </p>
                          <p className="text-[11px] text-dash-text-muted mt-0.5">
                            {formatReminderDate(reminder.date, lang)}
                          </p>
                        </div>
                        {reminder.link && (
                          <ChevronRight className="w-4 h-4 text-dash-text-subtle shrink-0 mt-0.5" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {openGroup.link && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenGroup(null);
                    navigate(openGroup.link);
                  }}
                  className="text-sm font-medium text-dash-primary hover:text-[#173A5E] pt-2"
                >
                  {t("dashboardV2.actions.viewAll")}
                </button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
