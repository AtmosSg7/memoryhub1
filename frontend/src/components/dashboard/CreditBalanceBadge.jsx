import { Link } from "react-router-dom";
import { Upload, Loader2 } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useBillingSummary } from "@/hooks/useBillingSummary";
import { computeImportUsage } from "@/utils/importUsage";

export default function CreditBalanceBadge({
  className = "",
  linkTo = "/dashboard/billing",
  compact = false,
  showLabel = true,
  planId: planIdProp,
  monthlyRemaining: monthlyRemainingProp,
}) {
  const { t } = useDashboardLang();
  const { view, loading } = useBillingSummary();

  const planId = planIdProp ?? view.usagePlanId ?? "solo";
  const remaining = monthlyRemainingProp ?? view.monthlyAnalysesRemaining;
  const { used, limit } = computeImportUsage({ planId, monthlyRemaining: remaining });

  const content = (
    <>
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-dash-text-muted" aria-hidden />
      ) : (
        <Upload className="w-3.5 h-3.5 text-dash-primary" aria-hidden />
      )}
      {showLabel && !compact ? (
        <span className="hidden sm:inline text-dash-text-muted">{t("imports.label")}</span>
      ) : null}
      <span className="font-semibold tabular-nums text-dash-text" data-testid="import-usage-badge-value">
        {loading
          ? "…"
          : t("imports.usageCompact").replace("{used}", String(used)).replace("{limit}", String(limit))}
      </span>
    </>
  );

  const baseClass =
    "inline-flex items-center gap-1.5 rounded-full border border-dash-border bg-dash-surface px-2.5 py-1 text-xs transition-colors hover:border-dash-primary/20 hover:bg-dash-accent-soft";

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        className={`${baseClass} ${className}`}
        data-testid="import-usage-badge"
        title={t("imports.badgeTitle")}
      >
        {content}
      </Link>
    );
  }

  return (
    <span className={`${baseClass} ${className}`} data-testid="import-usage-badge">
      {content}
    </span>
  );
}
