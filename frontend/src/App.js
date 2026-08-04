import React, { Suspense } from "react";

import "@/App.css";

import { BrowserRouter, Routes, Route, useNavigate, Navigate } from "react-router-dom";

import { Toaster } from "sonner";

import { LanguageProvider } from "@/context/LanguageContext";

import { AuthProvider, useAuth } from "@/context/AuthContext";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import { Navbar } from "@/components/Navbar";

import { Hero } from "@/components/Hero";

import { ProductShowcase } from "@/showcase/ProductShowcase";

import { Features } from "@/components/Features";

import { HowItWorks } from "@/components/HowItWorks";

import { Pricing } from "@/components/Pricing";
import { PricingComparison } from "@/components/PricingComparison";

import { Faq } from "@/components/Faq";

import { FinalCta } from "@/components/FinalCta";

import { Footer } from "@/components/Footer";

import LegalNotice from "@/pages/LegalNotice";

import PrivacyPolicy from "@/pages/PrivacyPolicy";

import TermsOfService from "@/pages/TermsOfService";

import CookiePolicy from "@/pages/CookiePolicy";

import Login from "@/pages/Login";

import Register from "@/pages/Register";

import ForgotPassword from "@/pages/ForgotPassword";

import ResetPassword from "@/pages/ResetPassword";

import VerifyEmail from "@/pages/VerifyEmail";

import NotFoundPage from "@/pages/NotFoundPage";

import ClientPortalPage from "@/pages/portal/ClientPortalPage";

import DashboardLayout from "@/layouts/DashboardLayout";

import DashboardHome from "@/pages/dashboard/DashboardHome";

const ClientsPage = React.lazy(() => import("@/pages/dashboard/ClientsPage"));

const ClientDetailPage = React.lazy(() => import("@/pages/dashboard/ClientDetailPage"));

const SearchPage = React.lazy(() => import("@/pages/dashboard/SearchPage"));

const NotesPage = React.lazy(() => import("@/pages/dashboard/NotesPage"));

const LegacyCommercialDocumentsRedirect = React.lazy(
  () => import("@/pages/dashboard/LegacyCommercialDocumentsRedirect")
);

const CommercialDocumentsPage = React.lazy(() => import("@/pages/dashboard/CommercialDocumentsPage"));

const AnalyticsPage = React.lazy(() => import("@/pages/dashboard/AnalyticsPage"));

const FileLibraryPage = React.lazy(() => import("@/pages/dashboard/DocumentsPage"));

const TimelinePage = React.lazy(() => import("@/pages/dashboard/TimelinePage"));

const CommunicationsPage = React.lazy(() => import("@/pages/dashboard/CommunicationsPage"));

const IntegrationsPage = React.lazy(() => import("@/pages/dashboard/IntegrationsPage"));

const CatalogPage = React.lazy(() => import("@/pages/dashboard/CatalogPage"));

const DashboardSettingsPage = React.lazy(() => import("@/pages/dashboard/SettingsPage"));
const CompanySettingsPage = React.lazy(() => import("@/pages/dashboard/CompanySettingsPage"));
const BillingPage = React.lazy(() => import("@/pages/dashboard/BillingPage"));
const AiUsageHistoryPage = React.lazy(() => import("@/pages/dashboard/AiUsageHistoryPage"));

import { AdminRoute } from "@/components/auth/AdminRoute";
import AdminLayout from "@/layouts/AdminLayout";
const AdminOverviewPage = React.lazy(() => import("@/pages/admin/AdminOverviewPage"));
const AdminUsersPage = React.lazy(() => import("@/pages/admin/AdminUsersPage"));
const AdminUserDetailPage = React.lazy(() => import("@/pages/admin/AdminUserDetailPage"));
const AdminSubscriptionsPage = React.lazy(() => import("@/pages/admin/AdminSubscriptionsPage"));
const AdminAiCreditsPage = React.lazy(() => import("@/pages/admin/AdminAiCreditsPage"));
const AdminImportsPage = React.lazy(() => import("@/pages/admin/AdminImportsPage"));
const AdminEmailsPage = React.lazy(() => import("@/pages/admin/AdminEmailsPage"));
const AdminSystemPage = React.lazy(() => import("@/pages/admin/AdminSystemPage"));



const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const goRegister = () => {
    navigate(isAuthenticated ? "/dashboard" : "/register");
  };

  const goDemo = () => {
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="App">
      <Navbar onJoin={goRegister} />
      <Hero onJoin={goRegister} onDemo={goDemo} />
      <ProductShowcase />
      <Features />
      <HowItWorks />
      <Pricing onJoin={goRegister} />
      <PricingComparison onJoin={goRegister} />
      <Faq />
      <FinalCta onJoin={goRegister} />
      <Footer />
    </div>
  );
};



function App() {

  return (

    <LanguageProvider>

      <AuthProvider>

        <BrowserRouter>

          <Routes>

            <Route path="/" element={<Landing />} />

            <Route path="/mentions-legales" element={<LegalNotice />} />

            <Route path="/politique-de-confidentialite" element={<PrivacyPolicy />} />

            <Route path="/cgu" element={<TermsOfService />} />

            <Route path="/cookies" element={<CookiePolicy />} />

            <Route path="/login" element={<Login />} />

            <Route path="/register" element={<Register />} />

            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/verify-email" element={<VerifyEmail />} />

            <Route path="/portal/:token" element={<ClientPortalPage />} />

            <Route

              path="/dashboard"

              element={

                <ProtectedRoute>

                  <DashboardLayout />

                </ProtectedRoute>

              }

            >

              <Route index element={<DashboardHome />} />

              <Route path="clients" element={<ClientsPage />} />

              <Route path="clients/:id" element={<ClientDetailPage />} />

              <Route path="search" element={<SearchPage />} />

              <Route path="notes" element={<NotesPage />} />

              <Route
                path="quotes"
                element={<LegacyCommercialDocumentsRedirect kind="quote" />}
              />

              <Route
                path="invoices"
                element={<LegacyCommercialDocumentsRedirect kind="invoice" />}
              />

              <Route path="catalog" element={<CatalogPage />} />

              <Route path="documents" element={<CommercialDocumentsPage />} />

              <Route path="analytics" element={<AnalyticsPage />} />

              <Route path="files" element={<FileLibraryPage />} />

              <Route path="communications" element={<CommunicationsPage />} />

              <Route path="timeline" element={<TimelinePage />} />

              <Route path="integrations" element={<IntegrationsPage />} />

              <Route path="settings" element={<DashboardSettingsPage />} />
              <Route path="settings/company" element={<CompanySettingsPage />} />

              <Route path="billing" element={<BillingPage />} />

              <Route path="billing/ai-history" element={<AiUsageHistoryPage />} />

            </Route>

            <Route

              path="/settings"

              element={

                <ProtectedRoute>

                  <Navigate to="/dashboard/settings" replace />

                </ProtectedRoute>

              }

            />

            <Route

              path="/billing"

              element={

                <ProtectedRoute>

                  <Navigate to="/dashboard/billing" replace />

                </ProtectedRoute>

              }

            />

            <Route

              path="/profile"

              element={

                <ProtectedRoute>

                  <Navigate to="/dashboard/settings" replace />

                </ProtectedRoute>

              }

            />

            <Route path="*" element={<NotFoundPage />} />

            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<AdminOverviewPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="users/:id" element={<AdminUserDetailPage />} />
              <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
              <Route path="ai" element={<AdminAiCreditsPage />} />
              <Route path="imports" element={<AdminImportsPage />} />
              <Route path="emails" element={<AdminEmailsPage />} />
              <Route path="system" element={<AdminSystemPage />} />
            </Route>

          </Routes>

          <Toaster position="top-right" />

        </BrowserRouter>

      </AuthProvider>

    </LanguageProvider>

  );

}



export default App;


