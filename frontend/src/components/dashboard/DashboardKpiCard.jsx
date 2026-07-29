import { memo } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import KpiInfoHint from "@/components/dashboard/KpiInfoHint";

/**
 * Homogeneous KPI card for the dashboard home.
 * Same radius, padding, border, and height across the grid.
 */
function DashboardKpiCard({
  label,
  value,
  helper,
  trend,
  trendTone = "neutral",
  onClick,
  testId,
  infoText,
  infoLabel,
}) {
  const interactive = Boolean(onClick);
  const TrendIcon = typeof trend === "string" && trend.startsWith("-") ? ArrowDownRight : ArrowUpRight;
  const trendClass =
    trendTone === "positive"
      ? "text-[#065F46] bg-[#ECFDF5]"
      : trendTone === "negative"
        ? "text-[#991B1B] bg-[#FEF2F2]"
        : "text-[#4B5563] bg-[#F3F4F6]";

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      data-testid={testId}
      className={[
        "h-full min-h-[108px] rounded-xl border border-[#E5E7EB] bg-white p-4 md:p-5",
        "shadow-[0_1px_2px_rgba(10,37,64,0.04)] transition-colors",
        interactive ? "cursor-pointer hover:border-[#0A2540]/25 hover:bg-[#FAFBFC]" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF] truncate">
          {label}
        </p>
        <KpiInfoHint label={infoLabel || label} text={infoText} testId={testId ? `${testId}-info` : undefined} />
      </div>
      <p className="mt-2.5 font-cabinet text-2xl md:text-[28px] font-bold tracking-tight text-[#111827] tabular-nums leading-none">
        {value}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 min-h-[22px]">
        {trend ? (
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${trendClass}`}
          >
            <TrendIcon className="w-3 h-3" aria-hidden />
            {trend}
          </span>
        ) : null}
        {helper ? <span className="text-xs text-[#6B7280] leading-snug">{helper}</span> : null}
      </div>
    </div>
  );
}

export default memo(DashboardKpiCard);
