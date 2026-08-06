import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Plus, FileText, StickyNote, UserPlus, Upload } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useProspectsPendingCount } from "@/hooks/useProspectsPendingCount";
import { useActionsCount } from "@/hooks/useActions";
import { useAddClient } from "@/context/AddClientContext";
import { useAddNote } from "@/context/AddNoteContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { getMobilePrimaryNavItems } from "@/components/dashboard/sidebarNav";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

function NavBadge({ count, testId }) {
  if (!count || count < 1) return null;
  return (
    <span
      className="absolute -top-0.5 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-dash-accent text-[9px] font-bold text-[var(--dash-cta-text,#fff)] flex items-center justify-center"
      data-testid={testId}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function MobileBottomNav() {
  const { t } = useDashboardLang();
  const location = useLocation();
  const navigate = useNavigate();
  const { openAddClient } = useAddClient();
  const { openAddNote } = useAddNote();
  const { openAddQuote } = useAddQuote();
  const { total: prospectsPending } = useProspectsPendingCount({ enabled: true });
  const { total: actionsPending } = useActionsCount({ status: "pending", enabled: true });
  const badges = { prospectsPending, actionsPending };
  const [plusOpen, setPlusOpen] = useState(false);

  const items = getMobilePrimaryNavItems(t);

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-dash-border bg-dash-surface/95 backdrop-blur-md safe-area-pb"
        data-testid="mobile-bottom-nav"
        aria-label={t("nav.dashboard")}
      >
        <ul className="grid grid-cols-5 h-[3.75rem] max-w-[1440px] mx-auto px-1">
          {items.map((item) => {
            const active =
              item.end
                ? location.pathname === item.to
                : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            return (
              <li key={item.key} className="min-w-0">
                <NavLink
                  to={item.to}
                  end={item.end}
                  data-testid={`mobile-bottom-${item.key}`}
                  className={[
                    "relative flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold transition-colors",
                    active
                      ? "text-[var(--dash-nav-active-bg)]"
                      : "text-dash-text-muted hover:text-dash-text",
                  ].join(" ")}
                >
                  <span className="relative inline-flex">
                    <item.icon className="w-5 h-5" strokeWidth={active ? 2.25 : 1.75} />
                    {item.badgeKey ? (
                      <NavBadge
                        count={badges[item.badgeKey]}
                        testId={
                          item.badgeKey === "prospectsPending"
                            ? "mobile-bottom-prospects-badge"
                            : `mobile-bottom-${item.badgeKey}-badge`
                        }
                      />
                    ) : null}
                  </span>
                  <span className="truncate max-w-full leading-tight">{item.shortLabel || item.label}</span>
                </NavLink>
              </li>
            );
          })}
          <li className="min-w-0">
            <button
              type="button"
              data-testid="mobile-bottom-plus"
              aria-label={t("nav.more")}
              onClick={() => setPlusOpen(true)}
              className="flex h-full min-h-[44px] w-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold text-dash-text-muted hover:text-dash-text transition-colors"
            >
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-[var(--dash-cta)] text-[var(--dash-cta-text,#fff)] shadow-sm">
                <Plus className="w-5 h-5" strokeWidth={2.25} />
              </span>
              <span className="leading-tight">{t("nav.more")}</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={plusOpen} onOpenChange={setPlusOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 gap-0 safe-area-pb md:hidden"
          data-testid="mobile-plus-sheet"
        >
          <SheetHeader className="px-5 pt-5 pb-3 text-left border-b border-dash-border-soft">
            <SheetTitle className="font-cabinet text-lg font-bold text-dash-text">
              {t("nav.more")}
            </SheetTitle>
            <SheetDescription className="text-sm text-dash-text-muted">
              {t("mobilePlus.subtitle")}
            </SheetDescription>
          </SheetHeader>
          <ul className="p-3 space-y-1">
            {[
              {
                key: "client",
                label: t("topbar.addClient"),
                icon: UserPlus,
                testId: "mobile-plus-client",
                onClick: () => openAddClient(),
              },
              {
                key: "note",
                label: t("actions.createNote"),
                icon: StickyNote,
                testId: "mobile-plus-note",
                onClick: () => openAddNote(),
              },
              {
                key: "quote",
                label: t("clientBrief.quick.quote"),
                icon: FileText,
                testId: "mobile-plus-quote",
                onClick: () => openAddQuote(),
              },
              {
                key: "import",
                label: t("importWizard.importDocument"),
                icon: Upload,
                testId: "mobile-plus-import",
                onClick: () => navigate("/dashboard/documents?import=1"),
              },
            ].map((action) => (
              <li key={action.key}>
                <button
                  type="button"
                  data-testid={action.testId}
                  className="flex w-full min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-dash-text hover:bg-dash-surface-muted transition-colors"
                  onClick={() => {
                    setPlusOpen(false);
                    action.onClick();
                  }}
                >
                  <span className="inline-flex w-10 h-10 items-center justify-center rounded-lg bg-dash-surface-muted text-dash-primary">
                    <action.icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  </span>
                  {action.label}
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
