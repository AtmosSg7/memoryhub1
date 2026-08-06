import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useDashboardHomeData } from "@/hooks/useDashboardHomeData";
import { useActions } from "@/hooks/useActions";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/context/AuthContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardKpiGrid from "@/components/dashboard/DashboardKpiGrid";
import DashboardQuickActions from "@/components/dashboard/DashboardQuickActions";
import DashboardPipelineCard from "@/components/dashboard/DashboardPipelineCard";
import DashboardActionCenterCard from "@/components/dashboard/DashboardActionCenterCard";
import TopClients from "@/components/dashboard/TopClients";
import OnboardingCards from "@/components/dashboard/OnboardingCards";
import OnboardingWizard from "@/components/dashboard/OnboardingWizard";
import StartupChecklist from "@/components/dashboard/StartupChecklist";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import { Skeleton } from "@/components/ui/skeleton";

const DashboardAnalyticsSection = lazy(
  () => import("@/components/dashboard/DashboardAnalyticsSection")
);

function AnalyticsFallback() {
  return (
    <div className="space-y-3" data-testid="dashboard-analytics-fallback">
      <Skeleton className="h-6 w-40 bg-dash-border" />
      <Skeleton className="h-56 w-full rounded-xl bg-dash-surface-muted" />
    </div>
  );
}

export default function DashboardHome() {
  const { t, lang } = useDashboardLang();
  usePageTitle("page.dashboard.title");
  const { user } = useAuth();
  const [period, setPeriod] = useState("30d");

  const {
    kpis,
    pipeline,
    series,
    topClients,
    periodMeta,
    emptyAnalytics,
    loading: dataLoading,
    listsLoading,
    onboarding,
    isEmptyAccount,
    hasOnboardingSteps,
  } = useDashboardHomeData({ lang, period, enabled: true });

  const {
    state: onboardingState,
    showWizard,
    showChecklist,
    demoAllowed,
    patchWizard,
    dismissChecklist,
    ackFirstWin,
    pendingFirstWin,
    maturity,
    refresh: refreshOnboarding,
  } = useOnboardingState({ enabled: true });

  const {
    actions: engineActions,
    loading: actionsLoading,
    error: actionsError,
    refetch: refetchActions,
  } = useActions({
    status: "pending",
    limit: 50,
    enabled: maturity !== "empty",
  });

  useEffect(() => {
    if (!pendingFirstWin) return;
    const message = t(`firstWins.${pendingFirstWin.id}`);
    toast.success(message, { duration: 4000 });
    ackFirstWin(pendingFirstWin.id).catch(() => {});
  }, [pendingFirstWin, ackFirstWin, t]);

  useEffect(() => {
    if (!isEmptyAccount && maturity === "empty") {
      refreshOnboarding();
    }
  }, [isEmptyAccount, maturity, refreshOnboarding]);

  const showEmptyHero = (isEmptyAccount || maturity === "empty") && !showWizard;
  const showOnboardingGuidance =
    hasOnboardingSteps &&
    engineActions.length === 0 &&
    !actionsLoading &&
    maturity !== "active";
  const firstName = user?.firstName?.trim();
  const showFullDashboard = maturity === "active" || (!isEmptyAccount && !showEmptyHero);

  return (
    <div className="space-y-6 md:space-y-8" data-testid="dashboard-home">
      <OnboardingWizard
        open={showWizard}
        demoAllowed={demoAllowed}
        currentStep={onboardingState?.wizard?.currentStep || 0}
        onStepChange={(step) => patchWizard({ currentStep: step })}
        onComplete={() => patchWizard({ completed: true, currentStep: 4 })}
        onDismiss={() => patchWizard({ dismissed: true })}
      />

      <div className="space-y-4">
        <DashboardHeader firstName={firstName} />
        {showChecklist ? (
          <StartupChecklist
            checklist={onboardingState?.checklist}
            onDismiss={() => dismissChecklist().catch(() => toast.error(t("errors.generic")))}
          />
        ) : null}
        {showFullDashboard ? (
          <DashboardKpiGrid kpis={kpis} loading={dataLoading} periodMeta={periodMeta} />
        ) : null}
      </div>

      {showEmptyHero ? (
        <OnboardingCards onboarding={onboarding} hasClients={(kpis?.clients?.total || 0) > 0} />
      ) : showFullDashboard ? (
        <>
          <DashboardActionCenterCard
            actions={engineActions}
            loading={actionsLoading}
            error={actionsError}
            onboardingHint={showOnboardingGuidance}
            onChanged={refetchActions}
          />

          {/* One-handed: create CTAs before secondary analytics on small screens */}
          <div className="md:hidden">
            <DashboardQuickActions compact />
          </div>

          <Suspense fallback={<AnalyticsFallback />}>
            <DashboardAnalyticsSection
              series={series}
              loading={listsLoading}
              period={period}
              onPeriodChange={setPeriod}
              empty={emptyAnalytics}
            />
          </Suspense>

          <DashboardPipelineCard
            pipeline={pipeline}
            loading={listsLoading}
            periodMeta={periodMeta}
          />

          {topClients?.length > 0 || dataLoading ? (
            <TopClients clients={topClients.slice(0, 5)} loading={dataLoading} />
          ) : null}

          <div className="hidden md:block">
            <DashboardQuickActions compact />
          </div>

          <ActivityFeed
            limit={6}
            compact
            muted
            showViewAll
            showHeader
            showEmptyState={false}
            viewAllPath="/dashboard/communications"
          />
        </>
      ) : (
        <OnboardingCards
          onboarding={onboarding}
          hasClients={(kpis?.clients?.total || 0) > 0}
          compact
        />
      )}
    </div>
  );
}
