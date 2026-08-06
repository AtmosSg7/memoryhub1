import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Clock, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";
import ActionPostponeDialog from "@/components/dashboard/ActionPostponeDialog";
import { completeAction, snoozeAction } from "@/lib/actionsApi";
import { formatPostponedUntil } from "@/utils/actionSnoozePresets";
import { formatRelativeDay, formatCardTime } from "@/utils/clientTimelineV2";

/**
 * Up to 3 open actions — complete / postpone / open. No invent.
 */
export default function ClientOpenActionsPanel({
  actions = [],
  totalCount = 0,
  clientId,
  onChanged,
  onSeeAll,
}) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const [postponeId, setPostponeId] = useState(null);

  if (!actions.length) return null;

  const runComplete = async (actionId) => {
    if (busyId) return;
    setBusyId(actionId);
    try {
      await completeAction(actionId);
      toast.success(t("dashboardV2.engine.toastCompleted"));
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || t("dashboardV2.today.actionError"));
    } finally {
      setBusyId(null);
    }
  };

  const runPostpone = async (until) => {
    if (!postponeId || busyId) return;
    const actionId = postponeId;
    setBusyId(actionId);
    try {
      await snoozeAction(actionId, until);
      const dateLabel = formatPostponedUntil(until, lang) || until;
      toast.success(
        t("dashboardV2.engine.toastPostponed").replace("{date}", dateLabel)
      );
      setPostponeId(null);
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || t("dashboardV2.today.actionError"));
    } finally {
      setBusyId(null);
    }
  };

  const openAction = (action) => {
    if (action.communicationId) {
      navigate(`/dashboard/communications?open=${encodeURIComponent(action.communicationId)}`);
      return;
    }
    if (clientId) {
      navigate(`/dashboard/clients/${encodeURIComponent(clientId)}?section=timeline`);
    }
  };

  return (
    <section className="space-y-2" data-testid="client-open-actions">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-dash-text-subtle">
          {t("clientBrief.openActions")}
        </h3>
        {totalCount > actions.length && onSeeAll ? (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-[11px] font-medium text-dash-primary hover:underline"
            data-testid="client-open-actions-see-all"
          >
            {t("clientBrief.seeAllActions").replace("{count}", String(totalCount))}
          </button>
        ) : null}
      </div>
      <ul className="space-y-2">
        {actions.map((action) => {
          const busy = busyId === action.id;
          return (
            <li
              key={action.id}
              className="rounded-xl border border-dash-border-soft bg-dash-surface px-3 py-2.5"
              data-testid={`client-open-action-${action.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <span className="dash-badge dash-badge-info uppercase tracking-wide">
                      {t(`dashboardV2.engine.priority.${action.priority || "normal"}`)}
                    </span>
                    {action.dueAt ? (
                      <span className="text-[10px] text-dash-text-subtle tabular-nums">
                        {formatRelativeDay(action.dueAt, lang)}
                        {` · ${formatCardTime(action.dueAt, lang)}`}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium text-dash-text truncate">{action.title}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ActionButton
                  variant="success"
                  className="min-h-9 gap-1"
                  disabled={Boolean(busyId)}
                  onClick={() => runComplete(action.id)}
                  data-testid={`client-open-action-complete-${action.id}`}
                >
                  <Check className="w-3.5 h-3.5" />
                  {t("dashboardV2.engine.complete")}
                </ActionButton>
                <ActionButton
                  variant="quick"
                  className="min-h-9 gap-1"
                  disabled={Boolean(busyId)}
                  onClick={() => setPostponeId(action.id)}
                  data-testid={`client-open-action-postpone-${action.id}`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {t("dashboardV2.engine.postpone")}
                </ActionButton>
                <ActionButton
                  variant="quick"
                  className="min-h-9 gap-1"
                  disabled={busy}
                  onClick={() => openAction(action)}
                  data-testid={`client-open-action-open-${action.id}`}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  {t("timelineV2.open")}
                </ActionButton>
              </div>
            </li>
          );
        })}
      </ul>

      <ActionPostponeDialog
        open={Boolean(postponeId)}
        onOpenChange={(open) => {
          if (!open && !busyId) setPostponeId(null);
        }}
        onSelectUntil={runPostpone}
        busy={Boolean(busyId)}
        testId="client-open-actions-postpone-dialog"
      />
    </section>
  );
}
