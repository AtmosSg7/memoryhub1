import { ScrollText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import EmptyState from "@/components/dashboard/EmptyState";
import { InlineLoader, PageError } from "@/components/dashboard/PageFeedback";
import {
  getCommunicationCategoryKey,
  getActivityRowData,
} from "@/utils/communicationDisplay";
import { FILTER_PILL_CLASS } from "@/components/dashboard/detailModalLayout";

const ROW_GRID_CLASS =
  "grid grid-cols-1 sm:grid-cols-[minmax(7.5rem,1.1fr)_minmax(0,2fr)_5.5rem_5.5rem] sm:items-center gap-1 sm:gap-3";

export function CommunicationCategoryPills({ value, onChange }) {
  const { t } = useDashboardLang();
  const categories = ["all", "note", "payment", "quote_acceptance", "follow_up", "document_send", "email", "commercial"];

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="communication-filters">
      {categories.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key === "all" ? "" : key)}
          className={[
            FILTER_PILL_CLASS.base,
            "text-xs py-1",
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

export default function CommunicationTimeline({
  items,
  loading,
  error,
  emptyLabel,
  emptyCta,
  onEmptyCta,
  testIdPrefix = "communications",
}) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();

  if (loading) {
    return <InlineLoader label={t("communications.loading")} testId={`${testIdPrefix}-loading`} className="py-6" />;
  }

  if (error) {
    return <PageError message={error} testId={`${testIdPrefix}-error`} />;
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={ScrollText}
        title={t("communications.emptyTitle")}
        description={emptyLabel}
        cta={emptyCta}
        onCta={onEmptyCta}
        testId={`${testIdPrefix}-empty`}
        compact
        inline
      />
    );
  }

  return (
    <div className="overflow-x-auto" data-testid={testIdPrefix}>
      <div
        className={`${ROW_GRID_CLASS} hidden sm:grid px-4 py-2 border-b border-[#F3F4F6] bg-[#FAFAFA] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]`}
        aria-hidden="true"
      >
        <span>{t("communications.col.type")}</span>
        <span>{t("communications.col.client")}</span>
        <span className="text-right">{t("communications.col.amount")}</span>
        <span className="text-right">{t("communications.col.date")}</span>
      </div>

      <ul className="divide-y divide-[#F3F4F6]">
        {items.map((item) => {
          const { typeLabel, clientName, amount, date, route } = getActivityRowData(item, lang, t);
          const Tag = route ? "button" : "div";

          return (
            <li key={item.id} data-testid={`${testIdPrefix}-item-${item.id}`}>
              <Tag
                type={route ? "button" : undefined}
                onClick={route ? () => navigate(route) : undefined}
                className={[
                  ROW_GRID_CLASS,
                  "w-full px-4 py-2.5 text-left transition-colors",
                  route ? "hover:bg-[#FAFAFA] cursor-pointer" : "",
                ].join(" ")}
              >
                <span className="text-[12px] font-medium text-[#374151] truncate">{typeLabel}</span>
                <span className="text-[13px] font-medium text-[#111827] truncate">{clientName}</span>
                <span className="text-[12px] font-semibold text-[#0A2540] tabular-nums sm:text-right">
                  {amount || <span className="text-[#D1D5DB] font-normal">—</span>}
                </span>
                <span className="text-[11px] text-[#9CA3AF] tabular-nums sm:text-right">{date}</span>
              </Tag>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
