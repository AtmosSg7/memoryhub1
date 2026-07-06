export const DETAIL_MODAL_OVERLAY_CLASS = "z-[100] bg-[#0A0A0B]/50 backdrop-blur-md";

export const DETAIL_MODAL_CONTENT_CLASS =
  "z-[100] w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto bg-white border border-[#E7E9EE] rounded-[22px] p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_60px_-15px_rgba(10,10,11,0.35)] sm:rounded-[22px] [&>button]:rounded-lg [&>button]:text-[#8A8F98] [&>button]:hover:bg-black/[0.04] [&>button]:hover:opacity-100";

export const DETAIL_MODAL_FORM_CONTENT_CLASS =
  "z-[100] w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-[#E7E9EE] rounded-[22px] p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_60px_-15px_rgba(10,10,11,0.35)] sm:rounded-[22px] [&>button]:rounded-lg [&>button]:text-[#8A8F98] [&>button]:hover:bg-black/[0.04] [&>button]:hover:opacity-100";

export const FORM_FIELD_CLASS =
  "h-10 rounded-xl border border-[#E7E9EE] bg-white px-4 text-[15px] text-[#111827] shadow-none placeholder:text-[#8A8F98] focus-visible:border-[#0A2540] focus-visible:ring-2 focus-visible:ring-[#0A2540]/15";

export const FORM_TEXTAREA_CLASS = `${FORM_FIELD_CLASS} min-h-[88px] py-3 h-auto`;

export const FORM_LABEL_CLASS = "text-sm font-medium text-[#374151]";

export const FORM_SELECT_CONTENT_CLASS =
  "z-[110] rounded-xl border border-[#E7E9EE] bg-white text-[#111827] shadow-lg";

export const LIST_TABLE_CONTAINER_CLASS =
  "bg-white border border-[#E5E7EB] rounded-xl overflow-hidden overflow-x-auto";

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
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">{primary}</div>
    </div>
  );
}
