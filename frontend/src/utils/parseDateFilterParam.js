/**
 * Validate YYYY-MM-DD URL date params. Invalid values are ignored.
 */
export function parseDateFilterParam(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return "";
  }
  return raw;
}

export function formatDateFilterFr(ymd, lang = "fr") {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(y, m - 1, d));
  } catch {
    return ymd;
  }
}
