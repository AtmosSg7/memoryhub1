export const DETAIL_MODAL_OVERLAY_CLASS =
  "z-[100] bg-[var(--dash-overlay)] backdrop-blur-[var(--dash-overlay-blur,10px)] backdrop-saturate-150";

export const NESTED_MODAL_OVERLAY_CLASS =
  "z-[110] bg-[var(--dash-overlay)] backdrop-blur-[var(--dash-overlay-blur,10px)] backdrop-saturate-150";

const MODAL_CLOSE_BUTTON =
  "[&>button]:rounded-lg [&>button]:text-dash-text-subtle [&>button]:hover:bg-dash-surface-muted [&>button]:hover:opacity-100";

/** Opaque panel only — blur belongs on the overlay, never on this shell. */
const MODAL_SHELL_BASE = [
  "w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-h-[min(92vh,100dvh)] overflow-y-auto overscroll-contain",
  "border border-dash-border rounded-[18px] p-5 sm:p-8 text-dash-text",
  "bg-[var(--dash-modal-bg,#FFFFFF)] backdrop-blur-none",
  "shadow-[var(--dash-modal-shadow)] sm:rounded-[18px]",
  "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
  MODAL_CLOSE_BUTTON,
].join(" ");

export const DETAIL_MODAL_CONTENT_CLASS = `z-[100] max-w-4xl ${MODAL_SHELL_BASE}`;

export const DETAIL_MODAL_FORM_CONTENT_CLASS = `z-[100] max-w-lg ${MODAL_SHELL_BASE}`;

export const NESTED_MODAL_FORM_CONTENT_CLASS = `z-[110] max-w-lg ${MODAL_SHELL_BASE}`;

export const DETAIL_MODAL_CONTENT_CLASS_2XL = `z-[100] max-w-2xl ${MODAL_SHELL_BASE}`;

export const NESTED_MODAL_CONTENT_CLASS = `z-[110] max-w-4xl ${MODAL_SHELL_BASE}`;

export const NESTED_MODAL_CONTENT_CLASS_2XL = `z-[110] max-w-2xl ${MODAL_SHELL_BASE}`;

export const DETAIL_MODAL_HEADER_CLASS = "space-y-1 pb-1";

export const DETAIL_MODAL_TITLE_CLASS =
  "font-cabinet text-xl font-bold tracking-[-0.02em] text-dash-text";

export const FORM_FIELD_CLASS =
  "h-11 sm:h-10 rounded-xl border border-dash-border bg-[var(--dash-input-bg)] px-4 text-[16px] sm:text-[15px] text-dash-text shadow-none placeholder:text-dash-text-subtle hover:bg-[var(--dash-input-bg-hover)] focus-visible:border-dash-accent focus-visible:ring-2 focus-visible:ring-dash-accent/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const FORM_TEXTAREA_CLASS = `${FORM_FIELD_CLASS} min-h-[88px] py-3 h-auto`;

export const FORM_LARGE_TEXTAREA_CLASS = `${FORM_FIELD_CLASS} min-h-[220px] py-3 h-auto resize-y`;

export const FORM_READONLY_FIELD_CLASS =
  "h-10 rounded-xl border border-dash-border-soft bg-dash-surface-muted px-4 text-[15px] text-dash-text-muted shadow-none read-only:cursor-default";

export const FORM_LABEL_CLASS = "text-sm font-medium text-dash-text-muted";

/** Danger action in menus/dropdowns — readable on light + dark graphite. */
export const DANGER_MENU_ITEM_CLASS =
  "text-[color:var(--dash-danger-text)] focus:text-[color:var(--dash-danger-text)] focus:bg-[color:var(--dash-danger-bg)] data-[highlighted]:text-[color:var(--dash-danger-text)] data-[highlighted]:bg-[color:var(--dash-danger-bg)]";

export const FORM_SELECT_CONTENT_CLASS =
  "z-[110] rounded-xl border border-dash-border bg-dash-surface-elevated text-dash-text shadow-[var(--dash-panel-shadow)]";

export const SEARCH_ICON_WRAPPER_CLASS = "relative w-full";

export const SEARCH_ICON_CLASS =
  "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-text-subtle pointer-events-none";

export const SEARCH_FIELD_CLASS =
  "w-full h-11 md:h-10 rounded-lg border border-dash-border bg-[var(--dash-input-bg)] pl-10 pr-3 text-[16px] md:text-sm text-dash-text shadow-none placeholder:text-dash-text-subtle transition-colors focus:outline-none focus-visible:outline-none hover:bg-[var(--dash-input-bg-hover)] focus:bg-dash-surface-elevated focus-visible:border-dash-accent focus-visible:ring-2 focus-visible:ring-dash-accent/25";

export const LIST_TABLE_CONTAINER_CLASS =
  "bg-dash-surface border border-dash-border rounded-xl overflow-hidden overflow-x-auto max-h-[min(70vh,720px)] overflow-y-auto shadow-[var(--dash-card-shadow)]";

export const TABLE_HEAD_ROW_CLASS =
  "bg-dash-surface-muted border-b border-dash-border sticky top-0 z-10";

export const TABLE_HEAD_CELL_CLASS =
  "text-left px-6 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-dash-text-subtle";

export const TABLE_BODY_ROW_CLASS =
  "border-b border-dash-border-soft last:border-0 hover:bg-[color:var(--dash-accent-soft)] transition-colors";

export const TABLE_BODY_CELL_CLASS = "px-6 py-4 text-dash-text";

export const METRIC_CARD_CLASS =
  "bg-dash-surface border border-dash-border rounded-xl p-5 md:p-6 dash-card";

export const METRIC_LABEL_CLASS =
  "text-[11px] uppercase font-semibold text-dash-text-subtle tracking-wider mb-1.5";

export const METRIC_VALUE_CLASS =
  "font-cabinet text-xl md:text-2xl font-bold text-dash-text tracking-tight tabular-nums";

export const FILTER_PILL_CLASS = {
  base: "shrink-0 min-h-11 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-colors border md:min-h-0 md:px-3 md:py-1.5 md:text-xs",
  active: "bg-[var(--dash-nav-active-bg)] text-[var(--dash-nav-active-text)] border-transparent",
  inactive:
    "bg-dash-surface-muted text-dash-text-muted border-dash-border-soft hover:border-dash-border hover:text-dash-text hover:bg-dash-surface",
};

export function DetailModalSummaryItem({ label, children, highlight = false }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-dash-text-subtle font-semibold mb-1">
        {label}
      </div>
      <div
        className={[
          "truncate",
          highlight
            ? "font-cabinet text-xl font-bold text-dash-primary tabular-nums"
            : "text-sm font-medium text-dash-text",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

export function DetailModalSummary({ children }) {
  return (
    <div className="rounded-xl border border-dash-border bg-dash-surface-muted p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{children}</div>
    </div>
  );
}

export function DetailModalSection({ title, children }) {
  return (
    <section className="space-y-2">
      {title && <h4 className="text-sm font-medium text-dash-text-muted">{title}</h4>}
      {children}
    </section>
  );
}

export function DetailModalFooter({ primary, secondary }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 sm:-mx-8 mt-3 px-5 sm:px-8 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-dash-border-soft bg-[var(--dash-modal-bg,#FFFFFF)] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto [&>button]:min-h-11 sm:[&>button]:min-h-0 [&>button]:w-full sm:[&>button]:w-auto">
        {secondary}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end w-full sm:w-auto [&>button]:min-h-11 sm:[&>button]:min-h-0 [&>button]:w-full sm:[&>button]:w-auto">
        {primary}
      </div>
    </div>
  );
}

export function WorkflowModalFooter({ children }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2 border-t border-dash-border-soft mt-2">
      <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto sm:justify-end">
        {children}
      </div>
    </div>
  );
}
