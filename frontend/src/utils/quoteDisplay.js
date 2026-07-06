export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"];

export { getQuoteStatusStyle } from "@/utils/statusDisplay";

export function formatQuoteAmount(cents, lang = "fr") {
  const value = (cents || 0) / 100;
  return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatQuoteDate(dateValue, lang = "fr") {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getQuoteDate(quote) {
  return quote?.quoteDate || quote?.createdAt || "";
}

export function eurosToCents(value) {
  const num = parseFloat(String(value).replace(",", "."));
  if (Number.isNaN(num) || num < 0) return 0;
  return Math.round(num * 100);
}

export function centsToEurosInput(cents) {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

export function toDatetimeLocalValue(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function datetimeLocalToIso(localValue) {
  if (!localValue) return undefined;
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
