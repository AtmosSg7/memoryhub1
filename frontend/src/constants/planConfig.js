/**
 * Public plan catalog — keep in sync with backend/commercial_constants.py
 * Solo ≈ 20 analyses · Pro ≈ 80 · Team ≈ 200 (internal credits unchanged)
 */

export const TRIAL_DAYS = 14;

export const PLAN_CATALOG = [
  { id: "solo", monthlyPriceEur: 19, monthlyAnalyses: 20 },
  { id: "pro", monthlyPriceEur: 49, monthlyAnalyses: 80 },
  { id: "team", monthlyPriceEur: 99, monthlyAnalyses: 200 },
];

export const PLAN_ORDER = PLAN_CATALOG.map((plan) => plan.id);

export function planById(planId) {
  return PLAN_CATALOG.find((plan) => plan.id === planId);
}
