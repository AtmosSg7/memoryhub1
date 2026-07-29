import { ActionButton } from "@/components/dashboard/ActionButton";
import EmptyState from "@/components/dashboard/EmptyState";

export const CLIENT_PANEL_CLASS = "bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-6";

export const CLIENT_LIST_ROW_CLASS =
  "py-3 flex items-center justify-between gap-3 text-sm cursor-pointer hover:bg-[#FAFAFA] -mx-2 px-2 rounded-lg transition-colors";

export const CLIENT_LIST_ROW_STATIC_CLASS =
  "py-3 flex items-center justify-between gap-3 text-sm -mx-2 px-2 rounded-lg";

export const CLIENT_NOTE_CARD_CLASS =
  "w-full text-left rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2.5 hover:border-[#0A2540]/20 transition-colors";

export const CLIENT_FILTER_WRAP_CLASS = "mb-4";

export const CLIENT_SECTION_ACTION_CLASS = "gap-1.5";

export const CLIENT_DIVIDER_LIST_CLASS = "divide-y divide-[#F3F4F6]";

export function ClientSectionAction({ icon: Icon, children, testId, ...props }) {
  return (
    <ActionButton variant="quick" className={CLIENT_SECTION_ACTION_CLASS} data-testid={testId} {...props}>
      {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
      {children}
    </ActionButton>
  );
}

export function ClientSectionLink({ children, testId, ...props }) {
  return (
    <button
      type="button"
      data-testid={testId}
      className="mt-4 text-xs font-medium text-[#0A2540] hover:underline transition-colors"
      {...props}
    >
      {children}
    </button>
  );
}

export function ClientTabEmpty({
  icon: Icon,
  filtered,
  filteredTitle,
  filteredDesc,
  title,
  cta,
  onCta,
  testId,
}) {
  return (
    <EmptyState
      compact
      inline
      icon={Icon}
      title={filtered ? filteredTitle : title}
      description={filtered ? filteredDesc : undefined}
      cta={!filtered ? cta : undefined}
      onCta={!filtered ? onCta : undefined}
      testId={testId}
    />
  );
}
