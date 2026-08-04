import { Check, Loader2, ArrowUpRight, Star } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { formatPlanPrice } from "@/constants/planConfig";
import { ActionButton } from "@/components/dashboard/ActionButton";

export default function SubscriptionPlanCard({
  plan,
  isCurrent = false,
  canCheckout = false,
  canChange = false,
  actionLoading = false,
  checkoutLoading = false,
  changeLoading = false,
  onCheckout,
  onChangePlan,
}) {
  const { t, lang } = useDashboardLang();
  const planId = plan.id;
  const features = t(`billingPage.planFeatures.${planId}`) || [];
  const price = formatPlanPrice(plan, lang);

  return (
    <article
      className={[
        "relative flex flex-col rounded-2xl border p-5 md:p-6 transition-shadow",
        plan.popular
          ? "border-dash-primary bg-gradient-to-b from-dash-accent-soft to-dash-surface shadow-[0_8px_30px_-12px_rgba(10,37,64,0.25)] dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.45)]"
          : isCurrent
            ? "border-dash-primary/40 bg-dash-surface-muted"
            : "border-dash-border bg-dash-surface dash-panel",
      ].join(" ")}
      data-testid={`billing-plan-card-${planId}`}
    >
      {plan.popular ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold text-[var(--dash-nav-active-text)] bg-[var(--dash-nav-active-bg)] shadow-sm">
            <Star className="w-3 h-3 fill-current" />
            {t("billingPage.popularBadge")}
          </span>
        </div>
      ) : null}

      <div className="mb-4">
        <p className="font-cabinet text-xl font-bold text-dash-text tracking-tight">
          {t(`billingPage.plans.${planId}`)}
        </p>
        {isCurrent ? (
          <p className="text-xs font-medium text-dash-primary mt-1">{t("billingPage.currentBadge")}</p>
        ) : null}
        <div className="mt-3 flex items-baseline gap-1">
          <span className="font-cabinet text-4xl font-bold text-dash-text tabular-nums">{price}€</span>
          <span className="text-sm text-dash-text-muted">{t("pricing.per")}</span>
        </div>
      </div>

      <ul className="space-y-2.5 flex-1 mb-5">
        {Array.isArray(features)
          ? features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-dash-text-muted">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-dash-accent-soft flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-dash-primary" strokeWidth={3} />
                </span>
                <span>{feature}</span>
              </li>
            ))
          : null}
      </ul>

      <div className="mt-auto flex flex-col gap-2">
        {canCheckout ? (
          <ActionButton
            variant={plan.popular ? "primary" : "secondary"}
            className="w-full justify-center"
            disabled={actionLoading || checkoutLoading}
            onClick={() => onCheckout?.(planId)}
            data-testid={`billing-checkout-${planId}`}
          >
            {checkoutLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            )}
            {t("billingPage.choosePlanCta").replace("{plan}", t(`billingPage.plans.${planId}`))}
          </ActionButton>
        ) : null}
        {canChange ? (
          <ActionButton
            variant="secondary"
            className="w-full justify-center"
            disabled={actionLoading || changeLoading}
            onClick={() => onChangePlan?.(planId)}
            data-testid={`billing-change-${planId}`}
          >
            {changeLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
            {t("billingPage.changeToPlan").replace("{plan}", t(`billingPage.plans.${planId}`))}
          </ActionButton>
        ) : null}
        {!canCheckout && !canChange && isCurrent ? (
          <p className="text-center text-xs font-medium text-dash-text-subtle py-2">
            {t("billingPage.currentBadge")}
          </p>
        ) : null}
      </div>
    </article>
  );
}
