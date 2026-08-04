import { NavLink } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getSidebarItems } from "@/components/dashboard/sidebarNav";

export default function MobileNavSheet({ open, onOpenChange }) {
  const { t } = useDashboardLang();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[min(100%,20rem)] p-0 flex flex-col" data-testid="mobile-nav-sheet">
        <SheetHeader className="px-5 pt-6 pb-4 border-b border-dash-border-soft text-left">
          <SheetTitle className="font-cabinet text-[15px] font-bold text-dash-primary">Basera</SheetTitle>
          <p className="text-[11px] text-dash-text-muted font-normal">{t("brand.tagline")}</p>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {getSidebarItems(t).map((item) => (
              <li key={item.key}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  data-testid={`mobile-nav-${item.key}`}
                  onClick={() => onOpenChange(false)}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                      isActive
                        ? "bg-[var(--dash-nav-active-bg)] text-[var(--dash-nav-active-text)] font-medium"
                        : "text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-muted",
                    ].join(" ")
                  }
                >
                  <item.icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
