import { FileText, FolderClosed, LayoutGrid, Receipt, StickyNote, Clock3 } from "lucide-react";
import { FILTER_PILL_CLASS } from "@/components/dashboard/detailModalLayout";

const SECTIONS = [
  { key: "overview", icon: LayoutGrid, countKey: null },
  { key: "quotes", icon: FileText, countKey: "quotes" },
  { key: "invoices", icon: Receipt, countKey: "invoices" },
  { key: "notes", icon: StickyNote, countKey: "notes" },
  { key: "documents", icon: FolderClosed, countKey: "documents" },
  { key: "timeline", icon: Clock3, countKey: null },
];

export default function ClientSectionNav({ active, counts, t, onChange }) {
  return (
    <nav
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
      data-testid="client-section-nav"
      aria-label={t("clientDetail.sections")}
    >
      {SECTIONS.map(({ key, icon: Icon, countKey }) => {
        const isActive = active === key;
        const count = countKey ? counts[countKey] : null;
        const labelKey = key === "overview" ? "clientDetail.overview" : `nav.${key}`;

        return (
          <button
            key={key}
            type="button"
            data-testid={`client-nav-${key}`}
            onClick={() => onChange(key)}
            className={[
              FILTER_PILL_CLASS.base,
              "inline-flex items-center gap-1.5",
              isActive ? FILTER_PILL_CLASS.active : FILTER_PILL_CLASS.inactive,
            ].join(" ")}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="w-3.5 h-3.5" />
            {t(labelKey)}
            {count != null && count > 0 ? (
              <span className={isActive ? "text-white/80" : "text-[#9CA3AF]"}>({count})</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
