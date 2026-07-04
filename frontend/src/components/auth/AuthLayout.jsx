import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { Navbar } from "@/components/Navbar";

export const AuthLayout = ({ title, subtitle, children, backTo = "/", backLabelKey = "auth.layout.backHome" }) => {
  const { t } = useLang();

  useEffect(() => {
    document.title = `${title} | MemoryHub`;
    return () => {
      document.title = "MemoryHub";
    };
  }, [title]);

  return (
    <div className="App min-h-screen flex flex-col bg-white">
      <Navbar standalone />
      <main className="flex-1 relative hero-mesh pt-28 md:pt-36 pb-28 md:pb-36">
        <div className="absolute inset-0 grid-lines pointer-events-none opacity-60" />
        <div className="relative max-w-md mx-auto px-6 md:px-10 w-full">
          <Link
            to={backTo}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#52535E] hover:text-[#4F46E5] transition-colors duration-200 mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            {t(backLabelKey)}
          </Link>

          <div className="card-soft p-6 md:p-8">
            <header className="mb-6">
              <h1 className="font-display text-[28px] md:text-[32px] font-black text-[#0A0A0B] tracking-[-0.03em] leading-[1.1]">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 text-[14px] text-[#52535E] leading-[1.55]">{subtitle}</p>
              )}
            </header>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
