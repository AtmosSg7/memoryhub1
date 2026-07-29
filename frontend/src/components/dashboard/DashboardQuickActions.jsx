import { memo } from "react";
import {
  FileText,
  Receipt,
  UserPlus,
  Upload,
  Contact,
  Mail,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddClient } from "@/context/AddClientContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";

const ACTIONS = [
  {
    id: "client",
    icon: UserPlus,
    labelKey: "dashboardV2.quickActions.client",
    handler: (_navigate, { openAddClient }) => openAddClient(),
  },
  {
    id: "quote",
    icon: FileText,
    labelKey: "dashboardV2.quickActions.quote",
    handler: (_navigate, { openAddQuote }) => openAddQuote(),
  },
  {
    id: "invoice",
    icon: Receipt,
    labelKey: "dashboardV2.quickActions.invoice",
    handler: (_navigate, { openAddInvoice }) => openAddInvoice(),
  },
  {
    id: "import",
    icon: Upload,
    labelKey: "dashboardV2.quickActions.import",
    handler: (navigate) => navigate("/dashboard/files?import=1"),
  },
  {
    id: "contacts",
    icon: Contact,
    labelKey: "dashboardV2.quickActions.googleContacts",
    handler: (navigate) => navigate("/dashboard/integrations"),
  },
  {
    id: "gmail",
    icon: Mail,
    labelKey: "dashboardV2.quickActions.gmailSync",
    handler: (navigate) => navigate("/dashboard/integrations"),
  },
];

function DashboardQuickActions({ compact = true }) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();
  const { openAddClient } = useAddClient();
  const { openAddQuote } = useAddQuote();
  const { openAddInvoice } = useAddInvoice();

  const handlers = { openAddClient, openAddQuote, openAddInvoice };

  return (
    <section className="space-y-2" data-testid="dashboard-quick-actions-section">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
        {t("dashboardV2.quickActions.label")}
      </p>
      <div
        className="flex flex-wrap gap-1.5"
        data-testid="dashboard-quick-actions"
        role="group"
        aria-label={t("dashboardV2.quickActions.label")}
      >
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => action.handler(navigate, handlers)}
              data-testid={
                action.id === "quote"
                  ? "dashboard-hero-primary"
                  : `dashboard-quick-action-${action.id}`
              }
              className={[
                "inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white",
                "text-[#4B5563] hover:text-[#111827] hover:border-[#D1D5DB] hover:bg-[#FAFAFA]",
                "transition-colors",
                compact ? "px-2.5 py-1.5 text-xs font-medium" : "px-3 py-2 text-sm font-medium",
              ].join(" ")}
            >
              <Icon className="w-3.5 h-3.5 text-[#9CA3AF]" strokeWidth={1.75} />
              {t(action.labelKey)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default memo(DashboardQuickActions);
