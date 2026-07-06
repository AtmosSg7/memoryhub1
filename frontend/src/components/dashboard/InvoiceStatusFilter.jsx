import { useDashboardLang } from "@/hooks/useDashboardLang";
import { FILTER_PILL_CLASS } from "@/components/dashboard/detailModalLayout";
import { INVOICE_STATUSES } from "@/utils/invoiceDisplay";

export default function InvoiceStatusFilter({ value, onChange, testId = "invoice-status-filter" }) {
  const { t } = useDashboardLang();
  const options = [
    { key: "", label: t("invoices.filter.all") },
    ...INVOICE_STATUSES.map((status) => ({
      key: status,
      label: t(`invoiceStatus.${status}`),
    })),
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" data-testid={testId}>
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key || "all"}
            type="button"
            data-testid={`${testId}-${option.key || "all"}`}
            onClick={() => onChange(option.key)}
            className={[
              FILTER_PILL_CLASS.base,
              active ? FILTER_PILL_CLASS.active : FILTER_PILL_CLASS.inactive,
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
