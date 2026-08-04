import { Search, MessageSquare, Copy } from "lucide-react";

const BENEFIT_ICONS = [Search, MessageSquare, Copy];

export default function IntegrationsBenefits({ t }) {
  const benefits = t("integrations.benefits.items");

  return (
    <section
      className="rounded-2xl bg-dash-bg p-6 md:p-8 ring-1 ring-[#E5E7EB]/60"
      data-testid="integrations-benefits"
    >
      <h2 className="font-cabinet text-lg font-semibold text-dash-text tracking-tight mb-6">
        {t("integrations.benefits.title")}
      </h2>
      <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(Array.isArray(benefits) ? benefits : []).map((benefit, index) => {
          const Icon = BENEFIT_ICONS[index] || Search;
          return (
            <li key={benefit} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dash-surface ring-1 ring-[#E5E7EB]/60">
                <Icon className="w-5 h-5 text-dash-primary" aria-hidden />
              </div>
              <p className="text-sm text-dash-text-muted leading-relaxed pt-2">{benefit}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
