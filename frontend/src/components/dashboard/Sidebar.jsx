import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Search,
  StickyNote,
  FileText,
  Receipt,
  FolderClosed,
  Clock3,
  Plug,
  Settings,
  Sparkles,
} from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";

const groups = (t) => [
  {
    label: t("nav.section.workspace"),
    items: [
      { to: "/dashboard", key: "dashboard", icon: LayoutDashboard, label: t("nav.dashboard"), end: true },
      { to: "/dashboard/clients", key: "clients", icon: Users, label: t("nav.clients") },
      { to: "/dashboard/search", key: "search", icon: Search, label: t("nav.search") },
      { to: "/dashboard/notes", key: "notes", icon: StickyNote, label: t("nav.notes") },
    ],
  },
  {
    label: t("nav.section.pipeline"),
    items: [
      { to: "/dashboard/quotes", key: "quotes", icon: FileText, label: t("nav.quotes") },
      { to: "/dashboard/invoices", key: "invoices", icon: Receipt, label: t("nav.invoices") },
      { to: "/dashboard/documents", key: "documents", icon: FolderClosed, label: t("nav.documents") },
      { to: "/dashboard/timeline", key: "timeline", icon: Clock3, label: t("nav.timeline") },
    ],
  },
  {
    label: t("nav.section.system"),
    items: [
      { to: "/dashboard/integrations", key: "integrations", icon: Plug, label: t("nav.integrations") },
      { to: "/dashboard/settings", key: "settings", icon: Settings, label: t("nav.settings") },
    ],
  },
];

export default function Sidebar() {
  const { t } = useDashboardLang();

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

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groups(t).map((group) => (
          <div key={group.label}>
            <div className="px-3 text-[10px] uppercase tracking-[0.14em] text-[#9CA3AF] font-medium mb-2">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
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
                        {item.key === "search" && (
                          <kbd className="hidden lg:inline-flex text-[10px] px-1.5 py-0.5 rounded border border-[#E5E7EB] text-[#6B7280] bg-white group-hover:bg-white">
                            ⌘K
                          </kbd>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
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
          <p className="relative text-[13px] leading-snug text-white/90 mb-3">
            {t("sidebar.upgrade.body")}
          </p>
          <button
            className="relative w-full text-xs font-medium bg-white text-[#0A2540] rounded-md py-1.5 hover:bg-[#EFF6FF] transition-colors"
            data-testid="sidebar-upgrade-btn"
          >
            {t("common.upgrade")}
          </button>
        </div>
      </div>
    </aside>
  );
}
