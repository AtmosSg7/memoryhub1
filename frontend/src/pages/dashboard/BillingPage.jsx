import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Sparkles,
  Zap,
  ArrowUpRight,
  Coins,
  Receipt,
  Info,
  Loader2,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/dashboard/PageHeader";
import { PageError, PageLoader } from "@/components/dashboard/PageFeedback";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  changeBillingPlan,
  fetchBillingMe,
  openBillingPortal,
  startCheckout,
} from "@/lib/billingApi";
import {
  checkoutCreditPack,
  devPurchaseCreditPack,
  fetchCreditPacks,
  fetchCreditPurchases,
} from "@/lib/creditPacksApi";
import AiAnalysisPacksPanel from "@/components/dashboard/AiAnalysisPacksPanel";
import { invalidateCreditsCache, useCredits } from "@/hooks/useCredits";

const PLAN_ORDER = ["solo", "pro", "team"];

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
  const [creditPacks, setCreditPacks] = useState([]);
  const [packCaps, setPackCaps] = useState({ devCreditPurchasesEnabled: false, stripeCreditCheckoutEnabled: false });
  const [purchases, setPurchases] = useState([]);
  const { refresh: refreshCredits } = useCredits();

  const loadBilling = useCallback(async () => {
    setError("");
    try {
      const [billingData, packsData, purchasesData] = await Promise.all([
        fetchBillingMe(),
        fetchCreditPacks().catch(() => ({ packs: [], devCreditPurchasesEnabled: false, stripeCreditCheckoutEnabled: false })),
        fetchCreditPurchases({ limit: 10 }).catch(() => ({ items: [], total: 0 })),
      ]);
      setBilling(billingData);
      setCreditPacks(packsData.packs || []);
      setPackCaps({
        devCreditPurchasesEnabled: packsData.devCreditPurchasesEnabled,
        stripeCreditCheckoutEnabled: packsData.stripeCreditCheckoutEnabled,
      });
      setPurchases(purchasesData.items || []);
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
    } else if (checkout === "cancel") {
      toast.message(t("billingPage.checkoutCancel"));
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
    }
    const credits = searchParams.get("credits");
    if (credits === "success") {
      toast.success(t("creditPacks.purchaseSuccess"));
      searchParams.delete("credits");
      setSearchParams(searchParams, { replace: true });
      loadBilling();
      refreshCredits().catch(() => {});
    } else if (credits === "cancel") {
      toast.message(t("billingPage.checkoutCancel"));
      searchParams.delete("credits");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, t, loadBilling, refreshCredits]);

  const handleCheckout = async (planId) => {
    if (actionLoading) return;
    setActionLoading(`checkout-${planId}`);
    try {
      const { checkoutUrl } = await startCheckout(planId);
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
    } catch (err) {
      toast.error(err.message || t("billingPage.planChangeError"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreditPackPurchase = async (pack) => {
    if (actionLoading) return;
    setActionLoading(`pack-${pack.packKey}`);
    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `pack-${pack.packKey}-${Date.now()}`;
    try {
      if (packCaps.devCreditPurchasesEnabled) {
        const result = await devPurchaseCreditPack(pack.packKey, { idempotencyKey });
        invalidateCreditsCache();
        await refreshCredits();
        await loadBilling();
        toast.success(t("creditPacks.purchaseSuccess"), {
          description: `+${result.purchase.analyses} ${t("credits.short")}`,
        });
      } else if (pack.stripeConfigured && packCaps.stripeCreditCheckoutEnabled) {
        const { checkoutUrl } = await checkoutCreditPack(pack.packKey);
        window.location.href = checkoutUrl;
        return;
      } else {
        toast.error(t("billingPage.buyAnalysesSoon"));
      }
    } catch (err) {
      toast.error(err.message || t("billingPage.checkoutError"));
    } finally {
      setActionLoading(null);
    }
  };

  const currentPlanId = billing?.planId;
  const planLabel = currentPlanId ? t(`billingPage.plans.${currentPlanId}`) : "—";

  const plansToShow = useMemo(() => {
    const available = billing?.availablePlans?.length ? billing.availablePlans : PLAN_ORDER;
    return PLAN_ORDER.filter((id) => available.includes(id));
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
          className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 flex items-start gap-3"
          data-testid="billing-stripe-unconfigured"
        >
          <Info className="w-4 h-4 text-[#0A2540] mt-0.5 shrink-0" />
          <p className="text-sm text-[#0A2540] leading-relaxed">{t("billingPage.stripeNotConfigured")}</p>
        </section>
      )}

      {billing?.stripeConfigured && billing?.stripeTestMode && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("billingPage.stripeTestMode")}
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="xl:col-span-2 bg-white border border-[#E5E7EB] rounded-2xl p-5 md:p-6 space-y-5 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[#9CA3AF] font-semibold">
                {billing?.hasSubscription ? t("billingPage.currentPlan") : t("billingPage.noSubscription")}
              </p>
              <h2 className="font-cabinet text-2xl font-bold text-[#111827] tracking-tight mt-1">
                {billing?.hasSubscription ? planLabel : t("billingPage.choosePlan")}
              </h2>
              {billing?.hasSubscription && (
                <p className="text-sm text-[#6B7280] mt-1">
                  {t(statusLabelKey(billing.subscriptionStatus))}
                  {billing.trialEndsAt && (
                    <span className="block text-xs text-[#9CA3AF] mt-1">
                      {t("billingPage.trialEnds")}: {new Date(billing.trialEndsAt).toLocaleDateString()}
                    </span>
                  )}
                  {billing.currentPeriodEnd && !billing.trialEndsAt && (
                    <span className="block text-xs text-[#9CA3AF] mt-1">
                      {t("billingPage.renewal")}: {new Date(billing.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  )}
                  {billing.cancelAtPeriodEnd && (
                    <span className="block text-xs text-amber-700 mt-1">{t("billingPage.cancelScheduled")}</span>
                  )}
                </p>
              )}
            </div>
            {billing?.actions?.canManage && (
              <ActionButton
                variant="primary"
                className="shrink-0"
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
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
              <div className="flex items-center gap-2 text-[#0A2540]">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {t("billingPage.analysesRemaining")}
                </span>
              </div>
              <p className="mt-2 text-2xl font-cabinet font-bold text-[#111827]">
                {billing?.totalAnalysesRemaining ?? 0}
                <span className="text-sm font-normal text-[#6B7280] ml-1">{t("billingPage.analysesShort")}</span>
              </p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                {t("billingPage.analysesBreakdown")
                  .replace("{monthly}", String(billing?.monthlyAnalysesRemaining ?? 0))
                  .replace("{permanent}", String(billing?.permanentAnalysesRemaining ?? 0))}
              </p>
              <Link
                to="/dashboard/billing/ai-history"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0A2540] mt-3 hover:underline"
                data-testid="billing-ai-history-link"
              >
                {t("credits.historyViewAll")}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
              <div className="flex items-center gap-2 text-[#0A2540]">
                <Receipt className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {t("billingPage.account")}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-[#111827] truncate">
                {user?.companyName || "—"}
              </p>
            </div>
          </div>

          {billing?.stripeConfigured && (
            <div className="grid gap-3 sm:grid-cols-3" data-testid="billing-plan-cards">
              {plansToShow.map((planId) => {
                const isCurrent = currentPlanId === planId;
                const canCheckout = billing.actions?.canCheckout && !isCurrent;
                const canChange = billing.actions?.canChangePlan && !isCurrent && billing.hasSubscription;
                return (
                  <div
                    key={planId}
                    className={`rounded-xl border p-4 ${isCurrent ? "border-[#0A2540] bg-[#EFF6FF]" : "border-[#E5E7EB]"}`}
                  >
                    <p className="font-cabinet font-semibold text-[#111827]">{t(`billingPage.plans.${planId}`)}</p>
                    {isCurrent && (
                      <p className="text-xs text-[#0A2540] mt-1 font-medium">{t("billingPage.currentBadge")}</p>
                    )}
                    <div className="mt-3 flex flex-col gap-2">
                      {canCheckout && (
                        <ActionButton
                          variant="primary"
                          className="w-full justify-center text-sm"
                          disabled={!!actionLoading}
                          onClick={() => handleCheckout(planId)}
                          data-testid={`billing-checkout-${planId}`}
                        >
                          {actionLoading === `checkout-${planId}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                          {t("billingPage.subscribe")}
                        </ActionButton>
                      )}
                      {canChange && (
                        <ActionButton
                          variant="secondary"
                          className="w-full justify-center text-sm"
                          disabled={!!actionLoading}
                          onClick={() => handleChangePlan(planId)}
                          data-testid={`billing-change-${planId}`}
                        >
                          {actionLoading === `change-${planId}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : null}
                          {t("billingPage.changeToPlan").replace("{plan}", t(`billingPage.plans.${planId}`))}
                        </ActionButton>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <AiAnalysisPacksPanel
          packs={creditPacks}
          packCaps={packCaps}
          actionLoading={actionLoading}
          disabled={!!actionLoading}
          onPurchase={handleCreditPackPurchase}
        />
      </div>

      {purchases.length > 0 ? (
        <section className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden" data-testid="credit-purchase-history">
          <div className="px-4 py-3 border-b border-[#F3F4F6]">
            <h3 className="font-cabinet font-semibold text-[#111827]">{t("creditPacks.purchaseHistory")}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[#F3F4F6]">
                {purchases.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-[#111827] whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-[#4B5563]">{row.packName || row.packKey}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">+{row.analyses}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#6B7280]">
                      {(row.priceCents / 100).toFixed(2)} {row.currency.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]">
                      {row.method === "development" ? t("creditPacks.methodDev") : t("creditPacks.methodStripe")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2">
          <Zap className="w-4 h-4 text-[#0A2540] mt-0.5 shrink-0" />
          <p className="text-sm text-[#0A2540]">{t("billingPage.aiExplainer")}</p>
        </div>
        <ActionButton variant="quick" className="shrink-0" onClick={() => navigate("/dashboard/settings")}>
          {t("billingPage.manageAccount")}
        </ActionButton>
      </section>
    </div>
  );
}
