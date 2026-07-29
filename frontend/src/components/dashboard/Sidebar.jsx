import { NavLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { getSidebarItems } from "@/components/dashboard/sidebarNav";

export default function Sidebar() {
  const { t } = useDashboardLang();
  const navigate = useNavigate();

  return (
    <aside
      className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-white border-r border-[#E5E7EB] z-40"
      data-testid="sidebar-root"
    >
      <div className="px-5 pt-6 pb-5 border-b border-[#F3F4F6]">
        <div className="flex items-center gap-2.5" data-testid="sidebar-brand">
          <div className="w-9 h-9 rounded-lg bg-[#0A2540] flex items-center justify-center relative overflow-hidden">
            <span className="font-cabinet text-white text-base font-bold">M</span>
            <div className="absolute -right-1 -top-1 w-3 h-3 rounded-full bg-[#0066FF] animate-soft-pulse" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-cabinet text-[15px] font-bold text-[#0A2540]">
              MemoryHub
            </span>
            <span className="text-[11px] text-[#6B7280]">
              {t("brand.tagline")}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {getSidebarItems(t).map((item) => (
            <li key={item.key}>
              <NavLink
                to={item.to}
                end={item.end}
                data-testid={`sidebar-nav-${item.key}`}
                className={({ isActive }) =>
                  [
                    "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                    isActive
                      ? "bg-[#0A2540] text-white font-medium shadow-[0_1px_2px_rgba(10,37,64,0.16)]"
                      : "text-[#4B5563] hover:text-[#111827] hover:bg-[#F3F4F6]",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className="w-[18px] h-[18px]"
                      strokeWidth={isActive ? 2 : 1.75}
                    />
                    <span className="flex-1">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-3 border-t border-[#F3F4F6]">
        <div
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#0A2540] to-[#173A5E] p-4 text-white"
          data-testid="sidebar-upgrade-card"
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-[#0066FF]/25 blur-2xl" />
          <div className="relative flex items-start gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-[#7BB8FF]" />
            <span className="text-[11px] uppercase tracking-widest text-white/70">
              MemoryHub AI
            </span>
          </div>
          <p className="relative text-[13px] leading-snug text-white/90">
            {t("sidebar.upgrade.body")}
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard/billing")}
            className="relative inline-flex mt-3 text-[11px] font-semibold text-white uppercase tracking-wide hover:underline"
            data-testid="sidebar-upgrade-cta"
          >
            {t("sidebar.upgrade.cta")}
          </button>
        </div>
      </div>
    </aside>
  );
}
