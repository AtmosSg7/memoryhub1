import { NavLink, useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { resolveSubscriptionPlanLabel, useBillingSummary } from "@/hooks/useBillingSummary";
import { useIsShowcaseDemo } from "@/context/ShowcaseThemeIsolation";
import { getSidebarItems } from "@/components/dashboard/sidebarNav";
import ImportUsageMeter from "@/components/dashboard/ImportUsageMeter";
import { PLAN_CATALOG } from "@/constants/planConfig";

export default function Sidebar() {
  const { t } = useDashboardLang();
  const navigate = useNavigate();
  const isShowcase = useIsShowcaseDemo();
  const { billing, planId, monthlyRemaining, monthlyAllocated, loading } = useBillingSummary();

  const displayPlanId = planId || "solo";
  const planLabel = resolveSubscriptionPlanLabel(billing, t);

  return (
    <aside
      className={[
        "hidden md:flex w-64 flex-col bg-dash-sidebar border-r border-dash-border z-40",
        isShowcase ? "absolute inset-y-0 left-0 h-full" : "fixed inset-y-0 left-0",
      ].join(" ")}
      data-testid="sidebar-root"
    >
      <div className="px-5 pt-6 pb-5 border-b border-dash-border-soft">
        <div className="flex items-center gap-2.5" data-testid="sidebar-brand">
          <div className="w-9 h-9 rounded-lg bg-[var(--dash-cta)] flex items-center justify-center relative overflow-hidden">
            <span className="font-cabinet text-[var(--dash-cta-text)] text-base font-bold">M</span>
            <div className="absolute -right-1 -top-1 w-3 h-3 rounded-full bg-dash-accent animate-soft-pulse" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-cabinet text-[15px] font-bold text-dash-text">Basera</span>
            <span className="text-[11px] text-dash-text-subtle">{t("brand.tagline")}</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {getSidebarItems(t).map((item) => (
            <li key={item.key}>
              <NavLink
                to={item.to}
                end={item.end}
                data-testid={`sidebar-nav-${item.key}`}
                className={({ isActive }) =>
                  [
                    "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                    isActive
                      ? "bg-[var(--dash-nav-active-bg)] text-[var(--dash-nav-active-text)] font-medium"
                      : "text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-muted",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2 : 1.75} />
                    <span className="flex-1">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-3 border-t border-dash-border-soft">
        <div
          className="relative overflow-hidden rounded-xl border border-dash-border bg-dash-surface p-4 dash-panel"
          data-testid="sidebar-upgrade-card"
        >
          <p className="dash-label">{t("sidebar.subscription.title")}</p>
          <p className="font-cabinet text-sm font-bold text-dash-text mt-1.5 truncate">
            {loading ? "…" : planLabel}
          </p>
          {!loading ? (
            <div className="mt-3">
              <ImportUsageMeter
                planId={displayPlanId}
                monthlyRemaining={monthlyRemaining}
                monthlyAllocated={
                  monthlyAllocated ?? PLAN_CATALOG.find((p) => p.id === displayPlanId)?.monthlyImports
                }
                compact
              />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => navigate("/dashboard/billing")}
            className="inline-flex mt-3 text-[11px] font-semibold text-dash-accent uppercase tracking-wide hover:text-dash-primary transition-colors"
            data-testid="sidebar-upgrade-cta"
          >
            {t("sidebar.subscription.cta")}
          </button>
        </div>
      </div>
    </aside>
  );
}
