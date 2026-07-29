export const ANALYTICS_PERIOD_KEYS = ["7d", "30d", "3m", "12m", "year", "prev_year", "custom"];

export const DEFAULT_ANALYTICS_PERIOD = "30d";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidAnalyticsPeriod(period) {
  return ANALYTICS_PERIOD_KEYS.includes(period);
}

export function isValidIsoDate(value) {
  if (!value || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime());
}

export function resolveAnalyticsTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && typeof tz === "string") return tz;
  } catch {
    // ignore
  }
  return "Europe/Paris";
}

/**
 * Normalize period params from URL search params.
 * Invalid period → 30d. Custom without valid from/to → 30d.
 */
export function parseAnalyticsPeriodParams(searchParams) {
  const rawPeriod = searchParams?.get?.("period") || searchParams?.period || DEFAULT_ANALYTICS_PERIOD;
  const from = searchParams?.get?.("from") || searchParams?.from || "";
  const to = searchParams?.get?.("to") || searchParams?.to || "";

  let period = isValidAnalyticsPeriod(rawPeriod) ? rawPeriod : DEFAULT_ANALYTICS_PERIOD;

  if (period === "custom") {
    if (!isValidIsoDate(from) || !isValidIsoDate(to) || from > to) {
      return { period: DEFAULT_ANALYTICS_PERIOD, from: "", to: "" };
    }
    return { period, from, to };
  }

  return { period, from: "", to: "" };
}

/**
 * Build URLSearchParams patch for a period change.
 * Preserves unrelated params when `base` is provided.
 */
export function buildAnalyticsPeriodSearchParams(next, base) {
  const params = base instanceof URLSearchParams ? new URLSearchParams(base) : new URLSearchParams(base || "");
  const period = isValidAnalyticsPeriod(next.period) ? next.period : DEFAULT_ANALYTICS_PERIOD;
  params.set("period", period);

  if (period === "custom" && isValidIsoDate(next.from) && isValidIsoDate(next.to)) {
    params.set("from", next.from);
    params.set("to", next.to);
  } else {
    params.delete("from");
    params.delete("to");
  }

  return params;
}
