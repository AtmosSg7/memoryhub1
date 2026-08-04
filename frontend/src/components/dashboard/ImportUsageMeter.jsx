import { Upload } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { computeImportUsage } from "@/utils/importUsage";

export default function ImportUsageMeter({
  planId,
  monthlyRemaining,
  monthlyAllocated,
  compact = false,
  className = "",
}) {
  const { t } = useDashboardLang();
  const { used, limit } = computeImportUsage({ planId, monthlyRemaining, monthlyAllocated });
  const ratio = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div
      className={[
        compact ? "space-y-2" : "rounded-xl border border-dash-border bg-dash-surface-muted p-4 space-y-3",
        className,
      ].join(" ")}
      data-testid="import-usage-meter"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-dash-primary min-w-0">
          <Upload className="w-4 h-4 shrink-0" />
          <span
            className={[
              "font-semibold uppercase tracking-wide truncate",
              compact ? "text-[10px]" : "text-xs",
            ].join(" ")}
          >
            {t("imports.label")}
          </span>
        </div>
        {!compact ? (
          <span className="text-xs text-dash-text-muted shrink-0">{t("imports.periodMonth")}</span>
        ) : null}
      </div>

      <p
        className={[
          "font-cabinet font-bold text-dash-text tabular-nums",
          compact ? "text-sm" : "text-2xl",
        ].join(" ")}
        data-testid="import-usage-value"
      >
        {t("imports.usage")
          .replace("{used}", String(used))
          .replace("{limit}", String(limit))}
      </p>

      {!compact ? (
        <>
          <div className="h-2 rounded-full bg-dash-border overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--dash-nav-active-bg)] transition-all duration-300"
              style={{ width: `${ratio}%` }}
              data-testid="import-usage-bar"
            />
          </div>
          <p className="text-xs text-dash-text-subtle leading-relaxed">{t("imports.usageHint")}</p>
        </>
      ) : null}
    </div>
  );
}
