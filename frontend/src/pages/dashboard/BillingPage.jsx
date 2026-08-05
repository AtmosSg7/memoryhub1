import { useEffect, useMemo, useState } from "react";
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
import { changeBillingPlan, openBillingPortal, startCheckout } from "@/lib/billingApi";
import { useBillingSummary } from "@/hooks/useBillingSummary";
import { invalidateCreditsCache } from "@/hooks/useCredits";
import { PLAN_CATALOG, PLAN_ORDER } from "@/constants/planConfig";

export default function BillingPage() {
  const { t } = useDashboardLang();
  usePageTitle("page.billing.title");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { view, loading, error, refresh } = useBillingSummary();
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast.success(t("billingPage.checkoutSuccess"));
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
      refresh();
      invalidateCreditsCache();
    } else if (checkout === "cancel") {
      toast.message(t("billingPage.checkoutCancel"));
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, t, refresh]);

  const handleCheckout = async (planId) => {
    if (actionLoading) return;
    if (!view.stripeConfigured) {
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
      await refresh();
      invalidateCreditsCache();
    } catch (err) {
      toast.error(err.message || t("billingPage.planChangeError"));
    } finally {
      setActionLoading(null);
    }
  };

  const plansToShow = useMemo(() => {
    const available = view.availablePlans?.length ? view.availablePlans : PLAN_ORDER;
    return PLAN_CATALOG.filter((plan) => available.includes(plan.id));
  }, [view.availablePlans]);

  if (loading && !view.status) {
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

      {!view.stripeConfigured && (
        <section
          className="rounded-xl border border-[#BFDBFE] bg-dash-accent-soft px-4 py-3 flex items-start gap-3"
          data-testid="billing-stripe-unconfigured"
        >
          <Info className="w-4 h-4 text-dash-primary mt-0.5 shrink-0" />
          <p className="text-sm text-dash-primary leading-relaxed">{t("billingPage.stripeNotConfigured")}</p>
        </section>
      )}

      {view.stripeConfigured && view.stripeTestMode && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("billingPage.stripeTestMode")}
        </section>
      )}

      <section
        className="bg-dash-surface border border-dash-border rounded-2xl p-5 md:p-6 space-y-5 shadow-[0_1px_2px_rgba(17,24,39,0.04)]"
        data-testid="billing-summary-card"
      >
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p
              className="text-[11px] uppercase tracking-widest text-dash-text-subtle font-semibold"
              data-testid="billing-summary-eyebrow"
            >
              {view.summaryEyebrow}
            </p>
            <h2
              className="font-cabinet text-2xl font-bold text-dash-text tracking-tight mt-1"
              data-testid="billing-summary-title"
            >
              {view.summaryTitle}
            </h2>
            {view.status ? (
              <p className="text-sm text-dash-text-muted mt-1" data-testid="billing-summary-status">
                {view.statusLabel}
                {view.isTrial && view.trialEndsLabel ? (
                  <span className="block text-xs text-dash-text-subtle mt-1">
                    {t("billingPage.trialEnds")}: {view.trialEndsLabel}
                  </span>
                ) : null}
                {view.periodEndLabel && view.periodEndKind === "expires" ? (
                  <span className="block text-xs text-dash-text-subtle mt-1">
                    {t("billingPage.expiresOn")}: {view.periodEndLabel}
                  </span>
                ) : null}
                {view.periodEndLabel && view.periodEndKind === "renewal" ? (
                  <span className="block text-xs text-dash-text-subtle mt-1">
                    {t("billingPage.renewal")}: {view.periodEndLabel}
                  </span>
                ) : null}
                {view.periodEndLabel && view.periodEndKind === "ended" ? (
                  <span className="block text-xs text-dash-text-subtle mt-1">
                    {t("billingPage.endedOn")}: {view.periodEndLabel}
                  </span>
                ) : null}
              </p>
            ) : null}
            <p className="text-sm text-dash-text-muted mt-2 truncate">{user?.companyName || user?.email || "—"}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <ImportUsageMeter
              planId={view.usagePlanId || "solo"}
              monthlyRemaining={view.monthlyAnalysesRemaining}
              monthlyAllocated={view.monthlyAnalysesAllocated}
              className="min-w-[220px]"
            />
            {view.actions?.canManage ? (
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
            const isCurrentOffer = view.isCurrentOfferPlan(plan.id);
            const onLocalTrial = view.isTrial && !view.actions?.canManage;
            const canCheckout =
              Boolean(view.stripeConfigured) &&
              Boolean(view.actions?.canCheckout) &&
              (!isCurrentOffer || onLocalTrial);
            const canChange =
              Boolean(view.stripeConfigured) &&
              Boolean(view.actions?.canChangePlan) &&
              !isCurrentOffer &&
              Boolean(view.actions?.canManage);

            return (
              <SubscriptionPlanCard
                key={plan.id}
                plan={plan}
                isCurrent={isCurrentOffer}
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
