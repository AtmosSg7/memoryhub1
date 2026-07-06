import { Layers, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { formatQuoteAmount } from "@/utils/quoteDisplay";

export default function TopServices({ services, loading, compact = false }) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();

  return (
    <section
      data-testid="top-services-section"
      className={[
        "bg-white border border-[#E5E7EB] rounded-xl",
        compact ? "p-4" : "p-5 md:p-6",
      ].join(" ")}
    >
      <div className={["flex items-start justify-between", compact ? "mb-3" : "mb-5"].join(" ")}>
        <div className="flex items-center gap-3">
          {!compact && (
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] flex items-center justify-center">
              <Layers className="w-4 h-4 text-[#065F46]" strokeWidth={2} />
            </div>
          )}
          <div>
            <h3
              className={[
                "font-cabinet font-bold text-[#111827] tracking-tight",
                compact ? "text-sm" : "text-lg",
              ].join(" ")}
            >
              {t("dashboardV2.topServices.title")}
            </h3>
            {!compact && (
              <p className="text-xs text-[#6B7280] mt-0.5">{t("dashboardV2.topServices.subtitle")}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/dashboard/catalog")}
          className="text-xs font-medium text-[#0A2540] hover:text-[#173A5E]"
        >
          {t("dashboardV2.topServices.viewAll")}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-[#6B7280]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : services.length === 0 ? (
        <p className="text-sm text-[#6B7280] py-4">{t("dashboardV2.topServices.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {services.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-[#F3F4F6]"
              data-testid={`top-service-${item.id}`}
            >
              <span className="text-[11px] font-bold text-[#9CA3AF] w-4 tabular-nums">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#111827] truncate">{item.description}</p>
                <p className="text-[11px] text-[#6B7280] mt-0.5">
                  {item.usageCount} {t("dashboardV2.topServices.usages")}
                  {item.unitPriceHTAvg > 0 && (
                    <> · {formatQuoteAmount(item.unitPriceHTAvg, lang)} HT</>
                  )}
                </p>
              </div>
              <div className="shrink-0 w-12 h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#0A2540]"
                  style={{
                    width: `${Math.min(100, (item.usageCount / (services[0]?.usageCount || 1)) * 100)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
