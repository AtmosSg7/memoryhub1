import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Upload, Eye } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useQuotes } from "@/hooks/useQuotes";
import { deleteQuote } from "@/lib/quotesApi";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import QuoteStatusFilter from "@/components/dashboard/QuoteStatusFilter";
import QuoteInvoiceAction from "@/components/dashboard/QuoteInvoiceAction";
import CommercialPdfDownload from "@/components/dashboard/CommercialPdfDownload";
import CommercialDocumentDetailModal from "@/components/dashboard/CommercialDocumentDetailModal";
import ImportWizard from "@/components/dashboard/ImportWizard";
import { formatQuoteAmount, formatQuoteDate, getQuoteDate, getQuoteStatusStyle } from "@/utils/quoteDisplay";
import DeleteConfirmDialog from "@/components/dashboard/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";

export default function QuotesPage() {
  const { t, lang } = useDashboardLang();
  const { openAddQuote, openEditQuote, notifyQuotesChanged } = useAddQuote();
  const [statusFilter, setStatusFilter] = useState("");
  const { quotes, loading, error } = useQuotes(statusFilter);
  const [deleting, setDeleting] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [viewingQuote, setViewingQuote] = useState(null);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSubmitting(true);
    try {
      await deleteQuote(deleting.id);
      toast.success(t("toast.quoteDeleted"));
      notifyQuotesChanged();
      setDeleting(null);
    } catch (err) {
      toast.error(err.message || t("toast.quoteError"));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="quotes-page">
      <PageHeader
        title={t("page.quotes.title")}
        subtitle={t("page.quotes.subtitle")}
        primaryLabel={t("importWizard.importQuote")}
        primaryIcon={Upload}
        onPrimary={() => setImportOpen(true)}
        secondaryLabel={t("quoteForm.addTitle")}
        secondaryIcon={Plus}
        onSecondary={() => openAddQuote()}
        testId="quotes-header"
      />

      <QuoteStatusFilter value={statusFilter} onChange={setStatusFilter} />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#6B7280]"><Loader2 className="w-5 h-5 animate-spin mr-2" />{t("quoteForm.loading")}</div>
      ) : error ? (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5 text-sm text-[#991B1B]">{error}</div>
      ) : quotes.length === 0 ? (
        <EmptyState icon={Plus} title={statusFilter ? t("quotes.empty.filteredTitle") : t("quotes.empty.title")} description={statusFilter ? t("quotes.empty.filteredDesc") : t("quotes.empty.desc")} cta={t("quoteForm.addTitle")} onCta={() => openAddQuote()} testId="quotes-empty" />
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#F3F4F6]">
                {[t("quotes.col.number"), t("quoteForm.client"), t("quoteForm.title"), t("quotes.col.amount"), t("quoteForm.status"), t("quoteForm.quoteDate"), ""].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const st = getQuoteStatusStyle(q.status);
                return (
                  <tr key={q.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA]" data-testid={`quote-row-${q.id}`}>
                    <td className="px-4 py-3 font-medium text-[#111827]">{q.number}</td>
                    <td className="px-4 py-3 text-[#4B5563]">{q.clientName}</td>
                    <td className="px-4 py-3 text-[#111827]">{q.title}</td>
                    <td className="px-4 py-3 font-medium text-[#111827]">{formatQuoteAmount(q.amountTTC, lang)} <span className="text-[#9CA3AF] text-xs">{t("quotes.col.ttc")}</span></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${st.bg} ${st.text} ${st.border}`}>{t(`quoteStatus.${q.status}`)}</span>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]">{formatQuoteDate(getQuoteDate(q), lang)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        <CommercialPdfDownload type="quote" item={q} compact />
                        <QuoteInvoiceAction quote={q} compact />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setViewingQuote(q)} aria-label={t("commercialDetail.viewQuote")}><Eye className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditQuote(q)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#991B1B]" onClick={() => setDeleting(q)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DeleteConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && !deleteSubmitting && setDeleting(null)}
        title={t("quoteForm.deleteTitle")}
        description={t("quoteForm.deleteDesc")}
        cancelLabel={t("quoteForm.cancel")}
        confirmLabel={t("quoteForm.confirmDelete")}
        onConfirm={handleDelete}
        submitting={deleteSubmitting}
        testId="quote-delete-dialog"
      />

      <ImportWizard
        open={importOpen}
        onOpenChange={setImportOpen}
        defaultKind="quote"
        onSuccess={() => notifyQuotesChanged()}
      />

      <CommercialDocumentDetailModal
        type="quote"
        document={viewingQuote}
        open={Boolean(viewingQuote)}
        onOpenChange={(open) => !open && setViewingQuote(null)}
        onEdit={(quote) => {
          setViewingQuote(null);
          openEditQuote(quote);
        }}
      />
    </div>
  );
}
