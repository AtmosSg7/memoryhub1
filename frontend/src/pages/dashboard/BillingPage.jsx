import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Info, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/dashboard/PageHeader";
import { PageError, PageLoader } from "@/components/dashboard/PageFeedback";
import { ActionButton } from "@/components/dashboard/ActionButton";
import ImportUsageMeter from "@/components/dashboard/ImportUsageMeter";
import SubscriptionPlanCard from "@/components/dashboard/SubscriptionPlanCard";
import {
  changeBillingPlan,
  fetchBillingMe,
  openBillingPortal,
  startCheckout,
} from "@/lib/billingApi";
import { setBillingCache } from "@/hooks/useBillingSummary";
import { invalidateCreditsCache } from "@/hooks/useCredits";
import { PLAN_CATALOG, PLAN_ORDER } from "@/constants/planConfig";

function statusLabelKey(status) {
  if (!status) return "billingPage.status.none";
  return `billingPage.status.${status}`;
}

export default function BillingPage() {
  const { t } = useDashboardLang();
  usePageTitle("page.billing.title");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const loadBilling = useCallback(async () => {
    setError("");
    try {
      const billingData = await fetchBillingMe();
      setBilling(billingData);
      // Keep dashboard widgets (sidebar, badges) on the same /billing/me snapshot.
      setBillingCache(billingData);
    } catch (err) {
      setError(err.message || t("billingPage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast.success(t("billingPage.checkoutSuccess"));
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
      loadBilling();
      invalidateCreditsCache();
    } else if (checkout === "cancel") {
      toast.message(t("billingPage.checkoutCancel"));
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, t, loadBilling]);

  const handleCheckout = async (planId) => {
    if (actionLoading) return;
    if (!billing?.stripeConfigured) {
      toast.error(t("billingPage.stripeNotConfigured"));
      return;
    }
    setActionLoading(`checkout-${planId}`);
    try {
      const { checkoutUrl } = await startCheckout(planId);
      if (!checkoutUrl) {
        throw new Error(t("billingPage.checkoutError"));
      }
      window.location.href = checkoutUrl;
    } catch (err) {
      toast.error(err.message || t("billingPage.checkoutError"));
      setActionLoading(null);
    }
  };

  const handlePortal = async () => {
    if (actionLoading) return;
    setActionLoading("portal");
    try {
      const { portalUrl } = await openBillingPortal();
      window.location.href = portalUrl;
    } catch (err) {
      toast.error(err.message || t("billingPage.portalError"));
      setActionLoading(null);
    }
  };

  const handleChangePlan = async (planId) => {
    if (actionLoading) return;
    setActionLoading(`change-${planId}`);
    try {
      const result = await changeBillingPlan(planId);
      toast.success(result.message || t("billingPage.planChangeSubmitted"));
      await loadBilling();
      invalidateCreditsCache();
    } catch (err) {
      toast.error(err.message || t("billingPage.planChangeError"));
    } finally {
      setActionLoading(null);
    }
  };

  const currentPlanId = billing?.planId;
  const planLabel = currentPlanId ? t(`billingPage.plans.${currentPlanId}`) : "—";

  const plansToShow = useMemo(() => {
    const available = billing?.availablePlans?.length ? billing.availablePlans : PLAN_ORDER;
    return PLAN_CATALOG.filter((plan) => available.includes(plan.id));
  }, [billing?.availablePlans]);

  if (loading) {
    return (
      <div className="space-y-6" data-testid="billing-page">
        <PageHeader
          title={t("page.billing.title")}
          subtitle={t("page.billing.subtitle")}
          testId="billing-header"
        />
        <PageLoader label={t("auth.loading")} testId="billing-page-loading" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="billing-page">
      <PageHeader
        title={t("page.billing.title")}
        subtitle={t("page.billing.subtitle")}
        testId="billing-header"
      />

      {error ? <PageError message={error} testId="billing-error" /> : null}

      {!billing?.stripeConfigured && (
        <section
          className="rounded-xl border border-[#BFDBFE] bg-dash-accent-soft px-4 py-3 flex items-start gap-3"
          data-testid="billing-stripe-unconfigured"
        >
          <Info className="w-4 h-4 text-dash-primary mt-0.5 shrink-0" />
          <p className="text-sm text-dash-primary leading-relaxed">{t("billingPage.stripeNotConfigured")}</p>
        </section>
      )}

      {billing?.stripeConfigured && billing?.stripeTestMode && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("billingPage.stripeTestMode")}
        </section>
      )}

      <section className="bg-dash-surface border border-dash-border rounded-2xl p-5 md:p-6 space-y-5 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-dash-text-subtle font-semibold">
              {billing?.hasSubscription ? t("billingPage.currentPlan") : t("billingPage.noSubscription")}
            </p>
            <h2 className="font-cabinet text-2xl font-bold text-dash-text tracking-tight mt-1">
              {billing?.hasSubscription ? planLabel : t("billingPage.choosePlan")}
            </h2>
            {billing?.hasSubscription && (
              <p className="text-sm text-dash-text-muted mt-1">
                {t(statusLabelKey(billing.subscriptionStatus))}
                {billing.trialEndsAt && (
                  <span className="block text-xs text-dash-text-subtle mt-1">
                    {t("billingPage.trialEnds")}: {new Date(billing.trialEndsAt).toLocaleDateString()}
                  </span>
                )}
                {billing.currentPeriodEnd && !billing.trialEndsAt && (
                  <span className="block text-xs text-dash-text-subtle mt-1">
                    {t("billingPage.renewal")}: {new Date(billing.currentPeriodEnd).toLocaleDateString()}
                  </span>
                )}
                {billing.cancelAtPeriodEnd && (
                  <span className="block text-xs text-amber-700 mt-1">{t("billingPage.cancelScheduled")}</span>
                )}
              </p>
            )}
            <p className="text-sm text-dash-text-muted mt-2 truncate">{user?.companyName || user?.email || "—"}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <ImportUsageMeter
              planId={currentPlanId || "solo"}
              monthlyRemaining={billing?.monthlyAnalysesRemaining}
              monthlyAllocated={billing?.monthlyAnalysesAllocated}
              className="min-w-[220px]"
            />
            {billing?.actions?.canManage ? (
              <ActionButton
                variant="primary"
                className="shrink-0 self-start"
                onClick={handlePortal}
                disabled={!!actionLoading}
                data-testid="billing-manage-button"
              >
                {actionLoading === "portal" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                {t("billingPage.manageSubscription")}
              </ActionButton>
            ) : null}
          </div>
        </div>

        <Link
          to="/dashboard/billing/ai-history"
          className="inline-flex items-center gap-1 text-xs font-medium text-dash-primary hover:underline"
          data-testid="billing-import-history-link"
        >
          {t("imports.historyViewAll")}
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      <section className="space-y-4" data-testid="billing-plan-cards">
        <div>
          <h2 className="font-cabinet text-lg md:text-xl font-bold text-dash-text tracking-tight">
            {t("billingPage.plansSectionTitle")}
          </h2>
          <p className="text-sm text-dash-text-muted mt-1">{t("billingPage.plansSectionSubtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
          {plansToShow.map((plan) => {
            const isCurrent = currentPlanId === plan.id;
            const stripeBacked = Boolean(billing?.actions?.canManage);
            const onLocalTrial =
              billing?.subscriptionStatus === "trial" && !stripeBacked;
            // Trial without Stripe can pick any plan (including current) to open Checkout.
            const canCheckout =
              Boolean(billing?.stripeConfigured) &&
              Boolean(billing?.actions?.canCheckout) &&
              (!isCurrent || onLocalTrial);
            const canChange =
              Boolean(billing?.stripeConfigured) &&
              Boolean(billing?.actions?.canChangePlan) &&
              !isCurrent &&
              stripeBacked;

            return (
              <SubscriptionPlanCard
                key={plan.id}
                plan={plan}
                isCurrent={isCurrent}
                canCheckout={canCheckout}
                canChange={canChange}
                actionLoading={!!actionLoading}
                checkoutLoading={actionLoading === `checkout-${plan.id}`}
                changeLoading={actionLoading === `change-${plan.id}`}
                onCheckout={handleCheckout}
                onChangePlan={handleChangePlan}
              />
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-[#BFDBFE] bg-dash-accent-soft px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-dash-primary leading-relaxed">{t("billingPage.importExplainer")}</p>
        <ActionButton variant="quick" className="shrink-0" onClick={() => navigate("/dashboard/settings")}>
          {t("billingPage.manageAccount")}
        </ActionButton>
      </section>
    </div>
  );
}
