import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/ActionButton";
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
import {
  DELETE_MODAL_CONTENT_CLASS,
  DELETE_MODAL_OVERLAY_CLASS,
} from "@/components/dashboard/DeleteConfirmDialog";
import { acceptPortalQuote } from "@/lib/portalApi";
import { formatQuoteAmount } from "@/utils/quoteDisplay";

export default function PortalAcceptQuoteButton({
  token,
  quote,
  lang,
  t,
  onAccepted,
  variant = "primary",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!quote?.canAccept) return null;

  const handleAccept = async () => {
    setBusy(true);
    try {
      const result = await acceptPortalQuote(token, quote.id);
      toast.success(t("portal.acceptSuccess"));
      setOpen(false);
      onAccepted?.(result.quote);
    } catch (err) {
      toast.error(err.message || t("portal.acceptError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ActionButton
        variant={variant}
        onClick={() => setOpen(true)}
        className={`gap-1.5 ${className}`}
        data-testid={`portal-accept-quote-${quote.id}`}
      >
        <CheckCircle2 className="w-4 h-4" />
        {t("portal.acceptQuote")}
      </ActionButton>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent overlayClassName={DELETE_MODAL_OVERLAY_CLASS} className={DELETE_MODAL_CONTENT_CLASS}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-cabinet text-lg font-bold text-[#111827]">
              {t("portal.acceptConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#4B5563]">
              {t("portal.acceptConfirmDesc")
                .replace("{number}", quote.number)
                .replace("{amount}", formatQuoteAmount(quote.amountTTC, lang))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={busy}>{t("portal.acceptCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleAccept();
              }}
              disabled={busy}
              className="bg-[#065F46] hover:bg-[#047857]"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("portal.acceptConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
