import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/ActionButton";

const cardBase =
  "flex flex-col h-full min-h-[320px] rounded-2xl bg-dash-surface p-6 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_4px_16px_rgba(17,24,39,0.04)] ring-1 ring-dash-border/80";

export default function ComingSoonIntegrationCard({ id, Logo, name, desc, t }) {
  const handleNotify = () => {
    toast.message(t("integrations.comingSoon.notifyToast"));
  };

  return (
    <article className={cardBase} data-testid={`coming-soon-${id}-card`}>
      <div className="flex items-start gap-4 mb-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-dash-bg ring-1 ring-dash-border/60">
          <Logo className="w-7 h-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-cabinet text-base font-semibold text-dash-text tracking-tight">{name}</h3>
          <p className="mt-1 text-sm text-dash-text-muted line-clamp-2 leading-relaxed">{desc}</p>
        </div>
      </div>

      <div className="mb-3">
        <span className="inline-flex items-center rounded-full bg-dash-accent-soft px-2.5 py-1 text-xs font-medium text-[#1D4ED8]">
          {t("integrations.comingSoon.badge")}
        </span>
      </div>

      <div className="flex-1" />

      <div className="mt-auto pt-2">
        <ActionButton
          type="button"
          variant="secondary"
          onClick={handleNotify}
          data-testid={`coming-soon-${id}-notify`}
        >
          {t("integrations.comingSoon.notify")}
        </ActionButton>
      </div>
    </article>
  );
}
