import { cn } from "@/lib/utils";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { getStatusStyle, getStatusTranslationKey } from "@/utils/statusDisplay";

export default function StatusBadge({ kind, status, size = "md", dot = false, className }) {
  const { t } = useDashboardLang();
  const style = getStatusStyle(kind, status);
  const label = t(getStatusTranslationKey(kind, status));
  const sizeClass = size === "sm" ? "text-[10px]" : "text-[11px]";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium border shrink-0",
        sizeClass,
        style.bg,
        style.text,
        style.border,
        className,
      )}
    >
      {dot ? (
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} aria-hidden="true" />
      ) : null}
      {label}
    </span>
  );
}
