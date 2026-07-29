import { useDashboardLang } from "@/hooks/useDashboardLang";
import { FILTER_PILL_CLASS } from "@/components/dashboard/detailModalLayout";
import { CLIENT_LIST_FILTERS } from "@/utils/clientList";

const FILTER_OPTIONS = [
  { key: CLIENT_LIST_FILTERS.ALL, labelKey: "page.clients.filter.all" },
  { key: CLIENT_LIST_FILTERS.FAVORITES, labelKey: "page.clients.filter.favorites" },
  { key: CLIENT_LIST_FILTERS.FOLLOW_UP, labelKey: "page.clients.filter.followUp" },
  { key: CLIENT_LIST_FILTERS.WITH_DOCUMENTS, labelKey: "page.clients.filter.withDocuments" },
  { key: CLIENT_LIST_FILTERS.WITHOUT_DOCUMENTS, labelKey: "page.clients.filter.withoutDocuments" },
];

export default function ClientListFilter({ value, onChange, testId = "clients-filter" }) {
  const { t } = useDashboardLang();

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" data-testid={testId}>
      {FILTER_OPTIONS.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            data-testid={`${testId}-${option.key}`}
            onClick={() => onChange(option.key)}
            className={[
              FILTER_PILL_CLASS.base,
              active ? FILTER_PILL_CLASS.active : FILTER_PILL_CLASS.inactive,
            ].join(" ")}
          >
            {t(option.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
