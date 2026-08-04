import { memo, useMemo, useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import ActionCenter from "@/components/dashboard/ActionCenter";

const COMPACT_LIMIT = 4;

function DashboardActionCenterCard({
  actions = [],
  loading,
  error,
  onboardingHint = false,
}) {
  const { t } = useDashboardLang();
  const [expanded, setExpanded] = useState(false);

  const important = useMemo(() => {
    const list = actions || [];
    const critical = list.filter((a) => a.priority === "critical" || a.priority === "high");
    const rest = list.filter((a) => a.priority !== "critical" && a.priority !== "high");
    return [...critical, ...rest];
  }, [actions]);

  const visibleLimit = expanded ? Math.min(important.length, 20) : COMPACT_LIMIT;
  const hiddenCount = Math.max(0, important.length - COMPACT_LIMIT);
  const showExpand = important.length > COMPACT_LIMIT;

  return (
    <section
      className="h-full rounded-xl border border-dash-border bg-dash-surface p-4 md:p-5 shadow-[0_1px_2px_rgba(10,37,64,0.04)]"
      data-testid="dashboard-action-center-card"
      id="dashboard-actions"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-dash-surface-muted flex items-center justify-center shrink-0">
            <ListChecks className="w-3.5 h-3.5 text-dash-primary" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h2 className="font-cabinet text-base md:text-lg font-bold text-dash-text tracking-tight truncate">
              {t("dashboardV2.actionCenter.title")}
            </h2>
            <p className="text-[11px] text-dash-text-muted truncate">
              {t("dashboardV2.actionCenter.subtitle")}
            </p>
          </div>
        </div>
        {!loading && important.length > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-[var(--dash-nav-active-bg)] text-white text-[11px] font-semibold tabular-nums shrink-0">
            {Math.min(important.length, 99)}
          </span>
        ) : null}
      </div>

      {onboardingHint ? (
        <p
          className="text-sm text-dash-text-muted rounded-lg border border-dash-border-soft bg-dash-surface-muted px-3 py-2.5 leading-relaxed"
          data-testid="today-actions-onboarding-hint"
        >
          {t("dashboardV2.today.onboardingHint")}
        </p>
      ) : (
        <>
          <ActionCenter
            actions={important}
            loading={loading}
            error={error}
            limit={visibleLimit}
            compact
            testId="action-center"
          />
          {showExpand && !loading && !error ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-dash-primary hover:bg-dash-bg transition-colors"
              data-testid="action-center-expand"
            >
              {expanded
                ? t("dashboardV2.actionCenter.collapse")
                : t("dashboardV2.actionCenter.expand").replace("{count}", String(hiddenCount))}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

export default memo(DashboardActionCenterCard);
