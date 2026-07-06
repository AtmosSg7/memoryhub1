import { Users, FileText, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddClient } from "@/context/AddClientContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { ActionButton } from "@/components/dashboard/ActionButton";

const STEPS = [
  { key: "client", icon: Users, variant: "primary" },
  { key: "quote", icon: FileText, variant: "secondary" },
  { key: "import", icon: Upload, variant: "secondary" },
];

export default function BetaWelcome() {
  const { t } = useDashboardLang();
  const navigate = useNavigate();
  const { openAddClient } = useAddClient();
  const { openAddQuote } = useAddQuote();

  const handlers = {
    client: openAddClient,
    quote: () => openAddQuote(),
    import: () => navigate("/dashboard/documents?import=1"),
  };

  return (
    <section
      className="rounded-2xl border border-[#DBEAFE] bg-gradient-to-br from-[#EFF6FF] to-white p-6 md:p-8"
      data-testid="beta-welcome"
    >
      <h2 className="font-cabinet text-xl md:text-2xl font-bold text-[#111827] tracking-tight">
        {t("betaWelcome.title")}
      </h2>
      <p className="text-sm text-[#4B5563] mt-2 max-w-xl">{t("betaWelcome.subtitle")}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
        {STEPS.map(({ key, icon: Icon, variant }, index) => (
          <div
            key={key}
            className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-col gap-3"
            data-testid={`beta-welcome-step-${key}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[#0A2540] text-white text-xs font-bold flex items-center justify-center">
                {index + 1}
              </span>
              <Icon className="w-4 h-4 text-[#0A2540]" strokeWidth={1.75} />
              <span className="font-medium text-sm text-[#111827]">{t(`betaWelcome.steps.${key}.title`)}</span>
            </div>
            <p className="text-xs text-[#6B7280] leading-relaxed flex-1">{t(`betaWelcome.steps.${key}.desc`)}</p>
            <ActionButton variant={variant} onClick={handlers[key]} className="w-full justify-center text-xs h-9">
              {t(`betaWelcome.steps.${key}.cta`)}
            </ActionButton>
          </div>
        ))}
      </div>
    </section>
  );
}
