import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import PageHeader from "@/components/dashboard/PageHeader";
import CreditBalanceBadge from "@/components/dashboard/CreditBalanceBadge";
import EmptyState from "@/components/dashboard/EmptyState";
import { fetchAiUsageHistory } from "@/lib/creditsApi";
import { PageError, PageLoader } from "@/components/dashboard/PageFeedback";
import { LIST_TABLE_CONTAINER_CLASS } from "@/components/dashboard/detailModalLayout";

function formatDate(value, lang) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

export default function AiUsageHistoryPage() {
  const { t, lang } = useDashboardLang();
  usePageTitle("credits.historyTitle");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await fetchAiUsageHistory({ limit: 100 });
      setItems(data.items || []);
    } catch (err) {
      setError(err.message || t("billingPage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6" data-testid="ai-usage-history-page">
      <PageHeader
        title={t("credits.historyTitle")}
        subtitle={t("credits.historySubtitle")}
        testId="ai-history-header"
        trailing={<CreditBalanceBadge linkTo="/dashboard/billing" />}
      />

      <Link
        to="/dashboard/billing"
        className="inline-flex items-center gap-1.5 text-sm text-[#0A2540] hover:underline"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {t("billingPage.manageAccount")}
      </Link>

      {error ? <PageError message={error} testId="ai-history-error" /> : null}

      {loading ? (
        <PageLoader label={t("auth.loading")} testId="ai-history-loading" />
      ) : items.length === 0 ? (
        <EmptyState
          title={t("credits.historyEmpty")}
          compact
          testId="ai-history-empty"
        />
      ) : (
        <div className={LIST_TABLE_CONTAINER_CLASS}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-[#F9FAFB] text-[#6B7280] text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">{t("credits.historyDate")}</th>
                  <th className="text-left px-4 py-3 font-semibold">{t("credits.historyType")}</th>
                  <th className="text-right px-4 py-3 font-semibold">{t("credits.historyAnalyses")}</th>
                  <th className="text-left px-4 py-3 font-semibold">{t("credits.historyStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {items.map((row) => (
                  <tr key={row.id} data-testid="ai-history-row">
                    <td className="px-4 py-3 text-[#111827] whitespace-nowrap">
                      {formatDate(row.createdAt, lang)}
                    </td>
                    <td className="px-4 py-3 text-[#4B5563]">
                      {row.detectedKind || row.documentType || "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-[#111827]">
                      {row.analysesConsumed ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.success ? (
                        <span className="inline-flex items-center gap-1 text-[#059669] text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          {t("credits.historySuccess")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#DC2626] text-xs font-medium">
                          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          {row.errorMessage || t("credits.historyFailed")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
