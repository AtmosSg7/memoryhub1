import { useDashboardLang } from "@/hooks/useDashboardLang";
import { NOTE_TYPES } from "@/utils/noteDisplay";
import { FILTER_PILL_CLASS } from "@/components/dashboard/detailModalLayout";
import { cn } from "@/lib/utils";

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
            className={cn(
              FILTER_PILL_CLASS.base,
              active ? FILTER_PILL_CLASS.active : FILTER_PILL_CLASS.inactive
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
