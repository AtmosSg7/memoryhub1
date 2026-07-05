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

export const DELETE_MODAL_OVERLAY_CLASS = "z-[100] bg-[#0A0A0B]/50 backdrop-blur-md";

export const DELETE_MODAL_CONTENT_CLASS =
  "z-[100] w-[calc(100%-2rem)] max-w-lg bg-white border border-[#E7E9EE] rounded-[22px] p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_60px_-15px_rgba(10,10,11,0.35)] sm:rounded-[22px]";

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
          <AlertDialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[#4B5563]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
          <AlertDialogCancel
            disabled={submitting}
            className="rounded-xl border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB] hover:text-[#111827]"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={submitting}
            className="rounded-xl bg-[#991B1B] text-white hover:bg-[#7F1D1D]"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
