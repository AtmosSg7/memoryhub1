import { Loader2 } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";

export default function AiCreditsEstimate({ loading, estimate, error }) {
  const { t } = useDashboardLang();

  if (loading) {
    return (
      <p className="text-sm text-[#6B7280] flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("credits.estimateLoading")}
      </p>
    );
  }

  if (error) {
    return <p className="text-sm text-[#DC2626]">{error}</p>;
  }

  if (!estimate) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 space-y-1">
      <p className="text-sm font-medium text-[#111827]">{t("credits.estimateTitle")}</p>
      <p className="text-sm text-[#4F46E5] font-semibold">{t("credits.estimateValue")}</p>
      <p className="text-xs text-[#6B7280]">
        {t("credits.estimateHint")
          .replace("{tier}", t(`credits.tiers.${estimate.tierKey}`))
          .replace("{pages}", String(estimate.pageCountEstimate ?? "—"))}
      </p>
    </div>
  );
}
