import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const actionButtonVariants = {
  primary:
    "h-10 px-4 rounded-lg bg-[var(--dash-cta)] hover:bg-[var(--dash-cta-hover)] text-[var(--dash-cta-text)] shadow-sm border-transparent font-medium transition-colors",
  secondary:
    "h-10 px-4 rounded-lg border-dash-border bg-dash-surface text-dash-text hover:bg-dash-surface-muted hover:border-dash-border font-medium shadow-none transition-colors",
  quick:
    "h-8 px-3 text-xs font-semibold rounded-lg border border-dash-border bg-dash-surface text-dash-text hover:bg-dash-surface-muted shadow-none transition-colors",
  success:
    "h-8 px-3 text-xs font-semibold rounded-lg border border-[color:var(--dash-success-border)] bg-[color:var(--dash-success-bg)] text-[color:var(--dash-success-text)] hover:opacity-90 shadow-none",
  accent:
    "h-8 px-3 text-xs font-semibold rounded-lg border border-[color:var(--dash-info-border)] bg-dash-accent-soft text-dash-accent hover:opacity-90 shadow-none",
  ghostIcon:
    "h-8 w-8 p-0 rounded-lg text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-muted border-transparent shadow-none transition-colors",
  dangerIcon:
    "h-8 w-8 p-0 rounded-lg text-[color:var(--dash-danger-text)] hover:bg-[color:var(--dash-danger-bg)] border-transparent shadow-none",
  dangerText:
    "h-8 px-3 text-xs font-semibold rounded-lg border border-[color:var(--dash-danger-border)] bg-dash-surface text-[color:var(--dash-danger-text)] hover:bg-[color:var(--dash-danger-bg)] shadow-none",
  ghost:
    "h-9 px-3 text-sm font-medium rounded-lg border-transparent bg-transparent text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-muted shadow-none transition-colors",
};

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
