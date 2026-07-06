import * as LucideIcons from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import PageHeader from "@/components/dashboard/PageHeader";
import { integrations } from "@/data/mockData";
import { toast } from "sonner";

export default function IntegrationsPage() {
  const { t, lang } = useDashboardLang();
  usePageTitle("page.integrations.title");

  return (
    <div className="space-y-6" data-testid="integrations-page">
      <PageHeader
        title={t("page.integrations.title")}
        subtitle={t("page.integrations.subtitle")}
        testId="integrations-header"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {integrations.map((integ) => {
          const Icon = LucideIcons[integ.icon] || LucideIcons.Puzzle;
          return (
            <div
              key={integ.id}
              className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex flex-col"
              data-testid={`integration-card-${integ.id}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center text-[#0A2540]">
                  <Icon className="w-5 h-5" strokeWidth={1.75} />
                </div>
                {integ.connected ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                    {lang === "fr" ? "Connecté" : "Connected"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]">
                    {lang === "fr" ? "Disponible" : "Available"}
                  </span>
                )}
              </div>
              <h3 className="font-cabinet text-base font-semibold text-[#111827] tracking-tight">
                {integ.name}
              </h3>
              <p className="text-[12.5px] text-[#4B5563] leading-relaxed mt-1 flex-1">
                {integ.desc[lang]}
              </p>
              <button
                onClick={() => toast.message(integ.name, { description: t("toast.comingSoon") })}
                data-testid={`integration-toggle-${integ.id}`}
                className={
                  integ.connected
                    ? "mt-4 h-9 w-full rounded-md text-xs font-medium border border-[#E5E7EB] text-[#4B5563] hover:bg-[#F3F4F6] transition-colors"
                    : "mt-4 h-9 w-full rounded-md text-xs font-medium bg-[#0A2540] hover:bg-[#173A5E] text-white transition-colors"
                }
              >
                {integ.connected
                  ? lang === "fr"
                    ? "Gérer"
                    : "Manage"
                  : t("common.connect")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
