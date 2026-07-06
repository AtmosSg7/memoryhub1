import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { useClients } from "@/hooks/useClients";
import { createInvoice, updateInvoice } from "@/lib/invoicesApi";
import CommercialLineItemsEditor from "@/components/dashboard/CommercialLineItemsEditor";
import {
  buildLineItemsPayload,
  computeDocumentTotalsFromLines,
  createEmptyLineItem,
  lineItemsFromInvoice,
} from "@/utils/commercialDisplay";
import {
  INVOICE_STATUSES,
  datetimeLocalToIso,
  normalizeInvoiceStatus,
  toDatetimeLocalValue,
} from "@/utils/invoiceDisplay";
import InvoicePaymentAction from "@/components/dashboard/InvoicePaymentAction";
import { getDisplayCompany } from "@/utils/clientDisplay";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  DETAIL_MODAL_CONTENT_CLASS,
  DETAIL_MODAL_OVERLAY_CLASS,
  DetailModalFooter,
  FORM_FIELD_CLASS,
  FORM_LABEL_CLASS,
  FORM_SELECT_CONTENT_CLASS,
  FORM_TEXTAREA_CLASS,
} from "@/components/dashboard/detailModalLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EMPTY_FORM = {
  title: "",
  clientId: "",
  status: "in_progress",
  invoiceDate: "",
  internalNotes: "",
};

function invoiceToForm(invoice, prefillClient) {
  if (invoice) {
    return {
      title: invoice.title === "Facture sans titre" ? "" : invoice.title || "",
      clientId: invoice.clientId || "",
      status: normalizeInvoiceStatus(invoice.status),
      invoiceDate: toDatetimeLocalValue(invoice.invoiceDate || invoice.createdAt),
      internalNotes: invoice.internalNotes || "",
      lineItems: lineItemsFromInvoice(invoice),
    };
  }
  return {
    ...EMPTY_FORM,
    clientId: prefillClient?.id || "",
    invoiceDate: toDatetimeLocalValue(new Date().toISOString()),
    lineItems: [createEmptyLineItem()],
  };
}

export default function AddInvoiceModal() {
  const { t, lang } = useDashboardLang();
  const { isOpen, editingInvoice, prefillClient, closeAddInvoice, notifyInvoicesChanged } = useAddInvoice();
  const { clients } = useClients();
  const [form, setForm] = useState({ ...EMPTY_FORM, lineItems: [createEmptyLineItem()] });
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(editingInvoice);
  const clientLocked = Boolean(prefillClient && !isEdit);

  useEffect(() => {
    if (isOpen) setForm(invoiceToForm(editingInvoice, prefillClient));
  }, [isOpen, editingInvoice, prefillClient]);

  const setField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.clientId) {
      toast.error(t("invoiceForm.errors.clientRequired"));
      return;
    }

    const lineItems = buildLineItemsPayload(form.lineItems);
    if (lineItems.length === 0) {
      toast.error(t("invoiceForm.errors.lineItemsRequired"));
      return;
    }

    const totals = computeDocumentTotalsFromLines(form.lineItems);
    const payload = {
      title: form.title.trim() || undefined,
      clientId: form.clientId,
      status: form.status,
      invoiceDate: datetimeLocalToIso(form.invoiceDate),
      amountHT: totals.amountHT,
      vatRate: totals.vatRate,
      internalNotes: form.internalNotes.trim() || undefined,
      lineItems,
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateInvoice(editingInvoice.id, payload);
        toast.success(t("toast.invoiceUpdated"));
      } else {
        await createInvoice(payload);
        toast.success(t("toast.invoiceCreated"));
      }
      notifyInvoicesChanged();
      closeAddInvoice();
    } catch (err) {
      toast.error(err.message || t("toast.invoiceError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAddInvoice()}>
      <DialogContent overlayClassName={DETAIL_MODAL_OVERLAY_CLASS} className={DETAIL_MODAL_CONTENT_CLASS} data-testid="add-invoice-modal">
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827]">
            {isEdit ? t("invoiceForm.editTitle") : t("invoiceForm.addTitle")}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {isEdit ? t("invoiceForm.editSubtitle") : t("invoiceForm.addSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isEdit && editingInvoice?.number && (
            <div className="text-xs font-semibold text-[#065F46] bg-[#ECFDF5] px-3 py-2 rounded-lg">
              {editingInvoice.number}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="invoice-client" className={FORM_LABEL_CLASS}>{t("invoiceForm.client")} *</Label>
            {clientLocked ? (
              <Input id="invoice-client" readOnly value={getDisplayCompany(prefillClient)} className={`${FORM_FIELD_CLASS} bg-[#F9FAFB] text-[#6B7280]`} />
            ) : (
              <Select value={form.clientId || "none"} onValueChange={(v) => setForm((p) => ({ ...p, clientId: v === "none" ? "" : v }))}>
                <SelectTrigger data-testid="invoice-form-client" className={FORM_FIELD_CLASS}><SelectValue placeholder={t("invoiceForm.selectClient")} /></SelectTrigger>
                <SelectContent className={FORM_SELECT_CONTENT_CLASS}>
                  <SelectItem value="none">{t("invoiceForm.selectClient")}</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{getDisplayCompany(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-title" className={FORM_LABEL_CLASS}>{t("invoiceForm.title")}</Label>
            <Input id="invoice-title" value={form.title} onChange={setField("title")} className={FORM_FIELD_CLASS} placeholder={t("invoiceForm.titlePlaceholder")} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={FORM_LABEL_CLASS}>{t("invoiceForm.status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className={FORM_FIELD_CLASS}><SelectValue /></SelectTrigger>
                <SelectContent className={FORM_SELECT_CONTENT_CLASS}>
                  {INVOICE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{t(`invoiceStatus.${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-date" className={FORM_LABEL_CLASS}>{t("invoiceForm.invoiceDate")}</Label>
              <Input id="invoice-date" type="datetime-local" value={form.invoiceDate} onChange={setField("invoiceDate")} className={FORM_FIELD_CLASS} />
            </div>
          </div>

          <CommercialLineItemsEditor
            lines={form.lineItems}
            onChange={(lineItems) => setForm((prev) => ({ ...prev, lineItems }))}
            t={t}
            lang={lang}
            i18nPrefix="invoiceForm"
          />

          <div className="space-y-2">
            <Label htmlFor="invoice-notes" className={FORM_LABEL_CLASS}>{t("invoiceForm.internalNotes")}</Label>
            <Textarea id="invoice-notes" value={form.internalNotes} onChange={setField("internalNotes")} rows={3} className={FORM_TEXTAREA_CLASS} />
          </div>

          {isEdit && editingInvoice && (
            <InvoicePaymentAction
              invoice={{ ...editingInvoice, status: form.status }}
              onUpdated={(updated) => setForm((prev) => ({ ...prev, status: updated.status }))}
            />
          )}

          <DetailModalFooter
            primary={
              <ActionButton type="submit" variant="primary" disabled={submitting}>
                {submitting ? t("invoiceForm.saving") : isEdit ? t("invoiceForm.save") : t("invoiceForm.create")}
              </ActionButton>
            }
            secondary={
              <ActionButton type="button" variant="secondary" onClick={closeAddInvoice} disabled={submitting}>
                {t("invoiceForm.cancel")}
              </ActionButton>
            }
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
