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

function DashboardRouteFallback() {
  const { t } = useDashboardLang();
  return <PageLoader label={t("auth.loading")} compact testId="dashboard-route-loading" />;
}

export default function DashboardLayout() {
  return (
    <AddClientProvider>
      <AddNoteProvider>
        <AddQuoteProvider>
          <AddInvoiceProvider>
          <DocumentsProvider>
          <FollowUpProvider>
          <div className="dashboard-app min-h-screen bg-[#F9FAFB] text-[#111827] font-satoshi">
            <Sidebar />
            <div className="md:pl-64">
              <Topbar />
              <main
                className="px-5 md:px-8 py-6 md:py-8 max-w-[1440px] mx-auto"
                data-testid="dashboard-main"
              >
                <div className="animate-fade-slide">
                  <Suspense fallback={<DashboardRouteFallback />}>
                    <Outlet />
                  </Suspense>
                </div>
              </main>
            </div>
            <AddClientModal />
            <AddNoteModal />
            <AddQuoteModal />
            <AddInvoiceModal />
            <WorkflowPendingOpener />
          </div>
          </FollowUpProvider>
        </DocumentsProvider>
          </AddInvoiceProvider>
        </AddQuoteProvider>
      </AddNoteProvider>
    </AddClientProvider>
  );
}
