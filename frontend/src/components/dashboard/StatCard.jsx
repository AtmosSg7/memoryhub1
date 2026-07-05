import { ArrowUpRight } from "lucide-react";

export default function StatCard({
  label,
  value,
  trend,
  helper,
  icon: Icon,
  accent = false,
  testId,
}) {
  return (
    <div
      data-testid={testId}
      className={[
        "group relative bg-white border border-[#E5E7EB] rounded-xl p-5 transition-all duration-300",
        "hover:-translate-y-[2px] hover:shadow-[0_8px_24px_-12px_rgba(10,37,64,0.15)] hover:border-[#0A2540]/20",
      ].join(" ")}
    >
      <div className="flex items-start justify-between mb-6">
        <span className="text-[13px] font-medium text-[#4B5563]">{label}</span>
        <div
          className={[
            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
            accent
              ? "bg-[#0A2540] text-white"
              : "bg-[#F3F4F6] text-[#4B5563] group-hover:bg-[#EFF6FF] group-hover:text-[#0A2540]",
          ].join(" ")}
        >
          <Icon className="w-4 h-4" strokeWidth={1.75} />
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-cabinet text-3xl md:text-[34px] font-bold text-[#111827] tracking-tight leading-none">
          {value}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-3 text-xs">
        <span className="inline-flex items-center gap-0.5 text-[#065F46] bg-[#ECFDF5] px-1.5 py-0.5 rounded-md font-semibold">
          <ArrowUpRight className="w-3 h-3" />
          {trend}
        </span>
        <span className="text-[#6B7280]">{helper}</span>
      </div>
    </div>
  );
}
