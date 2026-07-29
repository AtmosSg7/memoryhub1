import { Link } from "react-router-dom";
import { Sparkles, Loader2 } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useCredits } from "@/hooks/useCredits";

export default function CreditBalanceBadge({
  className = "",
  linkTo = "/dashboard/billing",
  compact = false,
  showLabel = true,
}) {
  const { t } = useDashboardLang();
  const { totalRemaining, loading } = useCredits();

  const content = (
    <>
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6B7280]" aria-hidden />
      ) : (
        <Sparkles className="w-3.5 h-3.5 text-[#0A2540]" aria-hidden />
      )}
      {showLabel && !compact ? (
        <span className="hidden sm:inline text-[#6B7280]">{t("credits.badgeLabel")}</span>
      ) : null}
      <span className="font-semibold tabular-nums text-[#111827]">
        {loading ? "…" : totalRemaining ?? "—"}
      </span>
      {!compact ? (
        <span className="text-[#9CA3AF] text-[11px]">{t("credits.short")}</span>
      ) : null}
    </>
  );

  const baseClass =
    "inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs transition-colors hover:border-[#0A2540]/20 hover:bg-[#EFF6FF]";

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        className={`${baseClass} ${className}`}
        data-testid="analysis-balance-badge"
        title={t("credits.badgeTitle")}
      >
        {content}
      </Link>
    );
  }

  return (
    <span className={`${baseClass} ${className}`} data-testid="analysis-balance-badge">
      {content}
    </span>
  );
}
