import { memo } from "react";
import {
  ChevronDown,
  FileText,
  Plus,
  Receipt,
  Search,
  StickyNote,
  Upload,
  UserPlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddClient } from "@/context/AddClientContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { useAddNote } from "@/context/AddNoteContext";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRIMARY_ACTIONS = [
  {
    id: "import",
    icon: Upload,
    labelKey: "documentActions.importDocument",
    handler: (navigate) => navigate("/dashboard/documents?import=1"),
  },
  {
    id: "client",
    icon: UserPlus,
    labelKey: "dashboardV2.quickActions.client",
    handler: (_navigate, { openAddClient }) => openAddClient(),
  },
  {
    id: "note",
    icon: StickyNote,
    labelKey: "actions.createNote",
    handler: (_navigate, { openAddNote }) => openAddNote(),
  },
  {
    id: "search",
    icon: Search,
    labelKey: "dashboardV2.quickActions.search",
    handler: (navigate) => navigate("/dashboard/search"),
  },
];

function DashboardQuickActions({ compact = true }) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();
  const { openAddClient } = useAddClient();
  const { openAddQuote } = useAddQuote();
  const { openAddInvoice } = useAddInvoice();
  const { openAddNote } = useAddNote();

  const handlers = { openAddClient, openAddQuote, openAddInvoice, openAddNote };

  return (
    <section className="space-y-2" data-testid="dashboard-quick-actions-section">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-text-subtle">
        {t("dashboardV2.quickActions.label")}
      </p>
      <div
        className="flex flex-wrap items-center gap-1.5"
        data-testid="dashboard-quick-actions"
        role="group"
        aria-label={t("dashboardV2.quickActions.label")}
      >
        {PRIMARY_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => action.handler(navigate, handlers)}
              data-testid={
                action.id === "import"
                  ? "dashboard-hero-primary"
                  : `dashboard-quick-action-${action.id}`
              }
              className={[
                "inline-flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-surface",
                "text-dash-text-muted hover:text-dash-text hover:border-[#D1D5DB] hover:bg-dash-surface-muted",
                "transition-colors",
                compact ? "px-2.5 py-1.5 text-xs font-medium" : "px-3 py-2 text-sm font-medium",
                action.id === "import" ? "border-dash-primary/20 text-dash-primary font-semibold" : "",
              ].join(" ")}
            >
              <Icon className="w-3.5 h-3.5 text-dash-text-subtle" strokeWidth={1.75} />
              {t(action.labelKey)}
            </button>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="dashboard-quick-action-manual"
              className={[
                "inline-flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-surface",
                "text-dash-text-muted hover:text-dash-text hover:border-[#D1D5DB] hover:bg-dash-surface-muted",
                "transition-colors",
                compact ? "px-2.5 py-1.5 text-xs font-medium" : "px-3 py-2 text-sm font-medium",
              ].join(" ")}
            >
              <Plus className="w-3.5 h-3.5 text-dash-text-subtle" strokeWidth={1.75} />
              {t("dashboardV2.quickActions.manualAdd")}
              <ChevronDown className="w-3 h-3 text-dash-text-subtle" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => openAddQuote()} data-testid="dashboard-manual-proposal">
              <FileText className="w-4 h-4 mr-2" />
              {t("documentActions.addProposal")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAddInvoice()} data-testid="dashboard-manual-invoice">
              <Receipt className="w-4 h-4 mr-2" />
              {t("documentActions.addTrackingInvoice")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </section>
  );
}

export default memo(DashboardQuickActions);
