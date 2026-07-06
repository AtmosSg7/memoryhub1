import { useCallback, useState } from "react";

import { Plus, Trash2, Loader2, Upload, FileText } from "lucide-react";

import { toast } from "sonner";

import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";

import { useAddQuote } from "@/context/AddQuoteContext";

import { useQuotes } from "@/hooks/useQuotes";

import { useFollowUpLastMap } from "@/hooks/useFollowUpLastMap";

import { useOpenDocumentFromUrl } from "@/hooks/useOpenDocumentFromUrl";

import { deleteQuote, getQuote } from "@/lib/quotesApi";

import PageHeader from "@/components/dashboard/PageHeader";

import EmptyState from "@/components/dashboard/EmptyState";

import { PageError, PageLoader } from "@/components/dashboard/PageFeedback";

import QuoteStatusFilter from "@/components/dashboard/QuoteStatusFilter";

import QuoteInvoiceAction from "@/components/dashboard/QuoteInvoiceAction";

import FollowUpAction from "@/components/dashboard/FollowUpAction";
import DocumentSendAction from "@/components/dashboard/DocumentSendAction";

import FollowUpLastHint from "@/components/dashboard/FollowUpLastHint";

import CommercialPdfDownload from "@/components/dashboard/CommercialPdfDownload";

import CommercialDocumentDetailModal from "@/components/dashboard/CommercialDocumentDetailModal";

import ImportWizard from "@/components/dashboard/ImportWizard";

import { LIST_TABLE_CONTAINER_CLASS } from "@/components/dashboard/detailModalLayout";

import { formatQuoteAmount, formatQuoteDate, getQuoteDate } from "@/utils/quoteDisplay";

import StatusBadge from "@/components/dashboard/StatusBadge";

import DeleteConfirmDialog from "@/components/dashboard/DeleteConfirmDialog";

import { ActionButton } from "@/components/dashboard/ActionButton";



export default function QuotesPage() {

  const { t, lang } = useDashboardLang();
  usePageTitle("page.quotes.title");

  const { openAddQuote, openEditQuote, notifyQuotesChanged } = useAddQuote();

  const [statusFilter, setStatusFilter] = useState("");

  const { quotes, loading, error } = useQuotes(statusFilter);

  const { getLast: getQuoteFollowUp } = useFollowUpLastMap("quote", quotes);

  const [deleting, setDeleting] = useState(null);

  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [importOpen, setImportOpen] = useState(false);

  const [viewingQuote, setViewingQuote] = useState(null);



  const fetchQuote = useCallback((id) => getQuote(id), []);

  const handleOpenFromUrl = useCallback((quote) => setViewingQuote(quote), []);



  useOpenDocumentFromUrl({

    loading,

    fetchDocument: fetchQuote,

    onOpen: handleOpenFromUrl,

  });



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



  const stopRowClick = (e) => e.stopPropagation();

  const isFiltered = Boolean(statusFilter);



  return (

    <div className="space-y-6" data-testid="quotes-page">

      <PageHeader

        title={t("page.quotes.title")}

        subtitle={t("page.quotes.subtitle")}

        primaryLabel={t("actions.createQuote")}

        primaryIcon={Plus}

        onPrimary={() => openAddQuote()}

        secondaryLabel={t("actions.importQuote")}

        secondaryIcon={Upload}

        onSecondary={() => setImportOpen(true)}

        testId="quotes-header"

      />



      <QuoteStatusFilter value={statusFilter} onChange={setStatusFilter} />



      {loading ? (

        <PageLoader label={t("quoteForm.loading")} testId="quotes-loading" />

      ) : error ? (

        <PageError message={error} testId="quotes-error" />

      ) : quotes.length === 0 ? (

        <EmptyState

          icon={FileText}

          title={isFiltered ? t("quotes.empty.filteredTitle") : t("quotes.empty.title")}

          description={isFiltered ? t("quotes.empty.filteredDesc") : t("quotes.empty.desc")}

          cta={isFiltered ? undefined : t("actions.createQuote")}

          onCta={isFiltered ? undefined : () => openAddQuote()}

          testId="quotes-empty"

        />

      ) : (

        <div className={LIST_TABLE_CONTAINER_CLASS}>

          <table className="w-full text-sm min-w-[720px]">

            <thead>

              <tr className="bg-[#FAFAFA] border-b border-[#F3F4F6]">

                {[t("quotes.col.number"), t("quoteForm.client"), t("quoteForm.title"), t("quotes.col.amount"), t("quoteForm.status"), t("quoteForm.quoteDate"), ""].map((h, i) => (

                  <th key={i} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">{h}</th>

                ))}

              </tr>

            </thead>

            <tbody>

              {quotes.map((q) => (

                <tr

                  key={q.id}

                  onClick={() => setViewingQuote(q)}

                  className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA] cursor-pointer"

                  data-testid={`quote-row-${q.id}`}

                >

                  <td className="px-4 py-3 font-medium text-[#111827]">{q.number}</td>

                  <td className="px-4 py-3 text-[#4B5563]">
                    <div>{q.clientName}</div>
                    <FollowUpLastHint last={getQuoteFollowUp(q.id)} />
                  </td>

                  <td className="px-4 py-3 text-[#111827] max-w-[200px] truncate">{q.title}</td>

                  <td className="px-4 py-3 font-medium text-[#111827] whitespace-nowrap">{formatQuoteAmount(q.amountTTC, lang)}</td>

                  <td className="px-4 py-3">

                    <StatusBadge kind="quote" status={q.status} />

                  </td>

                  <td className="px-4 py-3 text-[#6B7280] whitespace-nowrap">{formatQuoteDate(getQuoteDate(q), lang)}</td>

                  <td className="px-4 py-3" onClick={stopRowClick}>

                    <div className="flex items-center gap-1 justify-end">

                      <CommercialPdfDownload type="quote" item={q} compact />

                      <QuoteInvoiceAction quote={q} compact />

                      <DocumentSendAction entityType="quote" entity={q} compact />
                      <FollowUpAction entityType="quote" entity={q} compact />

                      <ActionButton variant="dangerIcon" onClick={() => setDeleting(q)} aria-label={t("actions.delete")}>

                        <Trash2 className="w-3.5 h-3.5" />

                      </ActionButton>

                    </div>

                  </td>

                </tr>

              ))}

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


