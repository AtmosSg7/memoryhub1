/**
 * Public plan catalog — display layer for subscriptions.
 * API plan ids (solo / pro / team) are unchanged for Stripe compatibility.
 */

export const TRIAL_DAYS = 14;

export const PLAN_CATALOG = [
  {
    id: "solo",
    monthlyPriceEur: 4.9,
    monthlyImports: 10,
    clientsLimit: 150,
    documentsLimit: 1000,
    popular: false,
  },
  {
    id: "pro",
    monthlyPriceEur: 9.9,
    monthlyImports: 20,
    clientsLimit: 500,
    documentsLimit: 5000,
    popular: true,
  },
  {
    id: "team",
    monthlyPriceEur: 19.9,
    monthlyImports: 50,
    clientsLimit: 2000,
    documentsLimit: 20000,
    popular: false,
  },
];

export const PLAN_ORDER = PLAN_CATALOG.map((plan) => plan.id);

export function planById(planId) {
  return PLAN_CATALOG.find((plan) => plan.id === planId) || null;
}

export function formatPlanPrice(plan, lang = "fr") {
  if (!plan) return "—";
  const fixed = plan.monthlyPriceEur.toFixed(2);
  return lang === "fr" ? fixed.replace(".", ",") : fixed;
}

export function formatPlanLimit(value, lang = "fr") {
  return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US").format(value);
}

/** Row state for plan comparison cells */
export const COMPARISON_STATE = {
  INCLUDED: "included",
  EXCLUDED: "excluded",
  SOON: "soon",
};

/**
 * Comparison matrix for marketing — labels from translations (pricingComparison.*).
 * Capacity rows read numeric limits from each plan in PLAN_CATALOG.
 */
export const PLAN_COMPARISON_SECTIONS = [
  {
    id: "capacity",
    rows: [
      { id: "clients", kind: "capacity", field: "clientsLimit" },
      { id: "documents", kind: "capacity", field: "documentsLimit" },
      { id: "imports", kind: "capacity", field: "monthlyImports" },
    ],
  },
  {
    id: "essentials",
    rows: [
      { id: "dashboard", kind: "allIncluded" },
      { id: "clientManagement", kind: "allIncluded" },
      { id: "documentsFeature", kind: "allIncluded" },
      { id: "activity", kind: "allIncluded" },
      { id: "search", kind: "allIncluded" },
      {
        id: "mobileApp",
        kind: "matrix",
        values: { solo: "soon", pro: "soon", team: "soon" },
      },
    ],
  },
  {
    id: "integrations",
    rows: [
      {
        id: "googleContacts",
        kind: "matrix",
        values: { solo: "included", pro: "included", team: "included" },
      },
      {
        id: "gmail",
        kind: "matrix",
        values: { solo: "excluded", pro: "included", team: "included" },
      },
      {
        id: "phone",
        kind: "matrix",
        values: { solo: "excluded", pro: "soon", team: "soon" },
      },
      {
        id: "whatsapp",
        kind: "matrix",
        values: { solo: "excluded", pro: "soon", team: "soon" },
      },
    ],
  },
  {
    id: "team",
    rows: [
      {
        id: "individualUse",
        kind: "matrix",
        values: { solo: "included", pro: "included", team: "included" },
      },
      {
        id: "multiUser",
        kind: "matrix",
        values: { solo: "excluded", pro: "excluded", team: "included" },
      },
    ],
  },
];

export function comparisonValueForPlan(row, planId, plan) {
  if (row.kind === "allIncluded") return COMPARISON_STATE.INCLUDED;
  if (row.kind === "capacity") return plan[row.field];
  if (row.kind === "matrix") return row.values[planId];
  return COMPARISON_STATE.EXCLUDED;
}
