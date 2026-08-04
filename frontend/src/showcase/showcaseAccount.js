/**
 * Single source of truth for the homepage product showcase session.
 * Every billing / credits / plan surface must read from here.
 */

export const SHOWCASE_PLAN_ID = "pro";

/** Pro catalog limit — must match PLAN_CATALOG.pro.monthlyImports */
export const SHOWCASE_IMPORTS_LIMIT = 20;

/** Remaining AI imports this month (used = limit - remaining). */
export const SHOWCASE_IMPORTS_REMAINING = 14;

export const SHOWCASE_ACCOUNT = {
  planId: SHOWCASE_PLAN_ID,
  planName: "Pro",
  hasSubscription: true,
  subscriptionStatus: "active",
  trialEndsAt: null,
  currentPeriodEnd: "2026-09-04T00:00:00.000Z",
  cancelAtPeriodEnd: false,
  stripeConfigured: true,
  stripeTestMode: true,
  monthlyAnalysesRemaining: SHOWCASE_IMPORTS_REMAINING,
  monthlyAnalysesAllocated: SHOWCASE_IMPORTS_LIMIT,
  permanentAnalysesRemaining: 0,
  totalAnalysesRemaining: SHOWCASE_IMPORTS_REMAINING,
  availablePlans: ["solo", "pro", "team"],
  actions: {
    canCheckout: false,
    canManage: true,
    canUpgrade: true,
    canDowngrade: true,
    canCancel: true,
    canChangePlan: true,
  },
};

export const SHOWCASE_CREDITS = {
  monthlyAllocated: SHOWCASE_IMPORTS_LIMIT,
  monthlyRemaining: SHOWCASE_IMPORTS_REMAINING,
  purchasedRemaining: 0,
  totalRemaining: SHOWCASE_IMPORTS_REMAINING,
};
