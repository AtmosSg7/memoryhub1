import { useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computeDocumentTotalsFromLines,
  computeLineAmountHT,
  createEmptyLineItem,
  formatCommercialAmount,
} from "@/utils/commercialDisplay";

const ROW_GRID =
  "grid grid-cols-[minmax(140px,1fr)_52px_72px_44px_60px_76px_28px] gap-1 items-center";

const FIELD_CLASS =
  "h-8 rounded-lg border border-[#E7E9EE] bg-white px-2 text-xs text-[#111827] shadow-none placeholder:text-[#8A8F98] focus-visible:border-[#0A2540] focus-visible:ring-1 focus-visible:ring-[#0A2540]/15";

const HEADER_CLASS =
  "text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF] truncate px-1";

export default function CommercialLineItemsEditor({ lines, onChange, t, lang, i18nPrefix = "quoteForm" }) {
  const totals = computeDocumentTotalsFromLines(lines);
  const descriptionRefs = useRef({});
  const focusKeyRef = useRef(null);
  const label = (key) => t(`${i18nPrefix}.lineItems.${key}`);
  const totalLabel = (key) => t(`${i18nPrefix}.totals.${key}`);

  useEffect(() => {
    const key = focusKeyRef.current;
    if (!key) return;
    const el = descriptionRefs.current[key];
    if (el) {
      el.focus();
      focusKeyRef.current = null;
    }
  }, [lines]);

  const updateLine = (index, patch) => {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const insertLineAfter = (index) => {
    const newLine = createEmptyLineItem();
    focusKeyRef.current = newLine.key;
    onChange([...lines.slice(0, index + 1), newLine, ...lines.slice(index + 1)]);
  };

  const addLine = () => {
    const newLine = createEmptyLineItem();
    focusKeyRef.current = newLine.key;
    onChange([...lines, newLine]);
  };

  const removeLine = (index) => {
    if (lines.length <= 1) {
      const newLine = createEmptyLineItem();
      focusKeyRef.current = newLine.key;
      onChange([newLine]);
      return;
    }
    onChange(lines.filter((_, i) => i !== index));
  };

  const handleEnterKey = (index, event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    insertLineAfter(index);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium text-[#374151]">{label("title")}</Label>
        <Button type="button" variant="outline" size="sm" className="rounded-lg h-7 text-xs px-2" onClick={addLine}>
          <Plus className="w-3 h-3 mr-1" />
          {label("add")}
        </Button>
      </div>

      <div className="rounded-xl border border-[#E7E9EE] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[560px] px-2 py-2 space-y-1">
            <div className={`${ROW_GRID} px-0.5 pb-1 border-b border-[#E7E9EE]`}>
              <span className={HEADER_CLASS}>{label("description")}</span>
              <span className={`${HEADER_CLASS} text-center`}>{label("quantityShort")}</span>
              <span className={`${HEADER_CLASS} text-right`}>{label("unitPriceShort")}</span>
              <span className={`${HEADER_CLASS} text-center`}>{label("vatShort")}</span>
              <span className={`${HEADER_CLASS} text-center`}>{label("discountShort")}</span>
              <span className={`${HEADER_CLASS} text-right`}>{label("lineTotalShort")}</span>
              <span className="sr-only">{label("remove")}</span>
            </div>

            {lines.map((line, index) => (
              <div key={line.key} className={ROW_GRID}>
                <Input
                  ref={(el) => {
                    if (el) descriptionRefs.current[line.key] = el;
                    else delete descriptionRefs.current[line.key];
                  }}
                  className={FIELD_CLASS}
                  value={line.description}
                  onChange={(e) => updateLine(index, { description: e.target.value })}
                  onKeyDown={(e) => handleEnterKey(index, e)}
                  placeholder={label("descriptionPlaceholder")}
                />
                <Input
                  className={`${FIELD_CLASS} text-center px-1`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: e.target.value })}
                  onKeyDown={(e) => handleEnterKey(index, e)}
                />
                <Input
                  className={`${FIELD_CLASS} text-right px-1`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitPriceHT}
                  onChange={(e) => updateLine(index, { unitPriceHT: e.target.value })}
                  onKeyDown={(e) => handleEnterKey(index, e)}
                />
                <Input
                  className={`${FIELD_CLASS} text-center px-1`}
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={line.vatRate}
                  onChange={(e) => updateLine(index, { vatRate: e.target.value })}
                  onKeyDown={(e) => handleEnterKey(index, e)}
                />
                <Input
                  className={`${FIELD_CLASS} text-center px-1`}
                  value={line.discount}
                  onChange={(e) => updateLine(index, { discount: e.target.value })}
                  onKeyDown={(e) => handleEnterKey(index, e)}
                  placeholder="10%"
                />
                <div className="text-right text-xs font-semibold text-[#111827] tabular-nums px-1 truncate">
                  {formatCommercialAmount(computeLineAmountHT(line), lang)}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-[#991B1B] hover:text-[#991B1B] hover:bg-[#FEF2F2]"
                  onClick={() => removeLine(index)}
                  aria-label={label("remove")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#E7E9EE] bg-[#FAFAFA] px-3 py-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#9CA3AF] font-semibold">{totalLabel("amountHT")}</div>
          <div className="font-semibold text-[#111827] tabular-nums">{formatCommercialAmount(totals.amountHT, lang)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#9CA3AF] font-semibold">{totalLabel("vat")}</div>
          <div className="font-semibold text-[#111827] tabular-nums">
            {totals.vatRate} % ({formatCommercialAmount(totals.vatAmount, lang)})
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#9CA3AF] font-semibold">{totalLabel("amountTTC")}</div>
          <div className="font-semibold text-[#0A2540] tabular-nums">{formatCommercialAmount(totals.amountTTC, lang)}</div>
        </div>
      </div>
    </div>
  );
}
