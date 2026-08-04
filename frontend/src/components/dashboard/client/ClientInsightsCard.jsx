import { useEffect, useState } from "react";
import { getClientIntelligence } from "@/lib/intelligenceApi";
import SectionPanel from "@/components/dashboard/client/SectionPanel";
import { PageLoader } from "@/components/dashboard/PageFeedback";

function formatDays(days, t) {
  if (days == null) return t("intelligence.unknownActivity");
  if (days === 0) return t("intelligence.today");
  if (days === 1) return t("intelligence.yesterday");
  return t("intelligence.daysAgo").replace("{count}", String(days));
}

export default function ClientInsightsCard({ clientId, t }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getClientIntelligence(clientId);
        if (mounted) setData(payload);
      } catch (err) {
        if (mounted) setError(err.message || t("intelligence.clientLoadError"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [clientId, t]);

  if (loading) return <PageLoader />;
  if (error) {
    return (
      <p className="text-sm text-[#991B1B]" data-testid="client-insights-error">
        {error}
      </p>
    );
  }
  if (!data) return null;

  const facts = data.facts || {};
  const insights = data.insights || [];
  const primary = insights[0];

  return (
    <SectionPanel title={t("intelligence.clientCardTitle")} testId="client-insights-card">
      <div className="space-y-3">
        {primary ? (
          <p className="text-base font-semibold text-dash-text" data-testid="client-insights-primary">
            {primary.title}
          </p>
        ) : (
          <p className="text-sm text-dash-text-muted">{t("intelligence.clientNoInsight")}</p>
        )}

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-dash-text-muted">
          <li>
            {t("intelligence.exchangesCount").replace("{count}", String(facts.exchangesTotal ?? 0))}
          </li>
          <li>{formatDays(facts.daysSinceActivity, t)}</li>
          <li>
            {t("intelligence.invoicesCount").replace("{count}", String(facts.invoicesCount ?? 0))}
          </li>
          <li>
            {t("intelligence.quotesCount").replace("{count}", String(facts.quotesCount ?? 0))}
          </li>
        </ul>

        <div className="flex flex-wrap gap-1.5">
          {insights.map((insight) => (
            <span
              key={insight.id}
              className="inline-flex text-[11px] font-medium rounded-md bg-dash-surface-muted text-dash-text-muted px-2 py-1"
              data-testid={`client-insight-chip-${insight.ruleId}`}
            >
              {insight.title}
            </span>
          ))}
        </div>

        <div className="text-xs text-dash-text-muted space-y-1">
          <p>
            Google —{" "}
            {data.integrations?.googleContacts?.connected
              ? t("integrations.shared.statusConnected")
              : t("integrations.shared.statusDisconnected")}
          </p>
          <p>
            Gmail —{" "}
            {data.integrations?.gmail?.connected
              ? t("integrations.shared.statusConnected")
              : t("integrations.shared.statusDisconnected")}
          </p>
          {data.followUpInDays != null ? (
            <p className="font-medium text-dash-primary">
              {t("intelligence.followUpIn").replace("{count}", String(data.followUpInDays))}
            </p>
          ) : null}
        </div>
      </div>
    </SectionPanel>
  );
}
