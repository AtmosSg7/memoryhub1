import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

export const DELETE_MODAL_OVERLAY_CLASS =
  "z-[100] bg-[var(--dash-overlay)] backdrop-blur-[var(--dash-overlay-blur,10px)] backdrop-saturate-150";

export const DELETE_MODAL_CONTENT_CLASS =
  "z-[100] w-[calc(100%-2rem)] max-w-lg bg-[var(--dash-modal-bg,#FFFFFF)] border border-dash-border rounded-[18px] p-6 sm:p-8 text-dash-text shadow-[var(--dash-modal-shadow)] backdrop-blur-none sm:rounded-[18px]";

export default function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onConfirm,
  submitting = false,
  testId,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        overlayClassName={DELETE_MODAL_OVERLAY_CLASS}
        className={DELETE_MODAL_CONTENT_CLASS}
        data-testid={testId}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-dash-text">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-dash-text-muted">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
          <AlertDialogCancel
            disabled={submitting}
            className="rounded-xl border-dash-border bg-dash-surface text-dash-text-muted hover:bg-dash-bg hover:text-dash-text"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={submitting}
            data-testid={testId ? `${testId}-confirm` : undefined}
            className="rounded-xl bg-[var(--dash-danger-text)] text-white hover:opacity-90 min-w-[7rem]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin inline" aria-hidden="true" />
                {confirmLabel}
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
