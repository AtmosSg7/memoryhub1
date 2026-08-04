import { Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";

export default function StartupChecklist({ checklist, onDismiss }) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();

  if (!checklist?.visible || !checklist.items?.length) return null;

  return (
    <section
      className="rounded-xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3 shadow-[0_1px_2px_rgba(10,37,64,0.04)]"
      data-testid="startup-checklist"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-dash-primary">{t("checklist.title")}</h3>
          <p className="text-[11px] text-dash-text-muted mt-0.5">
            {t("checklist.progress")
              .replace("{done}", String(checklist.doneCount))
              .replace("{total}", String(checklist.totalCount))}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-md text-dash-text-muted hover:bg-dash-surface/80 hover:text-dash-text"
          aria-label={t("checklist.dismiss")}
          data-testid="startup-checklist-dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <ul className="space-y-1.5">
        {checklist.items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={item.done}
              onClick={() => item.link && navigate(item.link)}
              className={[
                "w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                item.done
                  ? "text-dash-text-muted line-through"
                  : "text-dash-text hover:bg-dash-surface/90",
              ].join(" ")}
              data-testid={`checklist-item-${item.id}`}
            >
              <span
                className={[
                  "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                  item.done ? "bg-[var(--dash-nav-active-bg)] border-dash-primary text-white" : "border-[#93C5FD] bg-dash-surface",
                ].join(" ")}
              >
                {item.done ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : null}
              </span>
              <span className="truncate">{t(item.labelKey)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
