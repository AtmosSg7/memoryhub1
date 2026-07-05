import { centsToEurosInput, eurosToCents, formatQuoteAmount } from "@/utils/quoteDisplay";

export const DEFAULT_VAT_RATE = 20;

function parseQuantity(value) {
  const num = parseFloat(String(value ?? "").replace(",", "."));
  if (Number.isNaN(num) || num <= 0) return 1;
  return num;
}

function parseVatRate(value, fallback = DEFAULT_VAT_RATE) {
  const num = parseInt(String(value ?? ""), 10);
  if (Number.isNaN(num)) return fallback;
  return Math.max(0, Math.min(num, 100));
}

function applyDiscount(amountHt, discount) {
  if (!amountHt || !discount) return amountHt;
  const text = String(discount).trim();
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (match) {
    const percent = parseFloat(match[1].replace(",", "."));
    if (percent > 0 && percent <= 100) {
      return Math.max(Math.round((amountHt * (100 - percent)) / 100), 0);
    }
  }
  if (/^\d+$/.test(text)) {
    const percent = parseInt(text, 10);
    if (percent > 0 && percent <= 100) {
      return Math.max(Math.round((amountHt * (100 - percent)) / 100), 0);
    }
  }
  return amountHt;
}

export function createEmptyLineItem(vatRate = DEFAULT_VAT_RATE) {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: "",
    quantity: "1",
    unitPriceHT: "",
    vatRate: String(vatRate),
    discount: "",
  };
}

export function lineItemsFromQuote(quote) {
  return lineItemsFromCommercialDocument(quote, "Devis sans titre");
}

export function lineItemsFromInvoice(invoice) {
  return lineItemsFromCommercialDocument(invoice, "Facture sans titre");
}

function lineItemsFromCommercialDocument(doc, defaultTitle) {
  if (doc?.lineItems?.length) {
    return doc.lineItems.map((line) => ({
      key: `line-${line.description}-${line.unitPriceHT}-${Math.random().toString(36).slice(2, 6)}`,
      description: line.description || "",
      quantity: String(line.quantity ?? 1),
      unitPriceHT: centsToEurosInput(line.unitPriceHT),
      vatRate: String(line.vatRate ?? DEFAULT_VAT_RATE),
      discount: line.discount || "",
    }));
  }
  if (doc?.amountHT > 0) {
    return [
      {
        key: "line-legacy",
        description: doc.title && doc.title !== defaultTitle ? doc.title : "",
        quantity: "1",
        unitPriceHT: centsToEurosInput(doc.amountHT),
        vatRate: String(doc.vatRate ?? DEFAULT_VAT_RATE),
        discount: "",
      },
    ];
  }
  return [createEmptyLineItem()];
}

export function computeLineAmountHT(line) {
  const quantity = parseQuantity(line.quantity);
  const unitPriceHT = eurosToCents(line.unitPriceHT);
  if (unitPriceHT <= 0) return 0;
  return applyDiscount(Math.round(quantity * unitPriceHT), line.discount);
}

export function computeDocumentTotalsFromLines(lines) {
  const fallbackRate = parseVatRate(lines[0]?.vatRate, DEFAULT_VAT_RATE);
  let totalHt = 0;
  let totalTtc = 0;

  for (const line of lines) {
    const amountHt = computeLineAmountHT(line);
    if (amountHt <= 0) continue;
    const rate = parseVatRate(line.vatRate, fallbackRate);
    totalHt += amountHt;
    totalTtc += Math.floor((amountHt * (100 + rate)) / 100);
  }

  if (totalHt <= 0) {
    return { amountHT: 0, vatRate: fallbackRate, amountTTC: 0, vatAmount: 0 };
  }

  const vatAmount = totalTtc - totalHt;
  const effectiveVat = Math.max(0, Math.min(100, Math.round((vatAmount * 100) / totalHt)));
  return { amountHT: totalHt, vatRate: effectiveVat, amountTTC: totalTtc, vatAmount };
}

export function buildLineItemsPayload(lines) {
  return lines
    .map((line) => {
      const amountHT = computeLineAmountHT(line);
      const description = line.description.trim();
      if (!description || amountHT <= 0) return null;
      const quantity = parseQuantity(line.quantity);
      const unitPriceHT = eurosToCents(line.unitPriceHT);
      return {
        description,
        quantity,
        unitPriceHT,
        vatRate: parseVatRate(line.vatRate, DEFAULT_VAT_RATE),
        amountHT,
        discount: line.discount?.trim() || null,
      };
    })
    .filter(Boolean);
}

export function formatCommercialAmount(cents, lang = "fr") {
  return formatQuoteAmount(cents, lang);
}

export function getValidDocumentLineItems(doc) {
  if (!doc?.lineItems?.length) return [];
  return doc.lineItems.filter((line) => line?.description?.trim() && (line.amountHT || 0) > 0);
}

export function getDocumentVatAmount(doc) {
  return Math.max(0, (doc?.amountTTC || 0) - (doc?.amountHT || 0));
}

export function formatLineQuantityDisplay(quantity) {
  const qty = Number(quantity ?? 1);
  if (Number.isNaN(qty) || qty <= 0) return "1";
  if (qty === Math.floor(qty)) return String(Math.floor(qty));
  return String(qty).replace(".", ",");
}

export function formatDiscountDisplay(discount, emptyLabel = "—") {
  const text = String(discount || "").trim();
  return text || emptyLabel;
}
