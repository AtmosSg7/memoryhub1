import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { recordInvoicePayment, markInvoicePaid } from "@/lib/invoicesApi";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  DETAIL_MODAL_CONTENT_CLASS,
  DETAIL_MODAL_OVERLAY_CLASS,
  FORM_FIELD_CLASS,
  FORM_LABEL_CLASS,
  FORM_SELECT_CONTENT_CLASS,
} from "@/components/dashboard/detailModalLayout";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const amountDue = invoice ? getInvoiceAmountDue(invoice) : 0;

  useEffect(() => {
    if (!open || !invoice) return;
    setAmount(centsToEurosInput(amountDue));
    setPaidAt(toDatetimeLocalValue(new Date().toISOString()));
    setMethod("transfer");
  }, [open, invoice, amountDue]);

  if (!invoice) return null;

  const handleSubmit = async (payFull = false) => {
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
      toast.error(err.message || t("toast.invoicePaymentError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName={DETAIL_MODAL_OVERLAY_CLASS} className={DETAIL_MODAL_CONTENT_CLASS} data-testid="invoice-payment-modal">
        <DialogHeader>
          <DialogTitle className="font-cabinet text-xl font-bold text-[#111827]">{t("invoicePayment.title")}</DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {invoice.number} · {t("invoicePayment.remaining")} {formatInvoiceAmount(amountDue, lang)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label className={FORM_LABEL_CLASS}>{t("invoicePayment.amount")}</Label>
            <Input className={FORM_FIELD_CLASS} value={amount} onChange={(e) => setAmount(e.target.value)} />
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
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
          <ActionButton variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("actions.close")}
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => handleSubmit(true)} disabled={submitting || amountDue <= 0} className="gap-1.5">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t("invoicePayment.payFull")}
          </ActionButton>
          <ActionButton variant="primary" onClick={() => handleSubmit(false)} disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t("invoicePayment.submit")}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
