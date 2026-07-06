import { Loader2, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { formatEventTime } from "@/utils/eventDisplay";

export default function ClientFollowUpList({ items, loading, error, emptyLabel, limit, testIdPrefix = "client-follow-ups" }) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();
  const visible = limit ? items.slice(0, limit) : items;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-[#6B7280]" data-testid={`${testIdPrefix}-loading`}>
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-[#991B1B] py-2">{error}</p>;
  }

  if (!visible.length) {
    return (
      <p className="text-sm text-[#6B7280] py-2" data-testid={`${testIdPrefix}-empty`}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-2" data-testid={testIdPrefix}>
      {visible.map((item) => {
        const route =
          item.entityType === "invoice"
            ? `/dashboard/invoices?open=${item.entityId}`
            : `/dashboard/quotes?open=${item.entityId}`;

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => navigate(route)}
              className="w-full text-left rounded-lg border border-[#FED7AA] bg-[#FFF7ED] px-3 py-2.5 hover:border-[#FDBA74] transition-colors"
              data-testid={`${testIdPrefix}-item-${item.id}`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-[#FED7AA] text-[#C2410C]">
                  <Send className="w-3 h-3" />
                  {t("followUpHistory.badge")}
                </span>
                <span className="text-[11px] font-medium text-[#9A3412]">{item.documentNumber}</span>
                <span className="ml-auto text-[11px] text-[#9CA3AF] tabular-nums">
                  {formatEventTime(item.recordedAt, lang)}
                </span>
              </div>
              {item.subject ? (
                <p className="text-xs font-medium text-[#111827] truncate">{item.subject}</p>
              ) : null}
              {item.excerpt ? (
                <p className="text-xs text-[#6B7280] mt-0.5 truncate">{item.excerpt}</p>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
