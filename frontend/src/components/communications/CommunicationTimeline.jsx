import { Loader2, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import {
  formatCommunicationAmount,
  getCommunicationCategoryKey,
  getCommunicationChannelKey,
  getCommunicationRoute,
  communicationToEvent,
} from "@/utils/communicationDisplay";
import { formatEventTime, getEventPresentation } from "@/utils/eventDisplay";
import { FILTER_PILL_CLASS } from "@/components/dashboard/detailModalLayout";

const CATEGORY_STYLES = {
  note: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]",
  payment: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  quote_acceptance: "bg-[#EFF6FF] text-[#1E40AF] border-[#DBEAFE]",
  follow_up: "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]",
  document_send: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
  email: "bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]",
  commercial: "bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]",
};

export function CommunicationCategoryPills({ value, onChange }) {
  const { t } = useDashboardLang();
  const categories = ["all", "note", "payment", "quote_acceptance", "follow_up", "document_send", "email", "commercial"];

  return (
    <div className="flex flex-wrap gap-2" data-testid="communication-filters">
      {categories.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key === "all" ? "" : key)}
          className={[
            FILTER_PILL_CLASS.base,
            (value || "") === (key === "all" ? "" : key) ? FILTER_PILL_CLASS.active : FILTER_PILL_CLASS.inactive,
          ].join(" ")}
          data-testid={`communication-filter-${key}`}
        >
          {t(getCommunicationCategoryKey(key))}
        </button>
      ))}
    </div>
  );
}

export default function CommunicationTimeline({ items, loading, error, emptyLabel, testIdPrefix = "communications" }) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-[#6B7280]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-[#991B1B] py-4">{error}</p>;
  }

  if (!items.length) {
    return (
      <p className="text-sm text-[#6B7280] py-8 text-center" data-testid={`${testIdPrefix}-empty`}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="relative space-y-3" data-testid={testIdPrefix}>
      <div className="absolute left-4 top-2 bottom-2 w-px bg-[#F3F4F6]" aria-hidden="true" />
      {items.map((item) => {
        const route = getCommunicationRoute(item);
        const event = communicationToEvent(item);
        const presentation = event ? getEventPresentation(event, lang) : null;
        const amount = formatCommunicationAmount(item, lang) || presentation?.amount;
        const Tag = route ? "button" : "div";
        const categoryStyle = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.commercial;

        return (
          <li key={item.id} className="relative flex gap-3" data-testid={`${testIdPrefix}-item-${item.id}`}>
            <div className="relative z-10 w-8 h-8 rounded-lg flex items-center justify-center border border-[#E5E7EB] bg-white shrink-0">
              {item.category === "email" ? (
                <Mail className="w-4 h-4 text-[#5B21B6]" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-[#0A2540]" />
              )}
            </div>
            <Tag
              type={route ? "button" : undefined}
              onClick={route ? () => navigate(route) : undefined}
              className={[
                "flex-1 min-w-0 rounded-xl border border-[#E7E9EE] bg-white px-4 py-3 text-left",
                route ? "hover:border-[#0A2540]/20 hover:bg-[#FAFAFA] cursor-pointer" : "",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${categoryStyle}`}>
                  {t(getCommunicationCategoryKey(item.category))}
                </span>
                <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">
                  {t(getCommunicationChannelKey(item.channel))}
                </span>
                <span className="ml-auto text-[11px] text-[#9CA3AF] tabular-nums">
                  {formatEventTime(item.occurredAt, lang)}
                </span>
              </div>
              <p className="text-sm font-medium text-[#111827] truncate">
                {presentation ? t(presentation.labelKey) : item.title}
                {item.clientName ? ` · ${item.clientName}` : ""}
              </p>
              {(item.summary || presentation?.subtitle) && (
                <p className="text-xs text-[#6B7280] mt-0.5 truncate">
                  {item.summary || presentation?.subtitle}
                </p>
              )}
              {amount ? (
                <p className="text-xs font-semibold text-[#0A2540] mt-1 tabular-nums">{amount}</p>
              ) : null}
            </Tag>
          </li>
        );
      })}
    </ul>
  );
}
