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
  "text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF] truncate";

export default function CommercialLineItemsDetail({ document, i18nPrefix = "quoteForm", t, lang }) {
  const label = (key) => t(`${i18nPrefix}.lineItems.${key}`);
  const totalLabel = (key) => t(`${i18nPrefix}.totals.${key}`);
  const lineItems = getValidDocumentLineItems(document);
  const vatAmount = getDocumentVatAmount(document);
  const vatRate = document?.vatRate ?? 0;

  if (lineItems.length === 0) {
    return (
      <div className="rounded-xl border border-[#E7E9EE] bg-[#FAFAFA] divide-y divide-[#E7E9EE] text-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[#6B7280]">{totalLabel("amountHT")}</span>
          <span className="font-semibold text-[#111827] tabular-nums">{formatCommercialAmount(document?.amountHT || 0, lang)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[#6B7280]">{totalLabel("vat")}</span>
          <span className="font-semibold text-[#111827] tabular-nums">
            {vatRate} % ({formatCommercialAmount(vatAmount, lang)})
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-b-xl">
          <span className="font-medium text-[#374151]">{totalLabel("amountTTC")}</span>
          <span className="font-bold text-[#0A2540] tabular-nums">{formatCommercialAmount(document?.amountTTC || 0, lang)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#E7E9EE] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[520px] px-3 py-2 space-y-1">
            <div className={`${ROW_GRID} px-0.5 pb-2 border-b border-[#E7E9EE]`}>
              <span className={HEADER_CLASS}>{label("description")}</span>
              <span className={`${HEADER_CLASS} text-center`}>{label("quantityShort")}</span>
              <span className={`${HEADER_CLASS} text-right`}>{label("unitPriceShort")}</span>
              <span className={`${HEADER_CLASS} text-center`}>{label("vatShort")}</span>
              <span className={`${HEADER_CLASS} text-center`}>{label("discountShort")}</span>
              <span className={`${HEADER_CLASS} text-right`}>{label("lineTotalShort")}</span>
            </div>
            {lineItems.map((line, index) => (
              <div key={`${line.description}-${index}`} className={`${ROW_GRID} py-1.5 border-b border-[#F3F4F6] last:border-0`}>
                <span className="text-sm text-[#111827] truncate">{line.description}</span>
                <span className="text-sm text-[#111827] text-center tabular-nums">{formatLineQuantityDisplay(line.quantity)}</span>
                <span className="text-sm text-[#111827] text-right tabular-nums">{formatCommercialAmount(line.unitPriceHT || 0, lang)}</span>
                <span className="text-sm text-[#111827] text-center tabular-nums">{line.vatRate ?? 0} %</span>
                <span className="text-sm text-[#6B7280] text-center truncate">{formatDiscountDisplay(line.discount, label("noDiscount"))}</span>
                <span className="text-sm font-semibold text-[#111827] text-right tabular-nums">{formatCommercialAmount(line.amountHT || 0, lang)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#E7E9EE] bg-[#FAFAFA] px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#9CA3AF] font-semibold">{totalLabel("amountHT")}</div>
          <div className="font-semibold text-[#111827] tabular-nums">{formatCommercialAmount(document?.amountHT || 0, lang)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#9CA3AF] font-semibold">{totalLabel("vat")}</div>
          <div className="font-semibold text-[#111827] tabular-nums">
            {vatRate} % ({formatCommercialAmount(vatAmount, lang)})
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#9CA3AF] font-semibold">{totalLabel("amountTTC")}</div>
          <div className="font-bold text-[#0A2540] tabular-nums">{formatCommercialAmount(document?.amountTTC || 0, lang)}</div>
        </div>
      </div>
    </div>
  );
}
