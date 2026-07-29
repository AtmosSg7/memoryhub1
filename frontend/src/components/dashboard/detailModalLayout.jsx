export const DETAIL_MODAL_OVERLAY_CLASS = "z-[100] bg-[#0A0A0B]/50 backdrop-blur-md";

export const NESTED_MODAL_OVERLAY_CLASS = "z-[110] bg-[#0A0A0B]/55 backdrop-blur-md";

export const DETAIL_MODAL_CONTENT_CLASS =
  "z-[100] w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto bg-white border border-[#E7E9EE] rounded-[22px] p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_60px_-15px_rgba(10,10,11,0.35)] sm:rounded-[22px] [&>button]:rounded-lg [&>button]:text-[#8A8F98] [&>button]:hover:bg-black/[0.04] [&>button]:hover:opacity-100";

export const DETAIL_MODAL_FORM_CONTENT_CLASS =
  "z-[100] w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-[#E7E9EE] rounded-[22px] p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_60px_-15px_rgba(10,10,11,0.35)] sm:rounded-[22px] [&>button]:rounded-lg [&>button]:text-[#8A8F98] [&>button]:hover:bg-black/[0.04] [&>button]:hover:opacity-100";

export const NESTED_MODAL_FORM_CONTENT_CLASS =
  "z-[110] w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-[#E7E9EE] rounded-[22px] p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_60px_-15px_rgba(10,10,11,0.35)] sm:rounded-[22px] [&>button]:rounded-lg [&>button]:text-[#8A8F98] [&>button]:hover:bg-black/[0.04] [&>button]:hover:opacity-100";

const MODAL_SHELL_BASE =
  "w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto bg-white border border-[#E7E9EE] rounded-[22px] p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_60px_-15px_rgba(10,10,11,0.35)] sm:rounded-[22px] [&>button]:rounded-lg [&>button]:text-[#8A8F98] [&>button]:hover:bg-black/[0.04] [&>button]:hover:opacity-100";

export const DETAIL_MODAL_CONTENT_CLASS_2XL = `z-[100] max-w-2xl ${MODAL_SHELL_BASE}`;

export const NESTED_MODAL_CONTENT_CLASS = `z-[110] max-w-4xl ${MODAL_SHELL_BASE}`;

export const NESTED_MODAL_CONTENT_CLASS_2XL = `z-[110] max-w-2xl ${MODAL_SHELL_BASE}`;

export const DETAIL_MODAL_HEADER_CLASS = "space-y-1 pb-1";

export const DETAIL_MODAL_TITLE_CLASS =
  "font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827]";

export const FORM_FIELD_CLASS =
  "h-10 rounded-xl border border-[#E7E9EE] bg-white px-4 text-[15px] text-[#111827] shadow-none placeholder:text-[#8A8F98] focus-visible:border-[#0A2540] focus-visible:ring-2 focus-visible:ring-[#0A2540]/15";

export const FORM_TEXTAREA_CLASS = `${FORM_FIELD_CLASS} min-h-[88px] py-3 h-auto`;

export const FORM_LARGE_TEXTAREA_CLASS = `${FORM_FIELD_CLASS} min-h-[220px] py-3 h-auto resize-y`;

export const FORM_READONLY_FIELD_CLASS = `${FORM_FIELD_CLASS} bg-[#FAFAFA] read-only:cursor-default`;

export const FORM_LABEL_CLASS = "text-sm font-medium text-[#374151]";

export const FORM_SELECT_CONTENT_CLASS =
  "z-[110] rounded-xl border border-[#E7E9EE] bg-white text-[#111827] shadow-lg";

export const SEARCH_ICON_WRAPPER_CLASS = "relative w-full";

export const SEARCH_ICON_CLASS =
  "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none";

export const SEARCH_FIELD_CLASS =
  "w-full h-10 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-3 text-sm text-[#111827] shadow-none placeholder:text-[#9CA3AF] transition-colors focus:outline-none focus-visible:outline-none focus:bg-white focus-visible:border-[#0A2540] focus-visible:ring-2 focus-visible:ring-[#0A2540]/15";

export const LIST_TABLE_CONTAINER_CLASS =
  "bg-white border border-[#E5E7EB] rounded-xl overflow-hidden overflow-x-auto max-h-[min(70vh,720px)] overflow-y-auto";

export const TABLE_HEAD_ROW_CLASS = "bg-[#FAFAFA] border-b border-[#F3F4F6] sticky top-0 z-10";

export const TABLE_HEAD_CELL_CLASS =
  "text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]";

export const TABLE_BODY_ROW_CLASS =
  "border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA] transition-colors";

export const TABLE_BODY_CELL_CLASS = "px-6 py-3.5";

export const METRIC_CARD_CLASS = "bg-white border border-[#E5E7EB] rounded-xl p-4 md:p-5";

export const METRIC_LABEL_CLASS = "text-[11px] uppercase font-semibold text-[#6B7280] tracking-wider mb-1";

export const METRIC_VALUE_CLASS =
  "font-cabinet text-xl md:text-2xl font-bold text-[#111827] tracking-tight tabular-nums";

export const FILTER_PILL_CLASS = {
  base: "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border",
  active: "bg-[#0A2540] text-white border-[#0A2540]",
  inactive:
    "bg-white text-[#4B5563] border-[#E5E7EB] hover:border-[#D1D5DB] hover:bg-[#F9FAFB]",
};

export function DetailModalSummaryItem({ label, children, highlight = false }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-[#9CA3AF] font-semibold mb-1">
        {label}
      </div>
      <div
        className={[
          "truncate",
          highlight
            ? "font-cabinet text-xl font-bold text-[#0A2540] tabular-nums"
            : "text-sm font-medium text-[#111827]",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

export function DetailModalSummary({ children }) {
  return (
    <div className="rounded-xl border border-[#E7E9EE] bg-[#FAFAFA] p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{children}</div>
    </div>
  );
}

export function DetailModalSection({ title, children }) {
  return (
    <section className="space-y-2">
      {title && (
        <h4 className="text-sm font-medium text-[#374151]">{title}</h4>
      )}
      {children}
    </section>
  );
}

export function DetailModalFooter({ primary, secondary }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-[#F3F4F6] mt-2">
      <div className="flex flex-wrap items-center gap-2">{secondary}</div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end w-full sm:w-auto">{primary}</div>
    </div>
  );
}

export function WorkflowModalFooter({ children }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2 border-t border-[#F3F4F6] mt-2">
      <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto sm:justify-end">
        {children}
      </div>
    </div>
  );
}
