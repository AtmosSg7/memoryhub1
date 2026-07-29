import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { recordInvoicePayment, markInvoicePaid } from "@/lib/invoicesApi";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  NESTED_MODAL_CONTENT_CLASS,
  NESTED_MODAL_OVERLAY_CLASS,
  FORM_FIELD_CLASS,
  FORM_LABEL_CLASS,
  FORM_SELECT_CONTENT_CLASS,
  DETAIL_MODAL_HEADER_CLASS,
  DETAIL_MODAL_TITLE_CLASS,
  WorkflowModalFooter,
} from "@/components/dashboard/detailModalLayout";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PAYMENT_METHODS,
  centsToEurosInput,
  eurosToCents,
  formatInvoiceAmount,
  getInvoiceAmountDue,
  toDatetimeLocalValue,
  datetimeLocalToIso,
} from "@/utils/invoiceDisplay";

export default function InvoicePaymentModal({ invoice, open, onOpenChange, onUpdated }) {
  const { t, lang } = useDashboardLang();
  const { notifyInvoicesChanged } = useAddInvoice();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [method, setMethod] = useState("transfer");
  const [submitting, setSubmitting] = useState(false);
  const [amountError, setAmountError] = useState("");

  const amountDue = invoice ? getInvoiceAmountDue(invoice) : 0;

  useEffect(() => {
    if (!open || !invoice) return;
    setAmount(centsToEurosInput(amountDue));
    setPaidAt(toDatetimeLocalValue(new Date().toISOString()));
    setMethod("transfer");
    setAmountError("");
  }, [open, invoice, amountDue]);

  if (!invoice) return null;

  const validatePartialAmount = () => {
    const trimmed = amount.trim();
    if (!trimmed) {
      setAmountError(t("invoicePayment.errors.amountRequired"));
      return false;
    }
    const cents = eurosToCents(amount);
    if (!Number.isFinite(cents) || cents <= 0) {
      setAmountError(t("invoicePayment.errors.amountInvalid"));
      return false;
    }
    if (cents > amountDue) {
      setAmountError(t("invoicePayment.errors.amountTooHigh"));
      return false;
    }
    setAmountError("");
    return true;
  };

  const handleSubmit = async (payFull = false) => {
    if (!payFull && !validatePartialAmount()) return;
    setSubmitting(true);
    try {
      const updated = payFull
        ? await markInvoicePaid(invoice.id)
        : await recordInvoicePayment(invoice.id, {
            amount: eurosToCents(amount),
            paidAt: datetimeLocalToIso(paidAt) || paidAt,
            method,
          });
      notifyInvoicesChanged();
      onUpdated?.(updated);
      toast.success(t("toast.invoicePaymentRecorded"), { description: invoice.number });
      onOpenChange(false);
    } catch (err) {
      toastApiError(err, t, "toast.invoicePaymentError");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName={NESTED_MODAL_OVERLAY_CLASS} className={NESTED_MODAL_CONTENT_CLASS} data-testid="invoice-payment-modal">
        <DialogHeader className={DETAIL_MODAL_HEADER_CLASS}>
          <DialogTitle className={DETAIL_MODAL_TITLE_CLASS}>{t("invoicePayment.title")}</DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {invoice.number} · {t("invoicePayment.remaining")} {formatInvoiceAmount(amountDue, lang)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label className={FORM_LABEL_CLASS}>{t("invoicePayment.amount")}</Label>
            <Input
              className={FORM_FIELD_CLASS}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (amountError) setAmountError("");
              }}
              autoFocus
              data-testid="invoice-payment-amount"
            />
            {amountError ? <p className="text-xs text-[#991B1B]">{amountError}</p> : null}
          </div>
          <div className="space-y-2">
            <Label className={FORM_LABEL_CLASS}>{t("invoicePayment.date")}</Label>
            <Input type="datetime-local" className={FORM_FIELD_CLASS} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className={FORM_LABEL_CLASS}>{t("invoicePayment.method")}</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className={FORM_FIELD_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={FORM_SELECT_CONTENT_CLASS}>
                {PAYMENT_METHODS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(`invoicePayment.methods.${key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="sm:col-span-2 text-[11px] text-[#9CA3AF]">{t("invoicePayment.partialHint")}</p>
        </div>

        <WorkflowModalFooter>
          <ActionButton variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("actions.close")}
          </ActionButton>
          <ActionButton variant="primary" onClick={() => handleSubmit(true)} disabled={submitting || amountDue <= 0} className="gap-1.5" data-testid="invoice-payment-full">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t("invoicePayment.payFull")}
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => handleSubmit(false)} disabled={submitting || amountDue <= 0} className="gap-1.5" data-testid="invoice-payment-partial">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t("invoicePayment.submit")}
          </ActionButton>
        </WorkflowModalFooter>
      </DialogContent>
    </Dialog>
  );
}
