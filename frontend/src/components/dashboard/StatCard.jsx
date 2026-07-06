import { ArrowUpRight } from "lucide-react";

export default function StatCard({
  label,
  value,
  trend,
  helper,
  icon: Icon,
  accent = false,
  secondary = false,
  muted = false,
  onClick,
  testId,
}) {
  const compact = secondary || muted;
  const interactive = Boolean(onClick);

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
        "group relative rounded-xl transition-all duration-300",
        muted
          ? "bg-[#FAFAFA] border border-[#F3F4F6] p-2.5 md:p-3"
          : secondary
            ? "bg-white border border-[#E5E7EB] p-3 md:p-4"
            : "bg-white border border-[#E5E7EB] p-5 hover:-translate-y-[2px] hover:shadow-[0_8px_24px_-12px_rgba(10,37,64,0.15)] hover:border-[#0A2540]/20",
        interactive ? "cursor-pointer hover:border-[#0A2540]/20" : "",
      ].join(" ")}
    >
      <div className={["flex items-center justify-between gap-2", muted ? "mb-1" : compact ? "mb-2" : "mb-6"].join(" ")}>
        <span
          className={[
            "font-medium truncate",
            muted ? "text-[10px] text-[#9CA3AF]" : compact ? "text-[11px] text-[#4B5563]" : "text-[13px] text-[#4B5563]",
          ].join(" ")}
        >
          {label}
        </span>
        {!muted && (
          <div
            className={[
              "rounded-lg flex items-center justify-center transition-colors shrink-0",
              compact ? "w-6 h-6" : "w-8 h-8",
              accent
                ? "bg-[#0A2540] text-white"
                : "bg-[#F3F4F6] text-[#4B5563] group-hover:bg-[#EFF6FF] group-hover:text-[#0A2540]",
            ].join(" ")}
          >
            <Icon className={compact ? "w-3 h-3" : "w-4 h-4"} strokeWidth={1.75} />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={[
            "font-cabinet font-bold tracking-tight leading-none",
            muted ? "text-lg text-[#4B5563]" : compact ? "text-xl md:text-2xl text-[#111827]" : "text-3xl md:text-[34px] text-[#111827]",
          ].join(" ")}
        >
          {value}
        </span>
      </div>

      {!compact && (trend || helper) && (
        <div className="flex items-center gap-2 mt-3 text-xs">
          {trend && (
            <span className="inline-flex items-center gap-0.5 text-[#065F46] bg-[#ECFDF5] px-1.5 py-0.5 rounded-md font-semibold">
              <ArrowUpRight className="w-3 h-3" />
              {trend}
            </span>
          )}
          {helper && <span className="text-[#6B7280]">{helper}</span>}
        </div>
      )}
    </div>
  );
}
