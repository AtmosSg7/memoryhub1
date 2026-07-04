import React from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, Sparkles } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { LOGOUT } from "@/constants/testIds/auth";

const Dashboard = () => {
  const { t } = useLang();
  const { user, logout } = useAuth();

  const welcome = t("auth.dashboard.welcome").replace("{name}", user?.firstName || "");

  return (
    <div className="App min-h-screen flex flex-col bg-white" data-testid="dashboard-page">
      <header className="border-b border-[#EEF0F3] bg-white/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 md:px-10 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#4F46E5] to-[#0EA5E9] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" strokeWidth={2.4} />
            </div>
            <span className="font-display text-[17px] font-bold tracking-tight text-[#0A0A0B]">MemoryHub</span>
          </div>
          <nav className="hidden sm:flex items-center gap-4 text-[13px] font-medium text-[#52535E]">
            <Link to="/profile" className="hover:text-[#0A0A0B] transition-colors">{t("auth.nav.profile")}</Link>
            <Link to="/settings" className="hover:text-[#0A0A0B] transition-colors">{t("auth.nav.settings")}</Link>
            <Link to="/billing" className="hover:text-[#0A0A0B] transition-colors">{t("auth.nav.billing")}</Link>
          </nav>
          <button
            onClick={logout}
            data-testid={LOGOUT.button}
            className="text-[13px] font-medium text-[#52535E] hover:text-[#0A0A0B] transition-colors"
          >
            {t("auth.logout")}
          </button>
        </div>
      </header>
      <main className="flex-1 relative hero-mesh flex items-center justify-center px-6 py-20">
        <div className="absolute inset-0 grid-lines pointer-events-none opacity-60" />
        <div className="relative card-soft p-8 md:p-12 max-w-xl w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F4F5F7] border border-[#E7E9EE] flex items-center justify-center mx-auto">
            <LayoutDashboard className="w-7 h-7 text-[#4F46E5]" />
          </div>
          <p className="pill mx-auto mt-6">{t("auth.dashboard.badge")}</p>
          <h1 className="mt-5 font-display text-[32px] md:text-[36px] font-black text-[#0A0A0B] tracking-[-0.03em] leading-[1.08]">
            {t("auth.dashboard.title")}
          </h1>
          <p className="mt-3 text-[15px] text-[#52535E] leading-[1.6]">{welcome}</p>
          <p className="mt-2 text-[14px] text-[#8A8F98]">{t("auth.dashboard.subtitle")}</p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
