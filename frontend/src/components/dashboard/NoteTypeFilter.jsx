import { useDashboardLang } from "@/hooks/useDashboardLang";
import { NOTE_TYPES } from "@/utils/noteDisplay";

export default function NoteTypeFilter({ value, onChange, testId = "note-type-filter" }) {
  const { t } = useDashboardLang();

  const options = [{ key: "", label: t("notes.filter.all") }, ...NOTE_TYPES.map((type) => ({
    key: type,
    label: t(`noteType.${type}`),
  }))];

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
      data-testid={testId}
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key || "all"}
            type="button"
            data-testid={`${testId}-${option.key || "all"}`}
            onClick={() => onChange(option.key)}
            className={[
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border",
              active
                ? "bg-[#0A2540] text-white border-[#0A2540]"
                : "bg-white text-[#4B5563] border-[#E5E7EB] hover:border-[#D1D5DB] hover:bg-[#F9FAFB]",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
