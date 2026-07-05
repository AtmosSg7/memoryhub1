import { useNavigate } from "react-router-dom";
import { Users, StickyNote, FileText, Receipt, Banknote } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";

const TYPE_CONFIG = {
  client: { icon: Users, color: "text-[#0A2540]", bg: "bg-[#EFF6FF]" },
  note: { icon: StickyNote, color: "text-[#065F46]", bg: "bg-[#ECFDF5]" },
  document: { icon: FileText, color: "text-[#7C2D12]", bg: "bg-[#FFF7ED]" },
  quote: { icon: Receipt, color: "text-[#0A2540]", bg: "bg-[#EFF6FF]" },
  invoice: { icon: Banknote, color: "text-[#065F46]", bg: "bg-[#ECFDF5]" },
};

export default function SearchResultItem({ item, onSelect, compact = false, testId }) {
  const navigate = useNavigate();
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.client;
  const Icon = config.icon;

  const handleClick = () => {
    onSelect?.();
    navigate(item.url);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid={testId}
      className={[
        "w-full flex items-start gap-3 text-left transition-colors hover:bg-[#F9FAFB]",
        compact ? "px-3 py-2.5" : "px-4 py-3",
      ].join(" ")}
    >
      <div
        className={[
          "shrink-0 rounded-lg flex items-center justify-center",
          config.bg,
          compact ? "w-7 h-7" : "w-8 h-8",
        ].join(" ")}
      >
        <Icon className={["w-3.5 h-3.5", config.color].join(" ")} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-[#111827] truncate">{item.title}</div>
        {item.subtitle && (
          <div className="text-[11.5px] text-[#6B7280] truncate mt-0.5">{item.subtitle}</div>
        )}
        {item.matchPreview && !compact && (
          <div className="text-[11.5px] text-[#9CA3AF] line-clamp-2 mt-1 leading-relaxed">
            {item.matchPreview}
          </div>
        )}
      </div>
    </button>
  );
}
