import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useDashboardHomeData } from "@/hooks/useDashboardHomeData";
import { useReminders } from "@/hooks/useReminders";
import { usePersonalRemindersDue } from "@/hooks/usePersonalRemindersDue";
import { usePendingImports } from "@/hooks/usePendingImports";
import { useIntelligenceOverview } from "@/hooks/useIntelligenceOverview";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/context/AuthContext";
import { mergeDashboardActions } from "@/utils/dashboardActions";
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
      <Skeleton className="h-6 w-40 bg-[#E5E7EB]" />
      <Skeleton className="h-56 w-full rounded-xl bg-[#F3F4F6]" />
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

  const { reminders: rawReminders, loading: remindersLoading } = useReminders(200);
  const { items: personalReminders, loading: personalLoading } = usePersonalRemindersDue(50);
  const { sessions: pendingImports, loading: importsLoading } = usePendingImports(100);
  const {
    data: intelligence,
    loading: intelligenceLoading,
    error: intelligenceError,
  } = useIntelligenceOverview({ enabled: maturity !== "empty" });

  const commercialReminders = useMemo(
    () => mergeDashboardActions(rawReminders, pendingImports, personalReminders, t, lang),
    [rawReminders, pendingImports, personalReminders, t, lang]
  );

  const actionsLoading = intelligenceLoading || remindersLoading || personalLoading || importsLoading;

  const todayActions = useMemo(() => {
    const mi = intelligence?.actions || [];
    const seen = new Set(mi.map((a) => a.link || a.id));
    const extras = commercialReminders
      .filter((r) => !seen.has(r.link) && !seen.has(r.id))
      .slice(0, 8)
      .map((r) => ({
        id: `commercial:${r.id}`,
        kind: "action",
        ruleId: r.type || "commercial",
        priority: r.priority || "medium",
        category: "commercial",
        title: r.title,
        reason: r.description || "",
        date: r.date,
        link: r.link,
        clientId: r.clientId,
        clientName: r.clientName,
      }));
    return [...mi, ...extras];
  }, [intelligence, commercialReminders]);

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
    hasOnboardingSteps && todayActions.length === 0 && !actionsLoading && maturity !== "active";
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
          <Suspense fallback={<AnalyticsFallback />}>
            <DashboardAnalyticsSection
              series={series}
              loading={listsLoading}
              period={period}
              onPeriodChange={setPeriod}
              empty={emptyAnalytics}
            />
          </Suspense>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 md:gap-4">
            <div className="xl:col-span-3 min-w-0">
              <DashboardPipelineCard
                pipeline={pipeline}
                loading={listsLoading}
                periodMeta={periodMeta}
              />
            </div>
            <div className="xl:col-span-2 min-w-0">
              <DashboardActionCenterCard
                actions={todayActions}
                loading={actionsLoading}
                error={intelligenceError}
                onboardingHint={showOnboardingGuidance}
              />
            </div>
          </div>

          {topClients?.length > 0 || dataLoading ? (
            <TopClients clients={topClients.slice(0, 5)} loading={dataLoading} />
          ) : null}

          <DashboardQuickActions compact />

          <ActivityFeed
            limit={6}
            compact
            muted
            showViewAll
            showHeader
            showEmptyState={false}
            viewAllPath="/dashboard/timeline"
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
