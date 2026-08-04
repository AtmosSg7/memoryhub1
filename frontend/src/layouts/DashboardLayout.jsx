import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import { PageLoader } from "@/components/dashboard/PageFeedback";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import AddClientModal from "@/components/dashboard/AddClientModal";
import AddNoteModal from "@/components/dashboard/AddNoteModal";
import AddQuoteModal from "@/components/dashboard/AddQuoteModal";
import AddInvoiceModal from "@/components/dashboard/AddInvoiceModal";
import WorkflowPendingOpener from "@/components/dashboard/WorkflowPendingOpener";
import { AddClientProvider } from "@/context/AddClientContext";
import { AddNoteProvider } from "@/context/AddNoteContext";
import { AddQuoteProvider } from "@/context/AddQuoteContext";
import { AddInvoiceProvider } from "@/context/AddInvoiceContext";
import { DocumentsProvider } from "@/context/DocumentsContext";
import { FollowUpProvider } from "@/context/FollowUpContext";
import { DashboardThemeProvider, useDashboardTheme } from "@/context/DashboardThemeContext";
import { useIsShowcaseDemo } from "@/context/ShowcaseThemeIsolation";

function DashboardRouteFallback() {
  const { t } = useDashboardLang();
  return <PageLoader label={t("auth.loading")} compact testId="dashboard-route-loading" />;
}

function DashboardShell() {
  const { isDark } = useDashboardTheme();
  const isShowcase = useIsShowcaseDemo();

  return (
    <div
      className={[
        "dashboard-app bg-dash-bg text-dash-text font-satoshi",
        isShowcase ? "relative h-full min-h-0 overflow-hidden" : "min-h-screen",
        isDark ? "dark" : "",
      ].join(" ")}
    >
      <Sidebar />
      <div
        className={[
          "md:pl-64",
          isShowcase ? "flex h-full min-h-0 flex-col overflow-hidden" : "",
        ].join(" ")}
        data-testid="dashboard-content-column"
      >
        <Topbar />
        <main
          className={[
            "px-5 md:px-8 py-7 md:py-9 max-w-[1440px] mx-auto w-full",
            isShowcase
              ? "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
              : "",
          ].join(" ")}
          data-testid="dashboard-main"
        >
          <div className="animate-fade-slide">
            <Suspense fallback={<DashboardRouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      {!isShowcase ? (
        <>
          <AddClientModal />
          <AddNoteModal />
          <AddQuoteModal />
          <AddInvoiceModal />
          <WorkflowPendingOpener />
        </>
      ) : null}
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <DashboardThemeProvider>
      <AddClientProvider>
        <AddNoteProvider>
          <AddQuoteProvider>
            <AddInvoiceProvider>
              <DocumentsProvider>
                <FollowUpProvider>
                  <DashboardShell />
                </FollowUpProvider>
              </DocumentsProvider>
            </AddInvoiceProvider>
          </AddQuoteProvider>
        </AddNoteProvider>
      </AddClientProvider>
    </DashboardThemeProvider>
  );
}
