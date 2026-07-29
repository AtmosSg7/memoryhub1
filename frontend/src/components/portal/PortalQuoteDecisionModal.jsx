import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PORTAL_MODAL_CONTENT_CLASS,
  PORTAL_MODAL_OVERLAY_CLASS,
} from "@/components/portal/portalModalStyles";
import { acceptPortalQuote, rejectPortalQuote } from "@/lib/portalApi";
import { formatQuoteAmount } from "@/utils/quoteDisplay";

export default function PortalQuoteDecisionModal({
  open,
  onOpenChange,
  action,
  token,
  quote,
  lang,
  t,
  onCompleted,
}) {
  const [signerName, setSignerName] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const isAccept = action === "accept";
  const canSubmit = signerName.trim().length > 0 && !busy && !done;

  const reset = () => {
    setSignerName("");
    setComment("");
    setBusy(false);
    setDone(false);
  };

  const handleOpenChange = (next) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !quote) return;
    setBusy(true);
    const body = { signerName: signerName.trim(), comment: comment.trim() || undefined };
    try {
      const result = isAccept
        ? await acceptPortalQuote(token, quote.id, body)
        : await rejectPortalQuote(token, quote.id, body);
      setDone(true);
      toast.success(isAccept ? t("portal.acceptSuccess") : t("portal.rejectSuccess"));
      onCompleted?.(result.quote);
    } catch (err) {
      if (err?.code === "quote_already_accepted") {
        toast.message(t("portal.alreadyAccepted"));
      } else if (err?.code === "quote_already_rejected") {
        toast.message(t("portal.alreadyRejected"));
      } else {
        toastApiError(err, t, isAccept ? "portal.acceptError" : "portal.rejectError");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!quote) return null;

  const title = done
    ? isAccept
      ? t("portal.acceptDoneTitle")
      : t("portal.rejectDoneTitle")
    : isAccept
      ? t("portal.acceptConfirmTitle")
      : t("portal.rejectConfirmTitle");

  const description = done
    ? isAccept
      ? t("portal.acceptDoneDesc").replace("{number}", quote.number)
      : t("portal.rejectDoneDesc").replace("{number}", quote.number)
    : isAccept
      ? t("portal.acceptConfirmDesc")
          .replace("{number}", quote.number)
          .replace("{amount}", formatQuoteAmount(quote.amountTTC, lang))
      : t("portal.rejectConfirmDesc").replace("{number}", quote.number);

  const Icon = done ? CheckCircle2 : isAccept ? CheckCircle2 : XCircle;
  const iconWrapClass = done
    ? isAccept
      ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]"
      : "bg-[#F9FAFB] border-[#E5E7EB] text-[#6B7280]"
    : isAccept
      ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]"
      : "bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent overlayClassName={PORTAL_MODAL_OVERLAY_CLASS} className={PORTAL_MODAL_CONTENT_CLASS}>
        <DialogHeader>
          <div
            className={`w-11 h-11 rounded-full border flex items-center justify-center mb-1 ${iconWrapClass}`}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-cabinet text-lg font-bold text-[#111827]">{title}</DialogTitle>
          <DialogDescription className="text-sm text-[#4B5563] leading-relaxed">{description}</DialogDescription>
        </DialogHeader>

        {!done ? (
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="portal-signer-name" className="text-sm font-medium text-[#374151]">
                {t("portal.signerNameLabel")}
              </Label>
              <Input
                id="portal-signer-name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder={t("portal.signerNamePlaceholder")}
                maxLength={200}
                disabled={busy}
                className="rounded-lg"
                data-testid="portal-signer-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-comment" className="text-sm font-medium text-[#374151]">
                {t("portal.commentLabel")}
              </Label>
              <Textarea
                id="portal-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("portal.commentPlaceholder")}
                maxLength={2000}
                rows={3}
                disabled={busy}
                className="rounded-lg resize-none"
                data-testid="portal-comment"
              />
            </div>
            <p className="text-xs text-[#6B7280] leading-relaxed border border-[#E5E7EB] rounded-lg bg-[#F9FAFB] px-3 py-2.5">
              {t("portal.decisionDisclaimer")}
            </p>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          {done ? (
            <ActionButton variant="primary" onClick={() => handleOpenChange(false)} className="w-full sm:w-auto">
              {t("portal.decisionClose")}
            </ActionButton>
          ) : (
            <>
              <ActionButton
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                disabled={busy}
                className="w-full sm:w-auto"
              >
                {t("portal.acceptCancel")}
              </ActionButton>
              <ActionButton
                variant={isAccept ? "success" : "dangerText"}
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full sm:w-auto"
                data-testid={isAccept ? "portal-confirm-accept" : "portal-confirm-reject"}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isAccept ? t("portal.acceptConfirm") : t("portal.rejectConfirm")}
              </ActionButton>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
