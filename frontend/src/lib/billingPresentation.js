/**
 * Single presentation layer for /api/billing/me.
 * UI must key off subscriptionStatus (+ cancelAtPeriodEnd), not hasSubscription.
 */

const ACTIVE_LIKE_STATUSES = new Set(["active", "past_due", "suspended"]);
const ENDED_STATUSES = new Set(["cancelled", "canceled", "expired"]);

export function normalizeSubscriptionStatus(status) {
  if (!status) return null;
  if (status === "canceled") return "cancelled";
  return status;
}

export function getSubscriptionStatus(billing) {
  return normalizeSubscriptionStatus(billing?.subscriptionStatus);
}

/** Local/app trial (no paid Stripe period). */
export function isTrialStatus(billing) {
  return getSubscriptionStatus(billing) === "trial";
}

/** Actively entitled subscription (still billed / usable). */
export function isActiveLikeStatus(billing) {
  return ACTIVE_LIKE_STATUSES.has(getSubscriptionStatus(billing));
}

export function isEndedStatus(billing) {
  return ENDED_STATUSES.has(getSubscriptionStatus(billing));
}

/** Scheduled cancellation while status is still active-like. */
export function isCancelAtPeriodEnd(billing) {
  return Boolean(billing?.cancelAtPeriodEnd) && isActiveLikeStatus(billing);
}

/**
 * "Offre actuelle" badge — only for an active-like plan that is not ending.
 * Never for trial / cancelled / expired / cancel_at_period_end.
 */
export function isCurrentOfferPlan(billing, planId) {
  if (!planId || !billing?.planId || billing.planId !== planId) return false;
  if (isCancelAtPeriodEnd(billing)) return false;
  return isActiveLikeStatus(billing);
}

function formatBillingDate(iso, lang) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR");
  } catch {
    return null;
  }
}

/**
 * Primary label for sidebar / compact widgets.
 * - trial → Essai gratuit
 * - active-like → plan name (or Expire le… if cancel_at_period_end)
 * - cancelled/expired → Annulé / Expiré
 */
export function resolveSubscriptionPlanLabel(billing, t, { lang } = {}) {
  const status = getSubscriptionStatus(billing);
  if (!status) return t("sidebar.subscription.none");

  if (status === "trial") return t("sidebar.subscription.trial");

  if (isCancelAtPeriodEnd(billing)) {
    const date = formatBillingDate(billing.currentPeriodEnd, lang);
    if (date) return t("sidebar.subscription.expiresOn").replace("{date}", date);
    return t("billingPage.cancelScheduled");
  }

  if (status === "cancelled") return t("billingPage.status.cancelled");
  if (status === "expired") return t("billingPage.status.expired");

  if (isActiveLikeStatus(billing) && billing.planId) {
    return t(`billingPage.plans.${billing.planId}`);
  }

  return t(`billingPage.status.${status}`) || t("sidebar.subscription.none");
}

/** Eyebrow above the billing summary title (not derived from hasSubscription). */
export function resolveBillingSummaryEyebrow(billing, t) {
  const status = getSubscriptionStatus(billing);
  if (!status) return t("billingPage.noSubscription");
  if (status === "trial") return t("billingPage.status.trial");
  if (isCancelAtPeriodEnd(billing)) return t("billingPage.cancelScheduled");
  if (isEndedStatus(billing)) return t(`billingPage.status.${status}`);
  if (isActiveLikeStatus(billing)) return t("billingPage.currentPlan");
  return t("billingPage.noSubscription");
}

/** Main title in the billing summary card. */
export function resolveBillingSummaryTitle(billing, t) {
  const status = getSubscriptionStatus(billing);
  if (!status) return t("billingPage.choosePlan");
  if (status === "trial") return t("billingPage.status.trial");
  if (isEndedStatus(billing)) return t(`billingPage.status.${status}`);
  if (isActiveLikeStatus(billing) && billing.planId) {
    return t(`billingPage.plans.${billing.planId}`);
  }
  return t("billingPage.choosePlan");
}

export function resolveBillingStatusLabelKey(billing) {
  const status = getSubscriptionStatus(billing);
  if (!status) return "billingPage.status.none";
  return `billingPage.status.${status}`;
}
