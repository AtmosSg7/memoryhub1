import {
  formatCommercialAmount,
  formatDiscountDisplay,
  formatLineQuantityDisplay,
  getDocumentVatAmount,
  getValidDocumentLineItems,
} from "@/utils/commercialDisplay";

const ROW_GRID =
  "grid grid-cols-[minmax(120px,1fr)_44px_72px_44px_56px_72px] gap-2 items-center";

const HEADER_CLASS =
  "text-[10px] font-semibold uppercase tracking-wide text-dash-text-subtle truncate";

function LineItemsTotals({ document, vatAmount, vatRate, totalLabel, lang }) {
  return (
    <div className="rounded-xl border border-dash-border bg-dash-surface-muted px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-dash-text-subtle font-semibold">{totalLabel("amountHT")}</div>
        <div className="font-semibold text-dash-text tabular-nums">{formatCommercialAmount(document?.amountHT || 0, lang)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-dash-text-subtle font-semibold">{totalLabel("vat")}</div>
        <div className="font-semibold text-dash-text tabular-nums">
          {vatRate} % ({formatCommercialAmount(vatAmount, lang)})
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-dash-text-subtle font-semibold">{totalLabel("amountTTC")}</div>
        <div className="font-bold text-dash-primary tabular-nums">{formatCommercialAmount(document?.amountTTC || 0, lang)}</div>
      </div>
    </div>
  );
}

function StackedLineItems({ lineItems, label, lang }) {
  return (
    <div className="space-y-2">
      {lineItems.map((line, index) => (
        <div
          key={`${line.description}-${index}`}
          className="rounded-xl border border-dash-border bg-dash-surface px-4 py-3.5"
        >
          <p className="text-sm font-medium text-dash-text leading-snug">{line.description}</p>
          <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <span className="text-dash-text-subtle font-medium uppercase tracking-wide">{label("quantityShort")}</span>
              <p className="text-dash-text font-medium tabular-nums mt-0.5">{formatLineQuantityDisplay(line.quantity)}</p>
            </div>
            <div>
              <span className="text-dash-text-subtle font-medium uppercase tracking-wide">{label("unitPriceShort")}</span>
              <p className="text-dash-text font-medium tabular-nums mt-0.5">{formatCommercialAmount(line.unitPriceHT || 0, lang)}</p>
            </div>
            <div>
              <span className="text-dash-text-subtle font-medium uppercase tracking-wide">{label("vatShort")}</span>
              <p className="text-dash-text font-medium tabular-nums mt-0.5">{line.vatRate ?? 0} %</p>
            </div>
            <div>
              <span className="text-dash-text-subtle font-medium uppercase tracking-wide">{label("lineTotalShort")}</span>
              <p className="text-dash-primary font-semibold tabular-nums mt-0.5">{formatCommercialAmount(line.amountHT || 0, lang)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CommercialLineItemsDetail({
  document,
  i18nPrefix = "quoteForm",
  t,
  lang,
  variant = "table",
}) {
  const label = (key) => t(`${i18nPrefix}.lineItems.${key}`);
  const totalLabel = (key) => t(`${i18nPrefix}.totals.${key}`);
  const lineItems = getValidDocumentLineItems(document);
  const vatAmount = getDocumentVatAmount(document);
  const vatRate = document?.vatRate ?? 0;

  if (lineItems.length === 0) {
    return (
      <div className="rounded-xl border border-dash-border bg-dash-surface-muted divide-y divide-[#E7E9EE] text-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-dash-text-muted">{totalLabel("amountHT")}</span>
          <span className="font-semibold text-dash-text tabular-nums">{formatCommercialAmount(document?.amountHT || 0, lang)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-dash-text-muted">{totalLabel("vat")}</span>
          <span className="font-semibold text-dash-text tabular-nums">
            {vatRate} % ({formatCommercialAmount(vatAmount, lang)})
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 bg-dash-surface rounded-b-xl">
          <span className="font-medium text-dash-text-muted">{totalLabel("amountTTC")}</span>
          <span className="font-bold text-dash-primary tabular-nums">{formatCommercialAmount(document?.amountTTC || 0, lang)}</span>
        </div>
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className="space-y-3">
        <StackedLineItems lineItems={lineItems} label={label} lang={lang} />
        <LineItemsTotals
          document={document}
          vatAmount={vatAmount}
          vatRate={vatRate}
          totalLabel={totalLabel}
          lang={lang}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dash-border bg-dash-surface overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[520px] px-3 py-2 space-y-1">
            <div className={`${ROW_GRID} px-0.5 pb-2 border-b border-dash-border`}>
              <span className={HEADER_CLASS}>{label("description")}</span>
              <span className={`${HEADER_CLASS} text-center`}>{label("quantityShort")}</span>
              <span className={`${HEADER_CLASS} text-right`}>{label("unitPriceShort")}</span>
              <span className={`${HEADER_CLASS} text-center`}>{label("vatShort")}</span>
              <span className={`${HEADER_CLASS} text-center`}>{label("discountShort")}</span>
              <span className={`${HEADER_CLASS} text-right`}>{label("lineTotalShort")}</span>
            </div>
            {lineItems.map((line, index) => (
              <div key={`${line.description}-${index}`} className={`${ROW_GRID} py-1.5 border-b border-dash-border-soft last:border-0`}>
                <span className="text-sm text-dash-text truncate">{line.description}</span>
                <span className="text-sm text-dash-text text-center tabular-nums">{formatLineQuantityDisplay(line.quantity)}</span>
                <span className="text-sm text-dash-text text-right tabular-nums">{formatCommercialAmount(line.unitPriceHT || 0, lang)}</span>
                <span className="text-sm text-dash-text text-center tabular-nums">{line.vatRate ?? 0} %</span>
                <span className="text-sm text-dash-text-muted text-center truncate">{formatDiscountDisplay(line.discount, label("noDiscount"))}</span>
                <span className="text-sm font-semibold text-dash-text text-right tabular-nums">{formatCommercialAmount(line.amountHT || 0, lang)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <LineItemsTotals
        document={document}
        vatAmount={vatAmount}
        vatRate={vatRate}
        totalLabel={totalLabel}
        lang={lang}
      />
    </div>
  );
}
