/**
 * @jest-environment node
 */

const {
  isCurrentOfferPlan,
  resolveBillingSummaryEyebrow,
  resolveBillingSummaryTitle,
  resolveSubscriptionPlanLabel,
} = require("@/lib/billingPresentation");

function t(key) {
  const map = {
    "sidebar.subscription.trial": "Essai gratuit",
    "sidebar.subscription.none": "Aucun abonnement",
    "sidebar.subscription.expiresOn": "Expire le {date}",
    "billingPage.plans.solo": "Starter",
    "billingPage.plans.pro": "Pro",
    "billingPage.currentPlan": "Offre actuelle",
    "billingPage.noSubscription": "Aucun abonnement actif",
    "billingPage.choosePlan": "Choisissez une offre",
    "billingPage.cancelScheduled": "Annulation programmée",
    "billingPage.status.trial": "Essai gratuit",
    "billingPage.status.cancelled": "Annulé",
    "billingPage.status.expired": "Expiré",
    "billingPage.status.active": "Actif",
  };
  return map[key] || key;
}

describe("billingPresentation from /api/billing/me", () => {
  it("trial → Essai gratuit, never Offre actuelle badge", () => {
    const billing = {
      hasSubscription: true,
      planId: "solo",
      subscriptionStatus: "trial",
      cancelAtPeriodEnd: false,
    };
    expect(resolveSubscriptionPlanLabel(billing, t)).toBe("Essai gratuit");
    expect(resolveBillingSummaryEyebrow(billing, t)).toBe("Essai gratuit");
    expect(resolveBillingSummaryTitle(billing, t)).toBe("Essai gratuit");
    expect(isCurrentOfferPlan(billing, "solo")).toBe(false);
  });

  it("active → plan name + Offre actuelle on matching plan", () => {
    const billing = {
      hasSubscription: true,
      planId: "solo",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
    };
    expect(resolveSubscriptionPlanLabel(billing, t)).toBe("Starter");
    expect(resolveBillingSummaryEyebrow(billing, t)).toBe("Offre actuelle");
    expect(resolveBillingSummaryTitle(billing, t)).toBe("Starter");
    expect(isCurrentOfferPlan(billing, "solo")).toBe(true);
    expect(isCurrentOfferPlan(billing, "pro")).toBe(false);
  });

  it("cancelled → Annulé, never Essai gratuit nor Offre actuelle", () => {
    const billing = {
      hasSubscription: true,
      planId: "solo",
      subscriptionStatus: "cancelled",
      cancelAtPeriodEnd: false,
    };
    expect(resolveSubscriptionPlanLabel(billing, t)).toBe("Annulé");
    expect(resolveBillingSummaryEyebrow(billing, t)).toBe("Annulé");
    expect(resolveBillingSummaryTitle(billing, t)).toBe("Annulé");
    expect(isCurrentOfferPlan(billing, "solo")).toBe(false);
  });

  it("active + cancelAtPeriodEnd → Expire le…, no Offre actuelle badge", () => {
    const billing = {
      hasSubscription: true,
      planId: "solo",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2026-09-01T00:00:00.000Z",
    };
    expect(resolveSubscriptionPlanLabel(billing, t, { lang: "fr" })).toMatch(/^Expire le /);
    expect(resolveBillingSummaryEyebrow(billing, t)).toBe("Annulation programmée");
    expect(isCurrentOfferPlan(billing, "solo")).toBe(false);
  });

  it("ignores hasSubscription when deriving labels", () => {
    const billing = {
      hasSubscription: false,
      planId: "solo",
      subscriptionStatus: "cancelled",
    };
    expect(resolveSubscriptionPlanLabel(billing, t)).toBe("Annulé");
    expect(isCurrentOfferPlan(billing, "solo")).toBe(false);
  });
});
