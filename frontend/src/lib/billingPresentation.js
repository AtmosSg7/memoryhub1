/**
 * Single presentation layer for /api/billing/me.
 *
 * Every dashboard surface (Sidebar, BillingPage, plan cards, badges) must render
 * from buildBillingViewModel() — never from hasSubscription or ad-hoc planId checks.
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

export function isTrialStatus(billing) {
  return getSubscriptionStatus(billing) === "trial";
}

export function isActiveLikeStatus(billing) {
  return ACTIVE_LIKE_STATUSES.has(getSubscriptionStatus(billing));
}

export function isEndedStatus(billing) {
  return ENDED_STATUSES.has(getSubscriptionStatus(billing));
}

export function isCancelAtPeriodEnd(billing) {
  return Boolean(billing?.cancelAtPeriodEnd) && isActiveLikeStatus(billing);
}

/**
 * "Offre actuelle" on a plan card — active-like only, never trial / ended / CAPE.
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

function resolveWidgetLabel(billing, t, lang) {
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

function resolveSummaryEyebrow(billing, t) {
  const status = getSubscriptionStatus(billing);
  if (!status) return t("billingPage.noSubscription");
  if (status === "trial") return t("billingPage.status.trial");
  if (isCancelAtPeriodEnd(billing)) return t("billingPage.cancelScheduled");
  if (isEndedStatus(billing)) return t(`billingPage.status.${status}`);
  if (isActiveLikeStatus(billing)) return t("billingPage.currentPlan");
  return t("billingPage.noSubscription");
}

function resolveSummaryTitle(billing, t) {
  const status = getSubscriptionStatus(billing);
  if (!status) return t("billingPage.choosePlan");
  if (status === "trial") return t("billingPage.status.trial");
  if (isEndedStatus(billing)) return t(`billingPage.status.${status}`);
  if (isActiveLikeStatus(billing) && billing.planId) {
    return t(`billingPage.plans.${billing.planId}`);
  }
  return t("billingPage.choosePlan");
}

/**
 * Canonical UI snapshot derived from one /api/billing/me payload.
 * Components must read from this object only.
 */
export function buildBillingViewModel(billing, t, lang = "fr") {
  const status = getSubscriptionStatus(billing);
  const planId = billing?.planId || null;
  const periodEndLabel = formatBillingDate(billing?.currentPeriodEnd, lang);
  const trialEndsLabel = formatBillingDate(billing?.trialEndsAt, lang);
  const cape = isCancelAtPeriodEnd(billing);
  const ended = isEndedStatus(billing);
  const trial = status === "trial";
  const activeLike = isActiveLikeStatus(billing);

  return {
    raw: billing,
    status,
    planId,
    widgetLabel: resolveWidgetLabel(billing, t, lang),
    summaryEyebrow: resolveSummaryEyebrow(billing, t),
    summaryTitle: resolveSummaryTitle(billing, t),
    statusLabel: t(status ? `billingPage.status.${status}` : "billingPage.status.none"),
    isTrial: trial,
    isActiveLike: activeLike,
    isEnded: ended,
    isCancelAtPeriodEnd: cape,
    trialEndsLabel: trial ? trialEndsLabel : null,
    periodEndLabel: activeLike || ended ? periodEndLabel : null,
    periodEndKind: cape ? "expires" : activeLike ? "renewal" : ended ? "ended" : null,
    /** Meter / quota plan — API planId only, no silent "solo" fallback for labels. */
    usagePlanId: planId,
    stripeConfigured: Boolean(billing?.stripeConfigured),
    stripeTestMode: Boolean(billing?.stripeTestMode),
    actions: billing?.actions || {},
    availablePlans: billing?.availablePlans || [],
    monthlyAnalysesRemaining: billing?.monthlyAnalysesRemaining ?? null,
    monthlyAnalysesAllocated: billing?.monthlyAnalysesAllocated ?? null,
    isCurrentOfferPlan: (candidatePlanId) => isCurrentOfferPlan(billing, candidatePlanId),
  };
}

/** @deprecated use buildBillingViewModel().widgetLabel */
export function resolveSubscriptionPlanLabel(billing, t, { lang } = {}) {
  return buildBillingViewModel(billing, t, lang).widgetLabel;
}

/** @deprecated use buildBillingViewModel().summaryEyebrow */
export function resolveBillingSummaryEyebrow(billing, t) {
  return buildBillingViewModel(billing, t).summaryEyebrow;
}

/** @deprecated use buildBillingViewModel().summaryTitle */
export function resolveBillingSummaryTitle(billing, t) {
  return buildBillingViewModel(billing, t).summaryTitle;
}

/** @deprecated use buildBillingViewModel().statusLabel */
export function resolveBillingStatusLabelKey(billing) {
  const status = getSubscriptionStatus(billing);
  if (!status) return "billingPage.status.none";
  return `billingPage.status.${status}`;
}
