import { useDashboardLang } from "@/hooks/useDashboardLang";
import { CLIENT_PANEL_CLASS } from "@/components/dashboard/client/clientDetailLayout";
import ClientOpenActionsPanel from "@/components/dashboard/client/ClientOpenActionsPanel";
import {
  buildActionableMetrics,
  hasActionableSummary,
} from "@/utils/clientRelationNarrative";
import { formatAmountCents, formatRelativeDay } from "@/utils/clientTimelineV2";
import { InlineLoader, PageError } from "@/components/dashboard/PageFeedback";

function Metric({ label, value, danger, testId }) {
  return (
    <div
      className={[
        "min-w-0 rounded-lg border px-3 py-2.5",
        danger
          ? "border-red-100 bg-red-50/60"
          : "border-dash-border-soft bg-dash-surface-muted/50",
      ].join(" ")}
      data-testid={testId}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-dash-text-subtle truncate">
        {label}
      </p>
      <p
        className={[
          "mt-0.5 text-sm font-semibold font-cabinet truncate tabular-nums",
          danger ? "text-red-700" : "text-dash-text",
        ].join(" ")}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

function ContextRow({ label, value, testId }) {
  if (!value) return null;
  return (
    <div className="min-w-0" data-testid={testId}>
      <p className="text-[11px] text-dash-text-subtle">{label}</p>
      <p className="text-sm text-dash-text leading-snug mt-0.5 line-clamp-2">{value}</p>
    </div>
  );
}

/**
 * Intelligent client brief above Timeline V2.
 * Deterministic + optional CI enrichment — never invents.
 */
export default function ClientRelationSummary({
  summary,
  lang = "fr",
  compact = false,
  loading = false,
  error = null,
  clientId,
  onChanged,
  onSeeAllActions,
  showOpenActions = true,
}) {
  const { t } = useDashboardLang();

  if (loading) {
    return (
      <InlineLoader
        label={t("activity.loading")}
        className="py-6"
        testId="client-relation-summary-loading"
      />
    );
  }
  if (error) {
    return <PageError message={error} testId="client-relation-summary-error" />;
  }
  if (!hasActionableSummary(summary)) {
    return null;
  }

  const metrics = buildActionableMetrics(summary, t, (cents) =>
    formatAmountCents(cents, lang)
  ).map((m) => {
    if (m.valueKey === "lastExchange") {
      return {
        ...m,
        value: formatRelativeDay(summary.lastExchangeAt, lang),
      };
    }
    if (m.valueKey === "nextReminder") {
      return {
        ...m,
        value: formatRelativeDay(summary.nextReminder.remindAt, lang),
      };
    }
    return m;
  });

  const contextVisible = [
    summary.primarySubject
      ? {
          key: "subject",
          label: t("clientBrief.context.primarySubject"),
          value: summary.primarySubject,
        }
      : null,
    summary.lastRequestLabel
      ? {
          key: "request",
          label: t("clientBrief.context.lastRequest"),
          value: summary.lastRequestLabel,
        }
      : null,
    summary.lastDocumentLabel
      ? {
          key: "document",
          label: t("clientBrief.context.lastDocument"),
          value: summary.lastDocumentLabel,
        }
      : null,
    summary.recommendedActionTitle
      ? {
          key: "recommended",
          label: t("clientBrief.context.recommended"),
          value: summary.recommendedActionTitle,
        }
      : null,
  ].filter(Boolean);

  const narrative = summary.narrative || null;
  const intelLine = summary.latestIntelligenceSummary || summary.aiLastExchangeSummary || null;
  const relationLine = summary.aiRelationSummary || null;

  return (
    <section
      className={[CLIENT_PANEL_CLASS, compact ? "p-4 md:p-5" : "", "space-y-4"].join(" ")}
      data-testid="client-relation-summary"
    >
      {(narrative || relationLine || intelLine) && (
        <div className="space-y-2" data-testid="client-brief-narrative">
          {narrative ? (
            <p className="text-[15px] sm:text-base text-dash-text leading-relaxed font-medium">
              {narrative}
            </p>
          ) : null}
          {relationLine && relationLine !== narrative ? (
            <p className="text-sm text-dash-text-muted leading-relaxed">{relationLine}</p>
          ) : null}
          {intelLine && intelLine !== narrative ? (
            <p className="text-sm text-dash-text-muted leading-relaxed">
              <span className="text-dash-text-subtle">{t("clientBrief.lastExchangeDetail")}: </span>
              {intelLine}
            </p>
          ) : null}
        </div>
      )}

      {metrics.length ? (
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3"
          data-testid="client-brief-metrics"
        >
          {metrics.map((m) => (
            <Metric
              key={m.key}
              label={m.label}
              value={m.value}
              danger={m.danger}
              testId={`relation-metric-${m.key}`}
            />
          ))}
        </div>
      ) : null}

      {contextVisible.length ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-dash-border-soft"
          data-testid="client-brief-context"
        >
          {contextVisible.map((row) => (
            <ContextRow
              key={row.key}
              label={row.label}
              value={row.value}
              testId={`relation-ctx-${row.key}`}
            />
          ))}
        </div>
      ) : null}

      {showOpenActions && summary.topOpenActions?.length ? (
        <div className="pt-1 border-t border-dash-border-soft">
          <ClientOpenActionsPanel
            actions={summary.topOpenActions}
            totalCount={summary.openActionsCount}
            clientId={clientId}
            onChanged={onChanged}
            onSeeAll={onSeeAllActions}
          />
        </div>
      ) : null}
    </section>
  );
}
