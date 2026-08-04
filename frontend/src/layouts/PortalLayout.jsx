import { AlertCircle, Loader2, ShieldCheck, WifiOff } from "lucide-react";
import PortalLangToggle from "@/components/portal/PortalLangToggle";

export default function PortalLayout({ children, title, subtitle, brandName, footerLabel, lang, setLang }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <header className="border-b border-[#E5E7EB] bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-cabinet text-lg font-bold text-[#0A2540] tracking-tight truncate">
              {brandName || "Basera"}
            </p>
            {subtitle ? <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p> : null}
            {brandName ? (
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF] mt-1">
                Basera
              </p>
            ) : null}
          </div>
          {lang && setLang ? (
            <PortalLangToggle lang={lang} setLang={setLang} ariaLabel={lang === "fr" ? "Langue" : "Language"} />
          ) : null}
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 md:py-10">
        {title ? <h1 className="sr-only">{title}</h1> : null}
        {children}
      </main>
      <footer className="border-t border-[#E5E7EB] bg-white py-5">
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-[#6B7280]">
          {footerLabel ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-[#9CA3AF]" aria-hidden="true" />
              {footerLabel}
            </>
          ) : (
            "Basera"
          )}
        </p>
      </footer>
    </div>
  );
}

export function PortalLoader({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-sm text-[#6B7280]">
      <Loader2 className="w-7 h-7 animate-spin text-[#0A2540] mb-3 shrink-0" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function PortalSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 md:p-6 space-y-3">
        <div className="h-3 w-28 rounded bg-[#F3F4F6]" />
        <div className="h-8 w-56 max-w-full rounded bg-[#F3F4F6]" />
        <div className="h-4 w-full rounded bg-[#F3F4F6]" />
        <div className="h-3 w-40 rounded bg-[#F3F4F6]" />
      </div>
      <div className="space-y-3">
        <div className="h-5 w-24 rounded bg-[#F3F4F6]" />
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-3">
          <div className="h-4 w-32 rounded bg-[#F3F4F6]" />
          <div className="h-3 w-full rounded bg-[#F3F4F6]" />
          <div className="h-3 w-2/3 rounded bg-[#F3F4F6]" />
        </div>
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-3">
          <div className="h-4 w-28 rounded bg-[#F3F4F6]" />
          <div className="h-3 w-full rounded bg-[#F3F4F6]" />
          <div className="h-3 w-1/2 rounded bg-[#F3F4F6]" />
        </div>
      </div>
    </div>
  );
}

export function PortalError({ title, message, icon: Icon = AlertCircle }) {
  return (
    <div
      className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-5 py-8 text-center"
      role="alert"
    >
      <div className="w-11 h-11 rounded-full bg-white border border-[#FECACA] flex items-center justify-center mx-auto mb-4">
        <Icon className="w-5 h-5 text-[#DC2626]" aria-hidden="true" />
      </div>
      {title ? (
        <p className="font-cabinet text-base font-semibold text-[#991B1B] mb-1.5">{title}</p>
      ) : null}
      <p className="text-sm text-[#991B1B]/90 leading-relaxed max-w-sm mx-auto">{message}</p>
    </div>
  );
}

export function PortalNetworkError(props) {
  return <PortalError icon={WifiOff} {...props} />;
}
