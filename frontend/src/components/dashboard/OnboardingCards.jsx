import { Users, FileText, Receipt, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddClient } from "@/context/AddClientContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { ActionButton } from "@/components/dashboard/ActionButton";

const STEPS = [
  { key: "client", icon: Users, variant: "primary" },
  { key: "quote", icon: FileText, variant: "secondary" },
  { key: "invoice", icon: Receipt, variant: "secondary" },
  { key: "import", icon: Upload, variant: "secondary" },
];

export default function OnboardingCards({ onboarding, hasClients = false, compact = false }) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();
  const { openAddClient } = useAddClient();
  const { openAddQuote } = useAddQuote();
  const { openAddInvoice } = useAddInvoice();

  const visibleSteps = STEPS.filter(({ key }) => {
    if (key === "client") return onboarding.needsClient;
    if (key === "quote") return onboarding.needsQuote;
    if (key === "invoice") return onboarding.needsInvoice;
    if (key === "import") return onboarding.needsImport;
    return false;
  });

  if (visibleSteps.length === 0) return null;

  const handlers = {
    client: openAddClient,
    quote: () => (hasClients ? openAddQuote() : openAddClient("quote")),
    invoice: () => (hasClients ? openAddInvoice() : openAddClient("invoice")),
    import: () => navigate("/dashboard/files?import=1"),
  };

  if (compact) {
    return (
      <section
        className="rounded-xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3"
        data-testid="dashboard-onboarding"
      >
        <p className="text-xs font-medium text-[#1E40AF] mb-2">{t("onboarding.progressSubtitle")}</p>
        <div className="flex flex-wrap gap-2">
          {visibleSteps.map(({ key, icon: Icon, variant }) => (
            <ActionButton
              key={key}
              variant={variant}
              onClick={handlers[key]}
              className="gap-1.5 h-8 text-xs"
              data-testid={`onboarding-step-${key}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t(`onboarding.steps.${key}.cta`)}
            </ActionButton>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-[#DBEAFE] bg-gradient-to-br from-[#EFF6FF] to-white p-6 md:p-8"
      data-testid="dashboard-onboarding"
    >
      <h2 className="font-cabinet text-xl md:text-2xl font-bold text-[#111827] tracking-tight">
        {t("onboarding.title")}
      </h2>
      <p className="text-sm text-[#4B5563] mt-2 max-w-xl">{t("onboarding.subtitle")}</p>

      <div
        className={[
          "grid gap-3 mt-6",
          visibleSteps.length === 1
            ? "grid-cols-1 max-w-sm"
            : visibleSteps.length === 2
              ? "grid-cols-1 md:grid-cols-2"
              : "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
        ].join(" ")}
      >
        {visibleSteps.map(({ key, icon: Icon, variant }, index) => (
          <div
            key={key}
            className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-col gap-3"
            data-testid={`onboarding-step-${key}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[#0A2540] text-white text-xs font-bold flex items-center justify-center">
                {index + 1}
              </span>
              <Icon className="w-4 h-4 text-[#0A2540]" strokeWidth={1.75} />
              <span className="font-medium text-sm text-[#111827]">{t(`onboarding.steps.${key}.title`)}</span>
            </div>
            <p className="text-xs text-[#6B7280] leading-relaxed flex-1">
              {!hasClients && (key === "quote" || key === "invoice")
                ? t("onboarding.requiresClient")
                : t(`onboarding.steps.${key}.desc`)}
            </p>
            <ActionButton variant={variant} onClick={handlers[key]} className="w-full justify-center text-xs h-9">
              {t(`onboarding.steps.${key}.cta`)}
            </ActionButton>
          </div>
        ))}
      </div>
      {hasClients && (onboarding.needsQuote || onboarding.needsInvoice) ? (
        <p
          className="mt-4 text-xs text-[#1E40AF] bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg px-3 py-2.5 leading-relaxed"
          data-testid="onboarding-portal-tip"
        >
          {t("onboarding.portalTip")}
        </p>
      ) : null}
    </section>
  );
}
