import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Upload, Eye } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useInvoices } from "@/hooks/useInvoices";
import { deleteInvoice } from "@/lib/invoicesApi";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import InvoiceStatusFilter from "@/components/dashboard/InvoiceStatusFilter";
import InvoicePaymentAction from "@/components/dashboard/InvoicePaymentAction";
import CommercialPdfDownload from "@/components/dashboard/CommercialPdfDownload";
import CommercialDocumentDetailModal from "@/components/dashboard/CommercialDocumentDetailModal";
import ImportWizard from "@/components/dashboard/ImportWizard";
import {
  computeInvoiceKpis,
  formatInvoiceAmount,
  formatInvoiceDate,
  getInvoiceDate,
  getInvoiceStatusStyle,
  invoiceMatchesStatus,
  normalizeInvoiceStatus,
} from "@/utils/invoiceDisplay";
import DeleteConfirmDialog from "@/components/dashboard/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";

export default function InvoicesPage() {
  const { t, lang } = useDashboardLang();
  const { openAddInvoice, openEditInvoice, notifyInvoicesChanged } = useAddInvoice();
  const { notifyQuotesChanged } = useAddQuote();
  const [statusFilter, setStatusFilter] = useState("");
  const { invoices: allInvoices, loading, error } = useInvoices("");
  const [deleting, setDeleting] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);

  const invoices = useMemo(
    () => allInvoices.filter((inv) => invoiceMatchesStatus(inv, statusFilter)),
    [allInvoices, statusFilter]
  );

  const kpis = useMemo(() => computeInvoiceKpis(allInvoices, lang), [allInvoices, lang]);

  const metrics = [
    {
      label: lang === "fr" ? "Chiffre du mois" : "Month revenue",
      value: formatInvoiceAmount(kpis.monthTotal, lang),
      trend: kpis.monthTrend,
    },
    {
      label: lang === "fr" ? "Payé" : "Paid",
      value: formatInvoiceAmount(kpis.paidTotal, lang),
      trend: kpis.paidTrend,
    },
    {
      label: lang === "fr" ? "En retard" : "Overdue",
      value: formatInvoiceAmount(kpis.overdueTotal, lang),
      trend: kpis.overdueTrend,
    },
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

  return (
    <div className="space-y-6" data-testid="invoices-page">
      <PageHeader
        title={t("page.invoices.title")}
        subtitle={t("page.invoices.subtitle")}
        primaryLabel={t("importWizard.importInvoice")}
        primaryIcon={Upload}
        onPrimary={() => setImportOpen(true)}
        secondaryLabel={t("invoiceForm.addTitle")}
        secondaryIcon={Plus}
        onSecondary={() => openAddInvoice()}
        testId="invoices-header"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.map((m, i) => (
          <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-5" data-testid={`invoice-metric-${i}`}>
            <div className="text-xs text-[#6B7280] mb-2">{m.label}</div>
            <div className="font-cabinet text-2xl font-bold text-[#111827] tracking-tight">{m.value}</div>
            <div className="text-[11px] text-[#6B7280] mt-1">{m.trend}</div>
          </div>
        ))}
      </div>

      <InvoiceStatusFilter value={statusFilter} onChange={setStatusFilter} />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#6B7280]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t("invoiceForm.loading")}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5 text-sm text-[#991B1B]">{error}</div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Plus}
          title={statusFilter ? t("invoices.empty.filteredTitle") : t("invoices.empty.title")}
          description={statusFilter ? t("invoices.empty.filteredDesc") : t("invoices.empty.desc")}
          cta={t("invoiceForm.addTitle")}
          onCta={() => openAddInvoice()}
          testId="invoices-empty"
        />
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
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
              {invoices.map((inv) => {
                const st = getInvoiceStatusStyle(inv.status);
                return (
                  <tr key={inv.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA]" data-testid={`invoice-row-${inv.id}`}>
                    <td className="px-4 py-3 font-medium text-[#111827]">{inv.number}</td>
                    <td className="px-4 py-3 text-[#4B5563]">{inv.clientName}</td>
                    <td className="px-4 py-3 text-[#111827]">{inv.title}</td>
                    <td className="px-4 py-3 font-medium text-[#111827]">
                      {formatInvoiceAmount(inv.amountTTC, lang)}{" "}
                      <span className="text-[#9CA3AF] text-xs">{t("invoices.col.ttc")}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${st.bg} ${st.text} ${st.border}`}>
                        {t(`invoiceStatus.${normalizeInvoiceStatus(inv.status)}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]">{formatInvoiceDate(getInvoiceDate(inv), lang)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        <CommercialPdfDownload type="invoice" item={inv} compact />
                        <InvoicePaymentAction invoice={inv} compact />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setViewingInvoice(inv)} aria-label={t("commercialDetail.viewInvoice")}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditInvoice(inv)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#991B1B]" onClick={() => setDeleting(inv)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
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
