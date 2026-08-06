import { memo } from "react";
import { FolderOpen, Search, StickyNote, Upload, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddClient } from "@/context/AddClientContext";
import { useAddNote } from "@/context/AddNoteContext";

const PRIMARY_ACTIONS = [
  {
    id: "import",
    icon: Upload,
    labelKey: "documentActions.importDocument",
    handler: (navigate) => navigate("/dashboard/documents?import=1"),
  },
  {
    id: "documents",
    icon: FolderOpen,
    labelKey: "dashboardV2.quickActions.viewDocuments",
    handler: (navigate) => navigate("/dashboard/documents"),
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
  const { openAddNote } = useAddNote();

  const handlers = { openAddClient, openAddNote };

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
                action.id === "import"
                  ? "border-dash-primary/20 text-dash-primary font-semibold"
                  : "",
              ].join(" ")}
            >
              <Icon className="w-3.5 h-3.5 text-dash-text-subtle" strokeWidth={1.75} />
              {t(action.labelKey)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default memo(DashboardQuickActions);
