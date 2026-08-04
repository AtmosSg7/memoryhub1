import { PLAN_CATALOG, planById } from "@/constants/planConfig";

/**
 * Derive monthly AI import usage for display.
 * Uses planConfig limits; remaining count comes from billing/credits API when available.
 */
export function computeImportUsage({ planId, monthlyRemaining, monthlyAllocated } = {}) {
  const plan = planById(planId) || PLAN_CATALOG[0];
  const limit = plan.monthlyImports;

  let remaining = limit;
  if (typeof monthlyRemaining === "number") {
    remaining = Math.max(0, Math.min(limit, monthlyRemaining));
  } else if (typeof monthlyAllocated === "number" && monthlyAllocated > 0) {
    remaining = limit;
  }

  const used = Math.min(limit, Math.max(0, limit - remaining));

  return {
    planId: plan.id,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}
