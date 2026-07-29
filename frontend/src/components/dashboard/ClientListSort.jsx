import { useDashboardLang } from "@/hooks/useDashboardLang";
import { CLIENT_LIST_SORTS } from "@/utils/clientList";

const SORT_OPTIONS = [
  { key: CLIENT_LIST_SORTS.LAST_ACTIVITY, labelKey: "page.clients.sort.lastActivity" },
  { key: CLIENT_LIST_SORTS.REVENUE, labelKey: "page.clients.sort.revenue" },
  { key: CLIENT_LIST_SORTS.NAME, labelKey: "page.clients.sort.name" },
  { key: CLIENT_LIST_SORTS.CREATED_AT, labelKey: "page.clients.sort.createdAt" },
];

export default function ClientListSort({ value, onChange, testId = "clients-sort" }) {
  const { t } = useDashboardLang();

  return (
    <label className="inline-flex items-center gap-2 text-[12px] text-[#6B7280] shrink-0">
      <span className="whitespace-nowrap">{t("page.clients.sort.label")}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        aria-label={t("page.clients.sort.label")}
        className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[12px] font-medium text-[#111827] outline-none focus:border-[#0A2540]/40 focus:ring-2 focus:ring-[#0A2540]/10"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}
