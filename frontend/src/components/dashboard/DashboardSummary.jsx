import { ChevronDown } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { computeDashboardStatus } from "@/utils/reminderGroups";

const STATUS_CONFIG = {
  ok: {
    dot: "🟢",
    messageKey: "dashboardV2.summary.ok",
    bg: "bg-[#ECFDF5] border-[#A7F3D0]",
    text: "text-[#065F46]",
  },
  attention: {
    dot: "🟠",
    messageKey: "dashboardV2.summary.attention",
    bg: "bg-[#FFFBEB] border-[#FDE68A]",
    text: "text-[#92400E]",
  },
  urgent: {
    dot: "🔴",
    messageKey: "dashboardV2.summary.urgent",
    bg: "bg-[#FEF2F2] border-[#FECACA]",
    text: "text-[#991B1B]",
  },
};

export default function DashboardSummary({ reminders, loading }) {
  const { t } = useDashboardLang();

  if (loading) {
    return (
      <div
        data-testid="dashboard-summary"
        className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 md:p-5 animate-pulse h-[72px]"
      />
    );
  }

  const status = computeDashboardStatus(reminders);
  const config = STATUS_CONFIG[status.level];

  const message =
    status.level === "ok"
      ? t(config.messageKey)
      : t(config.messageKey).replace("{count}", String(status.count));

  const scrollToActions = () => {
    document.getElementById("dashboard-actions")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      data-testid="dashboard-summary"
      className={["rounded-xl border p-4 md:p-5 flex items-center justify-between gap-4", config.bg].join(" ")}
    >
      <p className={["text-base md:text-lg font-semibold font-cabinet tracking-tight", config.text].join(" ")}>
        <span className="mr-2" aria-hidden="true">
          {config.dot}
        </span>
        {message}
      </p>
      {status.level !== "ok" && (
        <button
          type="button"
          onClick={scrollToActions}
          data-testid="dashboard-summary-cta"
          className={[
            "shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium",
            "bg-white/80 hover:bg-white border border-black/5 transition-colors",
            config.text,
          ].join(" ")}
        >
          {t("dashboardV2.summary.cta")}
          <ChevronDown className="w-4 h-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
