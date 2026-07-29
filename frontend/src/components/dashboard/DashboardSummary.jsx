import { useDashboardLang } from "@/hooks/useDashboardLang";
import { computeDashboardStatus } from "@/utils/reminderGroups";

const STATUS_CONFIG = {
  ok: {
    dotClass: "bg-emerald-500",
    messageKey: "dashboardV2.summary.ok",
    bg: "bg-[#ECFDF5] border-[#A7F3D0]",
    text: "text-[#065F46]",
  },
  attention: {
    dotClass: "bg-amber-500",
    messageKey: "dashboardV2.summary.attention",
    bg: "bg-[#FFFBEB] border-[#FDE68A]",
    text: "text-[#92400E]",
  },
  urgent: {
    dotClass: "bg-red-500",
    messageKey: "dashboardV2.summary.urgent",
    bg: "bg-[#FEF2F2] border-[#FECACA]",
    text: "text-[#991B1B]",
  },
};

export default function DashboardSummary({
  reminders,
  loading,
  compact = false,
  actionsAdjacent = false,
}) {
  const { t } = useDashboardLang();

  if (loading) {
    return (
      <div
        data-testid="dashboard-summary"
        className={[
          "rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] animate-pulse",
          compact ? "h-12" : "h-[72px]",
        ].join(" ")}
      />
    );
  }

  const status = computeDashboardStatus(reminders);
  const config = STATUS_CONFIG[status.level];

  const message =
    status.level === "ok"
      ? t(config.messageKey)
      : t(config.messageKey).replace("{count}", String(status.count));

  return (
    <div
      data-testid="dashboard-summary"
      role="status"
      aria-live="polite"
      className={[
        "rounded-xl border flex items-center gap-3",
        compact ? "px-4 py-3" : "p-4 md:p-5",
        config.bg,
      ].join(" ")}
    >
      <span
        className={["inline-block w-2.5 h-2.5 rounded-full shrink-0", config.dotClass].join(" ")}
        aria-hidden="true"
      />
      <p
        className={[
          "font-medium font-cabinet tracking-tight",
          compact ? "text-sm md:text-[15px]" : "text-base md:text-lg font-semibold",
          config.text,
        ].join(" ")}
      >
        {message}
      </p>
      {status.level !== "ok" && !actionsAdjacent ? (
        <button
          type="button"
          onClick={() =>
            document.getElementById("dashboard-actions")?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          data-testid="dashboard-summary-cta"
          className={[
            "ml-auto shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-white/80 hover:bg-white border border-black/5 transition-colors",
            config.text,
          ].join(" ")}
        >
          {t("dashboardV2.summary.cta")}
        </button>
      ) : null}
    </div>
  );
}
