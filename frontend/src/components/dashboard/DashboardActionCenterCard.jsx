import { memo, useMemo, useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import ActionCenter from "@/components/dashboard/ActionCenter";
import {
  actionEngineBannerText,
  groupActionEngineItems,
  mapActionEngineItem,
  sortActionEngineItems,
  summarizeActionPriorities,
} from "@/utils/actionEngineDisplay";

const COMPACT_LIMIT = 6;

function takeLimitedGroups(groups, limit) {
  let remaining = limit;
  const out = [];
  for (const group of groups) {
    if (remaining <= 0) break;
    const items = group.items.slice(0, remaining);
    remaining -= items.length;
    if (items.length) out.push({ key: group.key, items });
  }
  return out;
}

function PriorityPills({ summary, t }) {
  const pills = [
    { key: "urgent", count: summary.urgent, className: "bg-red-50 text-red-700 border-red-100" },
    { key: "high", count: summary.high, className: "bg-amber-50 text-amber-800 border-amber-100" },
    {
      key: "normal",
      count: summary.normal + summary.low,
      className: "bg-dash-surface-muted text-dash-text-muted border-dash-border-soft",
    },
  ].filter((p) => p.count > 0);

  if (!pills.length && summary.overdue < 1) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2" data-testid="action-priority-pills">
      {pills.map((pill) => (
        <span
          key={pill.key}
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${pill.className}`}
        >
          {t(`dashboardV2.engine.breakdown.${pill.key}`).replace("{count}", String(pill.count))}
        </span>
      ))}
      {summary.overdue > 0 ? (
        <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
          {t("dashboardV2.engine.breakdown.overdue").replace("{count}", String(summary.overdue))}
        </span>
      ) : null}
    </div>
  );
}

function DashboardActionCenterCard({
  actions = [],
  loading,
  error,
  onboardingHint = false,
  onChanged,
}) {
  const { t } = useDashboardLang();
  const [expanded, setExpanded] = useState(false);

  const mapped = useMemo(
    () =>
      sortActionEngineItems(
        (actions || []).map((a) => mapActionEngineItem(a, t)).filter(Boolean)
      ),
    [actions, t]
  );

  const summary = useMemo(() => summarizeActionPriorities(mapped), [mapped]);
  const groups = useMemo(() => groupActionEngineItems(mapped), [mapped]);
  const visibleGroups = useMemo(
    () => (expanded ? groups : takeLimitedGroups(groups, COMPACT_LIMIT)),
    [expanded, groups]
  );

  const hiddenCount = Math.max(0, mapped.length - COMPACT_LIMIT);
  const showExpand = mapped.length > COMPACT_LIMIT;

  return (
    <section
      className="rounded-xl border border-dash-border bg-dash-surface p-4 md:p-5 shadow-[0_1px_2px_rgba(10,37,64,0.04)]"
      data-testid="dashboard-action-center-card"
      id="dashboard-actions"
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-dash-surface-muted flex items-center justify-center shrink-0 mt-0.5">
            <ListChecks className="w-4 h-4 text-dash-primary" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h2
              className="font-cabinet text-base md:text-lg font-bold text-dash-text tracking-tight"
              data-testid="action-engine-banner"
            >
              {loading
                ? t("dashboardV2.actionCenter.title")
                : actionEngineBannerText(summary, t)}
            </h2>
            <p className="text-[11px] text-dash-text-muted mt-0.5">
              {t("dashboardV2.actionCenter.subtitle")}
            </p>
            {!loading && !error && mapped.length > 0 ? (
              <PriorityPills summary={summary} t={t} />
            ) : null}
          </div>
        </div>
        {!loading && mapped.length > 0 ? (
          <span
            className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-[var(--dash-nav-active-bg)] text-white text-[11px] font-semibold tabular-nums shrink-0"
            data-testid="action-engine-count-badge"
          >
            {Math.min(mapped.length, 99)}
          </span>
        ) : null}
      </div>

      {onboardingHint && !loading && mapped.length === 0 && !error ? (
        <p
          className="mt-3 text-sm text-dash-text-muted rounded-lg border border-dash-border-soft bg-dash-surface-muted px-3 py-2.5 leading-relaxed"
          data-testid="today-actions-onboarding-hint"
        >
          {t("dashboardV2.today.onboardingHint")}
        </p>
      ) : loading || error || mapped.length === 0 ? (
        <div className="mt-3">
          <ActionCenter
            actions={[]}
            loading={loading}
            error={error}
            limit={COMPACT_LIMIT}
            compact
            testId="action-center"
            onChanged={onChanged}
            emptyTitle={t("dashboardV2.engine.emptyTitle")}
            emptyDescription={t("dashboardV2.engine.emptyDescription")}
          />
        </div>
      ) : (
        <div className="mt-3 space-y-4" data-testid="action-engine-groups">
          {visibleGroups.map((group) => (
            <div key={group.key} data-testid={`action-group-${group.key}`}>
              {groups.length > 1 ? (
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-dash-text-subtle mb-1.5 px-0.5">
                  {t(`dashboardV2.engine.groups.${group.key}`)}
                </h3>
              ) : null}
              <ActionCenter
                actions={group.items}
                loading={false}
                error={null}
                limit={group.items.length}
                compact
                testId={`action-center-${group.key}`}
                onChanged={onChanged}
              />
            </div>
          ))}
        </div>
      )}

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
    </section>
  );
}

export default memo(DashboardActionCenterCard);
