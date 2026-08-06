import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const actionButtonVariants = {
  primary:
    "min-h-11 h-11 md:h-10 md:min-h-0 px-4 rounded-lg bg-[var(--dash-cta)] hover:bg-[var(--dash-cta-hover)] text-[var(--dash-cta-text)] shadow-sm border-transparent font-medium transition-colors",
  secondary:
    "min-h-11 h-11 md:h-10 md:min-h-0 px-4 rounded-lg border-dash-border bg-dash-surface text-dash-text hover:bg-dash-surface-muted hover:border-dash-border font-medium shadow-none transition-colors",
  quick:
    "min-h-11 h-11 md:h-8 md:min-h-0 px-3 text-sm md:text-xs font-semibold rounded-lg border border-dash-border bg-dash-surface text-dash-text hover:bg-dash-surface-muted shadow-none transition-colors",
  success:
    "min-h-11 h-11 md:h-8 md:min-h-0 px-3 text-sm md:text-xs font-semibold rounded-lg border border-[color:var(--dash-success-border)] bg-[color:var(--dash-success-bg)] text-[color:var(--dash-success-text)] hover:opacity-90 shadow-none",
  accent:
    "min-h-11 h-11 md:h-8 md:min-h-0 px-3 text-sm md:text-xs font-semibold rounded-lg border border-[color:var(--dash-info-border)] bg-dash-accent-soft text-dash-accent hover:opacity-90 shadow-none",
  ghostIcon:
    "min-h-11 min-w-11 h-11 w-11 md:h-8 md:w-8 md:min-h-0 md:min-w-0 p-0 rounded-lg text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-muted border-transparent shadow-none transition-colors",
  dangerIcon:
    "min-h-11 min-w-11 h-11 w-11 md:h-8 md:w-8 md:min-h-0 md:min-w-0 p-0 rounded-lg text-[color:var(--dash-danger-text)] hover:bg-[color:var(--dash-danger-bg)] border-transparent shadow-none",
  dangerText:
    "min-h-11 h-11 md:h-8 md:min-h-0 px-3 text-sm md:text-xs font-semibold rounded-lg border border-[color:var(--dash-danger-border)] bg-dash-surface text-[color:var(--dash-danger-text)] hover:bg-[color:var(--dash-danger-bg)] shadow-none",
  ghost:
    "min-h-11 h-11 md:h-9 md:min-h-0 px-3 text-sm font-medium rounded-lg border-transparent bg-transparent text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-muted shadow-none transition-colors",
}

export const ActionButton = React.forwardRef(function ActionButton(
  { variant = "secondary", className, ...props },
  ref
) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      className={cn(actionButtonVariants[variant], className)}
      {...props}
    />
  );
});
ActionButton.displayName = "ActionButton";
