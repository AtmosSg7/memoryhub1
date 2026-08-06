import { FILTER_PILL_CLASS } from "@/components/dashboard/detailModalLayout";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { InlineLoader, PageError } from "@/components/dashboard/PageFeedback";
import EmptyState from "@/components/dashboard/EmptyState";
import ClientRelationSummary from "@/components/dashboard/client/ClientRelationSummary";
import TimelineV2Card from "@/components/dashboard/client/timeline/TimelineV2Card";
import {
  TIMELINE_V2_FILTERS,
  buildTimelineV2Rows,
} from "@/utils/clientTimelineV2";
import { ListChecks } from "lucide-react";

/**
 * Premium Client Timeline V2 — single chronology, filters, relation summary.
 */
export default function ClientTimelineV2({
  items = [],
  summary = null,
  loading,
  error,
  emptyLabel,
  limit,
  compact = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  category = "all",
  onCategoryChange,
  showSummary = true,
  showFilters = true,
  showOpenActions = true,
  clientId,
  onChanged,
  onSeeAllActions,
  testId = "client-timeline-v2",
}) {
  const { t, lang } = useDashboardLang();
  const visible = limit ? (items || []).slice(0, limit) : items || [];
  const rows = buildTimelineV2Rows(visible, lang);

  if (loading && !showSummary) {
    return (
      <InlineLoader
        label={t("activity.loading")}
        testId={`${testId}-loading`}
        className="py-8"
      />
    );
  }

  if (error && !showSummary) {
    return <PageError message={error} testId={`${testId}-error`} />;
  }

  return (
    <div className="space-y-4 sm:space-y-5" data-testid={testId}>
      {showSummary ? (
        <ClientRelationSummary
          summary={summary}
          lang={lang}
          compact={compact}
          loading={loading}
          error={error}
          clientId={clientId}
          onChanged={onChanged}
          onSeeAllActions={onSeeAllActions}
          showOpenActions={showOpenActions}
        />
      ) : null}

      {showFilters && onCategoryChange ? (
        <div
          className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5"
          data-testid={`${testId}-filters`}
        >
          {TIMELINE_V2_FILTERS.map((key) => {
            const active = category === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onCategoryChange(key)}
                className={[
                  FILTER_PILL_CLASS.base,
                  "shrink-0",
                  active ? FILTER_PILL_CLASS.active : FILTER_PILL_CLASS.inactive,
                ].join(" ")}
                data-testid={`${testId}-filter-${key}`}
              >
                {t(`timelineV2.filters.${key}`)}
              </button>
            );
          })}
        </div>
      ) : null}

      {loading && showSummary ? null : !visible.length ? (
        emptyLabel ? (
          <EmptyState
            compact
            inline
            icon={ListChecks}
            title={emptyLabel}
            testId={`${testId}-empty`}
          />
        ) : null
      ) : (
        <ul className={`relative ${compact ? "space-y-2.5" : "space-y-3"}`}>
          <div
            className="absolute left-[17px] top-2 bottom-2 w-px bg-dash-border-soft hidden sm:block"
            aria-hidden="true"
          />
          {rows.map((row) => {
            if (row.kind === "day") {
              return (
                <li
                  key={row.id}
                  className="relative z-10 flex items-center gap-3 py-1"
                  data-testid={`${testId}-day-${row.dayKey}`}
                >
                  <div className="w-9 shrink-0 hidden sm:block" aria-hidden="true" />
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-dash-text-subtle">
                      {row.label}
                    </span>
                    <div className="flex-1 h-px bg-dash-border-soft" />
                  </div>
                </li>
              );
            }
            return (
              <li key={row.id} className="relative flex gap-3 sm:pl-0">
                <div
                  className="relative z-10 w-9 h-9 rounded-full border border-dash-border bg-dash-surface shadow-sm shrink-0 hidden sm:flex items-center justify-center"
                  aria-hidden="true"
                >
                  <span className="w-2 h-2 rounded-full bg-dash-primary/70" />
                </div>
                <div className="min-w-0 flex-1">
                  <TimelineV2Card
                    item={row.item}
                    clientId={clientId}
                    compact={compact}
                    onActionDone={onChanged}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && onLoadMore ? (
        <div className="pt-1 sm:pl-12">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            data-testid={`${testId}-load-more`}
            className="w-full sm:w-auto min-h-11 sm:min-h-0 rounded-lg border border-dash-border bg-dash-surface px-4 py-2.5 text-sm font-medium text-dash-text hover:bg-dash-surface-muted disabled:opacity-50 transition-colors"
          >
            {loadingMore ? t("activity.loading") : t("clientTimeline.loadMore")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
