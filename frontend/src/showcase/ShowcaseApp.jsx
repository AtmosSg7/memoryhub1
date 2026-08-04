import React, { Suspense, useLayoutEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShowcaseAuthProvider } from "@/context/AuthContext";
import { ShowcaseThemeIsolation } from "@/context/ShowcaseThemeIsolation";
import { installShowcaseApi } from "@/lib/api";
import { invalidateBillingCache } from "@/hooks/useBillingSummary";
import { invalidateCreditsCache } from "@/hooks/useCredits";
import DashboardLayout from "@/layouts/DashboardLayout";
import DashboardHome from "@/pages/dashboard/DashboardHome";
import {
  createShowcaseApiHandler,
  getShowcaseDemoUser,
} from "@/showcase/showcaseApiMock";
import { ShowcaseIsolatedRouter } from "@/showcase/ShowcaseIsolatedRouter";
import { ShowcaseExploreLock } from "@/showcase/ShowcaseExploreLock";
import { PageLoader } from "@/components/dashboard/PageFeedback";
import { useDashboardLang } from "@/hooks/useDashboardLang";

const ClientsPage = React.lazy(() => import("@/pages/dashboard/ClientsPage"));
const ClientDetailPage = React.lazy(() => import("@/pages/dashboard/ClientDetailPage"));
const CommercialDocumentsPage = React.lazy(() => import("@/pages/dashboard/CommercialDocumentsPage"));
const AnalyticsPage = React.lazy(() => import("@/pages/dashboard/AnalyticsPage"));
const CommunicationsPage = React.lazy(() => import("@/pages/dashboard/CommunicationsPage"));
const TimelinePage = React.lazy(() => import("@/pages/dashboard/TimelinePage"));
const SearchPage = React.lazy(() => import("@/pages/dashboard/SearchPage"));

function ShowcaseRouteFallback() {
  const { t } = useDashboardLang();
  return <PageLoader label={t("auth.loading")} compact testId="showcase-route-loading" />;
}

/**
 * Real Basera dashboard tree, driven by showcase DemoData (no backend).
 * Consultation only: dashboard, clients, documents, analytics, activity, search.
 */
export function ShowcaseApp({ lang = "fr" }) {
  const [apiReady, setApiReady] = useState(false);
  const user = useMemo(() => getShowcaseDemoUser(lang), [lang]);
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false, staleTime: 60_000 },
          mutations: { retry: false },
        },
      }),
    []
  );

  useLayoutEffect(() => {
    const dispose = installShowcaseApi(createShowcaseApiHandler(lang));
    setApiReady(true);
    return () => {
      dispose();
      setApiReady(false);
      invalidateBillingCache();
      invalidateCreditsCache();
      queryClient.clear();
    };
  }, [lang, queryClient]);

  if (!apiReady) {
    return (
      <div
        className="flex h-full min-h-[480px] items-center justify-center bg-dash-bg"
        data-testid="showcase-app-boot"
      >
        <PageLoader compact />
      </div>
    );
  }

  return (
    <div
      className="showcase-app h-full min-h-0 overflow-hidden bg-dash-bg text-dash-text"
      data-testid="showcase-app"
      data-dashboard-theme="light"
    >
      <QueryClientProvider client={queryClient}>
        <ShowcaseThemeIsolation>
          <ShowcaseIsolatedRouter initialEntries={["/dashboard"]}>
            <ShowcaseAuthProvider user={user}>
              <ShowcaseExploreLock>
                <Suspense fallback={<ShowcaseRouteFallback />}>
                  <Routes>
                    <Route path="/dashboard" element={<DashboardLayout />}>
                      <Route index element={<DashboardHome />} />
                      <Route path="clients" element={<ClientsPage />} />
                      <Route path="clients/:id" element={<ClientDetailPage />} />
                      <Route path="documents" element={<CommercialDocumentsPage />} />
                      <Route path="analytics" element={<AnalyticsPage />} />
                      <Route path="communications" element={<CommunicationsPage />} />
                      <Route path="timeline" element={<TimelinePage />} />
                      <Route path="search" element={<SearchPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Suspense>
              </ShowcaseExploreLock>
            </ShowcaseAuthProvider>
          </ShowcaseIsolatedRouter>
        </ShowcaseThemeIsolation>
      </QueryClientProvider>
    </div>
  );
}
