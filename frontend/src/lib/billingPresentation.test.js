/**
 * @jest-environment node
 */

const { buildBillingViewModel, isCurrentOfferPlan } = require("@/lib/billingPresentation");

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
    "billingPage.status.none": "Aucun abonnement",
    "billingPage.status.trial": "Essai gratuit",
    "billingPage.status.cancelled": "Annulé",
    "billingPage.status.expired": "Expiré",
    "billingPage.status.active": "Actif",
    "billingPage.status.past_due": "Paiement en retard",
  };
  return map[key] || key;
}

function viewFor(billing) {
  return buildBillingViewModel(billing, t, "fr");
}

describe("buildBillingViewModel — single source of truth", () => {
  it("trial → Essai gratuit everywhere, no current-offer badge", () => {
    const view = viewFor({
      hasSubscription: true,
      planId: "solo",
      subscriptionStatus: "trial",
      cancelAtPeriodEnd: false,
    });
    expect(view.widgetLabel).toBe("Essai gratuit");
    expect(view.summaryEyebrow).toBe("Essai gratuit");
    expect(view.summaryTitle).toBe("Essai gratuit");
    expect(view.statusLabel).toBe("Essai gratuit");
    expect(view.isCurrentOfferPlan("solo")).toBe(false);
  });

  it("active → same plan label in widget + summary, Offre actuelle badge", () => {
    const view = viewFor({
      hasSubscription: true,
      planId: "solo",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
    });
    expect(view.widgetLabel).toBe("Starter");
    expect(view.summaryEyebrow).toBe("Offre actuelle");
    expect(view.summaryTitle).toBe("Starter");
    expect(view.statusLabel).toBe("Actif");
    expect(view.isCurrentOfferPlan("solo")).toBe(true);
    expect(view.isCurrentOfferPlan("pro")).toBe(false);
  });

  it("cancelled → Annulé everywhere, never Essai gratuit nor Offre actuelle", () => {
    const view = viewFor({
      hasSubscription: true,
      planId: "solo",
      subscriptionStatus: "cancelled",
      cancelAtPeriodEnd: false,
    });
    expect(view.widgetLabel).toBe("Annulé");
    expect(view.summaryEyebrow).toBe("Annulé");
    expect(view.summaryTitle).toBe("Annulé");
    expect(view.statusLabel).toBe("Annulé");
    expect(view.isCurrentOfferPlan("solo")).toBe(false);
    expect(isCurrentOfferPlan(view.raw, "solo")).toBe(false);
  });

  it("expired → Expiré, no current-offer badge", () => {
    const view = viewFor({
      hasSubscription: true,
      planId: "pro",
      subscriptionStatus: "expired",
    });
    expect(view.widgetLabel).toBe("Expiré");
    expect(view.summaryTitle).toBe("Expiré");
    expect(view.isCurrentOfferPlan("pro")).toBe(false);
  });

  it("active + cancelAtPeriodEnd → Expire le…, no Offre actuelle", () => {
    const view = viewFor({
      hasSubscription: true,
      planId: "solo",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2026-09-01T00:00:00.000Z",
    });
    expect(view.widgetLabel).toMatch(/^Expire le /);
    expect(view.summaryEyebrow).toBe("Annulation programmée");
    expect(view.summaryTitle).toBe("Starter");
    expect(view.periodEndKind).toBe("expires");
    expect(view.isCurrentOfferPlan("solo")).toBe(false);
  });

  it("ignores hasSubscription entirely for labels and badges", () => {
    const view = viewFor({
      hasSubscription: false,
      planId: "solo",
      subscriptionStatus: "cancelled",
    });
    expect(view.widgetLabel).toBe("Annulé");
    expect(view.summaryTitle).toBe("Annulé");
    expect(view.isCurrentOfferPlan("solo")).toBe(false);
  });
});
