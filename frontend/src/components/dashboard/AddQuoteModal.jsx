import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useClients } from "@/hooks/useClients";
import { createQuote, updateQuote } from "@/lib/quotesApi";
import QuoteLineItemsEditor from "@/components/dashboard/QuoteLineItemsEditor";
import {
  buildLineItemsPayload,
  computeDocumentTotalsFromLines,
  createEmptyLineItem,
  lineItemsFromQuote,
} from "@/utils/commercialDisplay";
import { QUOTE_STATUSES, datetimeLocalToIso, toDatetimeLocalValue } from "@/utils/quoteDisplay";
import { getDisplayCompany } from "@/utils/clientDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EMPTY_FORM = {
  title: "",
  clientId: "",
  status: "draft",
  quoteDate: "",
  internalNotes: "",
};

const MODAL_OVERLAY_CLASS = "z-[100] bg-[#0A0A0B]/50 backdrop-blur-md";
const MODAL_CONTENT_CLASS =
  "z-[100] w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto bg-white border border-[#E7E9EE] rounded-[22px] p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_60px_-15px_rgba(10,10,11,0.35)] sm:rounded-[22px] [&>button]:rounded-lg";
const FIELD_CLASS =
  "h-10 rounded-xl border border-[#E7E9EE] bg-white px-4 text-[15px] text-[#111827] shadow-none placeholder:text-[#8A8F98] focus-visible:border-[#0A2540] focus-visible:ring-2 focus-visible:ring-[#0A2540]/15";
const TEXTAREA_CLASS = `${FIELD_CLASS} min-h-[80px] py-3 h-auto`;
const LABEL_CLASS = "text-sm font-medium text-[#374151]";
const SELECT_CONTENT_CLASS = "z-[110] rounded-xl border border-[#E7E9EE] bg-white text-[#111827] shadow-lg";

function quoteToForm(quote, prefillClient) {
  if (quote) {
    return {
      title: quote.title === "Devis sans titre" ? "" : quote.title || "",
      clientId: quote.clientId || "",
      status: quote.status || "draft",
      quoteDate: toDatetimeLocalValue(quote.quoteDate || quote.createdAt),
      internalNotes: quote.internalNotes || "",
      lineItems: lineItemsFromQuote(quote),
    };
  }
  return {
    ...EMPTY_FORM,
    clientId: prefillClient?.id || "",
    quoteDate: toDatetimeLocalValue(new Date().toISOString()),
    lineItems: [createEmptyLineItem()],
  };
}

export default function AddQuoteModal() {
  const { t, lang } = useDashboardLang();
  const { isOpen, editingQuote, prefillClient, closeAddQuote, notifyQuotesChanged } = useAddQuote();
  const { clients } = useClients();
  const [form, setForm] = useState({ ...EMPTY_FORM, lineItems: [createEmptyLineItem()] });
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(editingQuote);
  const clientLocked = Boolean(prefillClient && !isEdit);

  useEffect(() => {
    if (isOpen) setForm(quoteToForm(editingQuote, prefillClient));
  }, [isOpen, editingQuote, prefillClient]);

  const setField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.clientId) {
      toast.error(t("quoteForm.errors.clientRequired"));
      return;
    }

    const lineItems = buildLineItemsPayload(form.lineItems);
    if (lineItems.length === 0) {
      toast.error(t("quoteForm.errors.lineItemsRequired"));
      return;
    }

    const totals = computeDocumentTotalsFromLines(form.lineItems);
    const payload = {
      title: form.title.trim() || undefined,
      clientId: form.clientId,
      status: form.status,
      quoteDate: datetimeLocalToIso(form.quoteDate),
      amountHT: totals.amountHT,
      vatRate: totals.vatRate,
      internalNotes: form.internalNotes.trim() || undefined,
      lineItems,
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateQuote(editingQuote.id, payload);
        toast.success(t("toast.quoteUpdated"));
      } else {
        await createQuote(payload);
        toast.success(t("toast.quoteCreated"));
      }
      notifyQuotesChanged();
      closeAddQuote();
    } catch (err) {
      toast.error(err.message || t("toast.quoteError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAddQuote()}>
      <DialogContent overlayClassName={MODAL_OVERLAY_CLASS} className={MODAL_CONTENT_CLASS} data-testid="add-quote-modal">
        <DialogHeader>
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827]">
            {isEdit ? t("quoteForm.editTitle") : t("quoteForm.addTitle")}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {isEdit ? t("quoteForm.editSubtitle") : t("quoteForm.addSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isEdit && editingQuote?.number && (
            <div className="text-xs font-semibold text-[#0A2540] bg-[#EFF6FF] px-3 py-2 rounded-lg">
              {editingQuote.number}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quote-client" className={LABEL_CLASS}>{t("quoteForm.client")} *</Label>
            {clientLocked ? (
              <Input id="quote-client" readOnly value={getDisplayCompany(prefillClient)} className={`${FIELD_CLASS} bg-[#F9FAFB] text-[#6B7280]`} />
            ) : (
              <Select value={form.clientId || "none"} onValueChange={(v) => setForm((p) => ({ ...p, clientId: v === "none" ? "" : v }))}>
                <SelectTrigger data-testid="quote-form-client" className={FIELD_CLASS}><SelectValue placeholder={t("quoteForm.selectClient")} /></SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
                  <SelectItem value="none">{t("quoteForm.selectClient")}</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{getDisplayCompany(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-title" className={LABEL_CLASS}>{t("quoteForm.title")}</Label>
            <Input id="quote-title" value={form.title} onChange={setField("title")} className={FIELD_CLASS} placeholder={t("quoteForm.titlePlaceholder")} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={LABEL_CLASS}>{t("quoteForm.status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className={FIELD_CLASS}><SelectValue /></SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
                  {QUOTE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{t(`quoteStatus.${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote-date" className={LABEL_CLASS}>{t("quoteForm.quoteDate")}</Label>
              <Input id="quote-date" type="datetime-local" value={form.quoteDate} onChange={setField("quoteDate")} className={FIELD_CLASS} />
            </div>
          </div>

          <QuoteLineItemsEditor
            lines={form.lineItems}
            onChange={(lineItems) => setForm((prev) => ({ ...prev, lineItems }))}
            t={t}
            lang={lang}
          />

          <div className="space-y-2">
            <Label htmlFor="quote-notes" className={LABEL_CLASS}>{t("quoteForm.internalNotes")}</Label>
            <Textarea id="quote-notes" value={form.internalNotes} onChange={setField("internalNotes")} rows={3} className={TEXTAREA_CLASS} />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={closeAddQuote} disabled={submitting} className="rounded-xl">{t("quoteForm.cancel")}</Button>
            <Button type="submit" disabled={submitting} className="rounded-xl bg-[#0A2540] text-white hover:bg-[#173A5E]">
              {submitting ? t("quoteForm.saving") : isEdit ? t("quoteForm.save") : t("quoteForm.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
