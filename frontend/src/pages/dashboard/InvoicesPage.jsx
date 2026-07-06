import { useCallback, useMemo, useState } from "react";

import { Plus, Trash2, Upload, Receipt } from "lucide-react";

import { toast } from "sonner";

import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";

import { useAddInvoice } from "@/context/AddInvoiceContext";

import { useAddQuote } from "@/context/AddQuoteContext";

import { useInvoices } from "@/hooks/useInvoices";

import { useFollowUpLastMap } from "@/hooks/useFollowUpLastMap";

import { useOpenDocumentFromUrl } from "@/hooks/useOpenDocumentFromUrl";

import { deleteInvoice, getInvoice } from "@/lib/invoicesApi";

import PageHeader from "@/components/dashboard/PageHeader";

import EmptyState from "@/components/dashboard/EmptyState";

import { PageError, PageLoader } from "@/components/dashboard/PageFeedback";

import InvoiceStatusFilter from "@/components/dashboard/InvoiceStatusFilter";

import InvoicePaymentAction from "@/components/dashboard/InvoicePaymentAction";

import FollowUpAction from "@/components/dashboard/FollowUpAction";
import DocumentSendAction from "@/components/dashboard/DocumentSendAction";

import FollowUpLastHint from "@/components/dashboard/FollowUpLastHint";

import CommercialPdfDownload from "@/components/dashboard/CommercialPdfDownload";

import CommercialDocumentDetailModal from "@/components/dashboard/CommercialDocumentDetailModal";

import ImportWizard from "@/components/dashboard/ImportWizard";

import { LIST_TABLE_CONTAINER_CLASS } from "@/components/dashboard/detailModalLayout";

import {

  computeInvoiceKpis,

  formatInvoiceAmount,

  formatInvoiceDate,

  getInvoiceDate,

  getInvoiceAmountDue,

  getInvoiceAmountPaid,

  invoiceMatchesStatus,

} from "@/utils/invoiceDisplay";

import InvoiceStatusBadge from "@/components/dashboard/InvoiceStatusBadge";

import DeleteConfirmDialog from "@/components/dashboard/DeleteConfirmDialog";

import { ActionButton } from "@/components/dashboard/ActionButton";



export default function InvoicesPage() {

  const { t, lang } = useDashboardLang();
  usePageTitle("page.invoices.title");

  const { openAddInvoice, openEditInvoice, notifyInvoicesChanged } = useAddInvoice();

  const { notifyQuotesChanged } = useAddQuote();

  const [statusFilter, setStatusFilter] = useState("");

  const { invoices: allInvoices, loading, error } = useInvoices("");

  const { getLast: getInvoiceFollowUp } = useFollowUpLastMap("invoice", allInvoices);

  const [deleting, setDeleting] = useState(null);

  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [importOpen, setImportOpen] = useState(false);

  const [viewingInvoice, setViewingInvoice] = useState(null);



  const fetchInvoice = useCallback((id) => getInvoice(id), []);

  const handleOpenFromUrl = useCallback((invoice) => setViewingInvoice(invoice), []);



  useOpenDocumentFromUrl({

    loading,

    fetchDocument: fetchInvoice,

    onOpen: handleOpenFromUrl,

  });



  const invoices = useMemo(

    () => allInvoices.filter((inv) => invoiceMatchesStatus(inv, statusFilter)),

    [allInvoices, statusFilter]

  );



  const kpis = useMemo(() => computeInvoiceKpis(allInvoices, lang), [allInvoices, lang]);



  const metrics = [

    { label: t("invoices.metrics.monthRevenue"), value: formatInvoiceAmount(kpis.monthTotal, lang) },

    { label: t("invoices.metrics.paid"), value: formatInvoiceAmount(kpis.paidTotal, lang) },

    { label: t("invoices.metrics.overdue"), value: formatInvoiceAmount(kpis.overdueTotal, lang) },

  ];



  const handleDelete = async () => {

    if (!deleting) return;

    setDeleteSubmitting(true);

    try {

      await deleteInvoice(deleting.id);

      toast.success(t("toast.invoiceDeleted"));

      notifyInvoicesChanged();

      notifyQuotesChanged();

      setDeleting(null);

    } catch (err) {

      toast.error(err.message || t("toast.invoiceError"));

    } finally {

      setDeleteSubmitting(false);

    }

  };



  const stopRowClick = (e) => e.stopPropagation();

  const isFiltered = Boolean(statusFilter);



  return (

    <div className="space-y-6" data-testid="invoices-page">

      <PageHeader

        title={t("page.invoices.title")}

        subtitle={t("page.invoices.subtitle")}

        primaryLabel={t("actions.createInvoice")}

        primaryIcon={Plus}

        onPrimary={() => openAddInvoice()}

        secondaryLabel={t("actions.importInvoice")}

        secondaryIcon={Upload}

        onSecondary={() => setImportOpen(true)}

        testId="invoices-header"

      />



      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {metrics.map((m, i) => (

          <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-4" data-testid={`invoice-metric-${i}`}>

            <div className="text-xs text-[#6B7280] mb-1">{m.label}</div>

            <div className="font-cabinet text-xl font-bold text-[#111827] tracking-tight tabular-nums">{m.value}</div>

          </div>

        ))}

      </div>



      <InvoiceStatusFilter value={statusFilter} onChange={setStatusFilter} />



      {loading ? (

        <PageLoader label={t("invoiceForm.loading")} testId="invoices-loading" />

      ) : error ? (

        <PageError message={error} testId="invoices-error" />

      ) : invoices.length === 0 ? (

        <EmptyState

          icon={Receipt}

          title={isFiltered ? t("invoices.empty.filteredTitle") : t("invoices.empty.title")}

          description={isFiltered ? t("invoices.empty.filteredDesc") : t("invoices.empty.desc")}

          cta={isFiltered ? undefined : t("actions.createInvoice")}

          onCta={isFiltered ? undefined : () => openAddInvoice()}

          testId="invoices-empty"

        />

      ) : (

        <div className={LIST_TABLE_CONTAINER_CLASS}>

          <table className="w-full text-sm min-w-[720px]">

            <thead>

              <tr className="bg-[#FAFAFA] border-b border-[#F3F4F6]">

                {[t("invoices.col.number"), t("invoiceForm.client"), t("invoiceForm.title"), t("invoices.col.amount"), t("invoiceForm.status"), t("invoiceForm.invoiceDate"), ""].map((h, i) => (

                  <th key={i} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">

                    {h}

                  </th>

                ))}

              </tr>

            </thead>

            <tbody>

              {invoices.map((inv) => (

                <tr

                  key={inv.id}

                  onClick={() => setViewingInvoice(inv)}

                  className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA] cursor-pointer"

                  data-testid={`invoice-row-${inv.id}`}

                >

                  <td className="px-4 py-3 font-medium text-[#111827]">{inv.number}</td>

                  <td className="px-4 py-3 text-[#4B5563]">
                    <div>{inv.clientName}</div>
                    <FollowUpLastHint last={getInvoiceFollowUp(inv.id)} />
                  </td>

                  <td className="px-4 py-3 text-[#111827] max-w-[200px] truncate">{inv.title}</td>

                  <td className="px-4 py-3 font-medium text-[#111827] whitespace-nowrap">
                    <div>{formatInvoiceAmount(inv.amountTTC, lang)}</div>
                    {getInvoiceAmountPaid(inv) > 0 && getInvoiceAmountDue(inv) > 0 ? (
                      <div className="text-[11px] text-[#B45309] font-normal mt-0.5">
                        {t("invoicePayment.remaining")} {formatInvoiceAmount(getInvoiceAmountDue(inv), lang)}
                      </div>
                    ) : null}
                  </td>

                  <td className="px-4 py-3">
                    <InvoiceStatusBadge invoice={inv} />
                  </td>

                  <td className="px-4 py-3 text-[#6B7280] whitespace-nowrap">{formatInvoiceDate(getInvoiceDate(inv), lang)}</td>

                  <td className="px-4 py-3" onClick={stopRowClick}>

                    <div className="flex items-center gap-1 justify-end">

                      <CommercialPdfDownload type="invoice" item={inv} compact />

                      <InvoicePaymentAction invoice={inv} compact />

                      <DocumentSendAction entityType="invoice" entity={inv} compact />
                      <FollowUpAction entityType="invoice" entity={inv} compact />

                      <ActionButton variant="dangerIcon" onClick={() => setDeleting(inv)} aria-label={t("actions.delete")}>

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

        title={t("invoiceForm.deleteTitle")}

        description={t("invoiceForm.deleteDesc")}

        cancelLabel={t("invoiceForm.cancel")}

        confirmLabel={t("invoiceForm.confirmDelete")}

        onConfirm={handleDelete}

        submitting={deleteSubmitting}

        testId="invoice-delete-dialog"

      />



      <ImportWizard

        open={importOpen}

        onOpenChange={setImportOpen}

        defaultKind="invoice"

        onSuccess={() => {

          notifyInvoicesChanged();

          notifyQuotesChanged();

        }}

      />



      <CommercialDocumentDetailModal

        type="invoice"

        document={viewingInvoice}

        open={Boolean(viewingInvoice)}

        onOpenChange={(open) => !open && setViewingInvoice(null)}

        onEdit={(invoice) => {

          setViewingInvoice(null);

          openEditInvoice(invoice);

        }}

      />

    </div>

  );

}


