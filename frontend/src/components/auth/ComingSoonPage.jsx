import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { LOGOUT } from "@/constants/testIds/auth";

export const ComingSoonPage = ({ pageKey }) => {
  const { t } = useLang();
  const { user, logout } = useAuth();

  return (
    <div className="App min-h-screen flex flex-col bg-white">
      <header className="border-b border-[#EEF0F3] bg-white/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 md:px-10 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#4F46E5] to-[#0EA5E9] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" strokeWidth={2.4} />
            </div>
            <span className="font-display text-[17px] font-bold tracking-tight text-[#0A0A0B]">MemoryHub</span>
          </Link>
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
        <div className="relative card-soft p-8 md:p-10 max-w-lg w-full text-center">
          <p className="pill mx-auto">{t(`auth.${pageKey}.badge`)}</p>
          <h1 className="mt-5 font-display text-[28px] md:text-[32px] font-black text-[#0A0A0B] tracking-[-0.03em]">
            {t(`auth.${pageKey}.title`)}
          </h1>
          <p className="mt-3 text-[15px] text-[#52535E] leading-[1.6]">
            {t(`auth.${pageKey}.subtitle`)}
          </p>
          {user && (
            <p className="mt-4 text-[13px] text-[#8A8F98]">
              {t("auth.dashboard.welcome").replace("{name}", user.firstName)}
            </p>
          )}
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 mt-8 text-[13px] font-medium text-[#4F46E5] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("auth.layout.backDashboard")}
          </Link>
        </div>
      </main>
    </div>
  );
};
