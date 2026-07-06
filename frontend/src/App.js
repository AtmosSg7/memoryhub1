import React, { useRef, useState } from "react";

import "@/App.css";

import { BrowserRouter, Routes, Route } from "react-router-dom";

import { Toaster } from "sonner";

import { LanguageProvider } from "@/context/LanguageContext";

import { AuthProvider } from "@/context/AuthContext";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import { Navbar } from "@/components/Navbar";

import { Hero } from "@/components/Hero";

import { SearchDemo } from "@/components/SearchDemo";

import { Features } from "@/components/Features";

import { HowItWorks } from "@/components/HowItWorks";

import { Pricing } from "@/components/Pricing";

import { Faq } from "@/components/Faq";

import { FinalCta } from "@/components/FinalCta";

import { Footer } from "@/components/Footer";

import { JoinModal } from "@/components/JoinModal";

import LegalNotice from "@/pages/LegalNotice";

import PrivacyPolicy from "@/pages/PrivacyPolicy";

import TermsOfService from "@/pages/TermsOfService";

import CookiePolicy from "@/pages/CookiePolicy";

import Login from "@/pages/Login";

import Register from "@/pages/Register";

import ForgotPassword from "@/pages/ForgotPassword";

import VerifyEmail from "@/pages/VerifyEmail";

import Settings from "@/pages/Settings";

import Billing from "@/pages/Billing";

import Profile from "@/pages/Profile";

import ClientPortalPage from "@/pages/portal/ClientPortalPage";

import DashboardLayout from "@/layouts/DashboardLayout";

import DashboardHome from "@/pages/dashboard/DashboardHome";

import ClientsPage from "@/pages/dashboard/ClientsPage";

import ClientDetailPage from "@/pages/dashboard/ClientDetailPage";

import SearchPage from "@/pages/dashboard/SearchPage";

import NotesPage from "@/pages/dashboard/NotesPage";

import QuotesPage from "@/pages/dashboard/QuotesPage";

import InvoicesPage from "@/pages/dashboard/InvoicesPage";

import DocumentsPage from "@/pages/dashboard/DocumentsPage";

import TimelinePage from "@/pages/dashboard/TimelinePage";

import CommunicationsPage from "@/pages/dashboard/CommunicationsPage";

import IntegrationsPage from "@/pages/dashboard/IntegrationsPage";

import CatalogPage from "@/pages/dashboard/CatalogPage";

import DashboardSettingsPage from "@/pages/dashboard/SettingsPage";



const Landing = () => {

  const [modalOpen, setModalOpen] = useState(false);

  const demoRef = useRef(null);



  const openJoin = () => setModalOpen(true);

  const goDemo = () => {

    const el = document.getElementById("demo");

    if (el) el.scrollIntoView({ behavior: "smooth" });

    setTimeout(() => demoRef.current?.replay?.(), 300);

  };



  return (

    <div className="App">

      <Navbar onJoin={openJoin} />

      <Hero onJoin={openJoin} onDemo={goDemo} />

      <SearchDemo ref={demoRef} />

      <Features />

      <HowItWorks />

      <Pricing onJoin={openJoin} />

      <Faq />

      <FinalCta onJoin={openJoin} />

      <Footer />

      <JoinModal open={modalOpen} onClose={() => setModalOpen(false)} />

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

              <Route path="quotes" element={<QuotesPage />} />

              <Route path="invoices" element={<InvoicesPage />} />

              <Route path="catalog" element={<CatalogPage />} />

              <Route path="documents" element={<DocumentsPage />} />

              <Route path="communications" element={<CommunicationsPage />} />

              <Route path="timeline" element={<TimelinePage />} />

              <Route path="integrations" element={<IntegrationsPage />} />

              <Route path="settings" element={<DashboardSettingsPage />} />

            </Route>

            <Route

              path="/settings"

              element={

                <ProtectedRoute>

                  <Settings />

                </ProtectedRoute>

              }

            />

            <Route

              path="/billing"

              element={

                <ProtectedRoute>

                  <Billing />

                </ProtectedRoute>

              }

            />

            <Route

              path="/profile"

              element={

                <ProtectedRoute>

                  <Profile />

                </ProtectedRoute>

              }

            />

          </Routes>

          <Toaster position="top-right" />

        </BrowserRouter>

      </AuthProvider>

    </LanguageProvider>

  );

}



export default App;


