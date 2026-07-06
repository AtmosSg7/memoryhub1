import { Loader2 } from "lucide-react";

export default function PortalLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="border-b border-[#E5E7EB] bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-cabinet text-lg font-bold text-[#0A2540] tracking-tight">MemoryHub</p>
            {subtitle ? <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p> : null}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8">
        {title ? (
          <h1 className="sr-only">{title}</h1>
        ) : null}
        {children}
      </main>
      <footer className="border-t border-[#E5E7EB] bg-white py-4">
        <p className="text-center text-xs text-[#9CA3AF]">MemoryHub</p>
      </footer>
    </div>
  );
}

export function PortalLoader() {
  return (
    <div className="flex items-center justify-center py-20 text-[#6B7280]">
      <Loader2 className="w-6 h-6 animate-spin mr-2" />
    </div>
  );
}

export function PortalError({ message }) {
  return (
    <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-5 py-8 text-center">
      <p className="text-sm text-[#991B1B]">{message}</p>
    </div>
  );
}
