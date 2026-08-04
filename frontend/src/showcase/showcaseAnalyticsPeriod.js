/**
 * Shape showcase analytics fixtures per requested period so demo charts update.
 */

const PERIOD_SLICE = {
  "7d": 2,
  "30d": 3,
  "3m": 4,
  "12m": 7,
  year: 7,
  prev_year: 7,
  custom: 4,
};

const PERIOD_FACTOR = {
  "7d": 0.32,
  "30d": 0.55,
  "3m": 0.72,
  "12m": 1,
  year: 1.08,
  prev_year: 0.88,
  custom: 0.6,
};

const PERIOD_META = {
  "7d": { fromDate: "2026-07-28", toDate: "2026-08-04", granularity: "day" },
  "30d": { fromDate: "2026-07-05", toDate: "2026-08-04", granularity: "week" },
  "3m": { fromDate: "2026-05-01", toDate: "2026-08-04", granularity: "month" },
  "12m": { fromDate: "2025-08-01", toDate: "2026-08-04", granularity: "month" },
  year: { fromDate: "2026-01-01", toDate: "2026-08-04", granularity: "month" },
  prev_year: { fromDate: "2025-01-01", toDate: "2025-12-31", granularity: "month" },
  custom: { fromDate: "2026-04-01", toDate: "2026-08-04", granularity: "month" },
};

function scaleNumber(value, factor) {
  if (typeof value !== "number" || Number.isNaN(value)) return value;
  return Math.round(value * factor);
}

function scaleKpi(kpi, factor) {
  if (!kpi || typeof kpi !== "object") return kpi;
  const next = { ...kpi };
  if (typeof next.value === "number") next.value = scaleNumber(next.value, factor);
  if (typeof next.previous === "number") next.previous = scaleNumber(next.previous, factor);
  return next;
}

/**
 * @param {object} analytics Base demo analytics payload
 * @param {string} periodKey Requested period (7d, 30d, 12m, year, …)
 */
export function shapeShowcaseAnalytics(analytics, periodKey = "30d") {
  if (!analytics) return analytics;
  const key = PERIOD_SLICE[periodKey] != null ? periodKey : "30d";
  const take = Math.min(PERIOD_SLICE[key], analytics.financialSeries?.length || 0);
  const factor = PERIOD_FACTOR[key] ?? 1;
  const meta = PERIOD_META[key] || PERIOD_META["30d"];

  const sliceSeries = (series) => (Array.isArray(series) ? series.slice(-Math.max(take, 1)) : series);

  const kpis = {};
  Object.entries(analytics.kpis || {}).forEach(([name, kpi]) => {
    kpis[name] = scaleKpi(kpi, factor);
  });

  const comparison = {};
  Object.entries(analytics.comparison || {}).forEach(([name, value]) => {
    comparison[name] = typeof value === "number" ? Math.round(value * (0.85 + factor * 0.15)) : value;
  });

  return {
    ...analytics,
    empty: false,
    period: {
      key,
      fromDate: meta.fromDate,
      toDate: meta.toDate,
      granularity: meta.granularity,
    },
    kpis,
    comparison,
    financialSeries: sliceSeries(analytics.financialSeries),
    commercialSeries: sliceSeries(analytics.commercialSeries),
    clientSeries: sliceSeries(analytics.clientSeries),
    quotePipeline: analytics.quotePipeline
      ? {
          ...analytics.quotePipeline,
          draft: scaleNumber(analytics.quotePipeline.draft, factor),
          sent: scaleNumber(analytics.quotePipeline.sent, factor),
          accepted: scaleNumber(analytics.quotePipeline.accepted, factor),
          total: scaleNumber(analytics.quotePipeline.total, factor),
        }
      : analytics.quotePipeline,
    invoicePipeline: analytics.invoicePipeline
      ? {
          ...analytics.invoicePipeline,
          pending: scaleNumber(analytics.invoicePipeline.pending, Math.max(factor, 0.4)),
          paid: scaleNumber(analytics.invoicePipeline.paid, factor),
          created: scaleNumber(analytics.invoicePipeline.created, factor),
        }
      : analytics.invoicePipeline,
  };
}
