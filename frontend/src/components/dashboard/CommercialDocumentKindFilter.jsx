import { useDashboardLang } from "@/hooks/useDashboardLang";
import { FILTER_PILL_CLASS } from "@/components/dashboard/detailModalLayout";
import { COMMERCIAL_KINDS } from "@/utils/commercialDocumentsDisplay";

export default function CommercialDocumentKindFilter({ value = "all", onChange }) {
  const { t } = useDashboardLang();

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="commercial-documents-kind-filter">
      {COMMERCIAL_KINDS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={[
            FILTER_PILL_CLASS.base,
            value === key ? FILTER_PILL_CLASS.active : FILTER_PILL_CLASS.inactive,
          ].join(" ")}
          data-testid={`commercial-documents-filter-${key}`}
        >
          {t(`commercialDocuments.filters.${key}`)}
        </button>
      ))}
    </div>
  );
}
