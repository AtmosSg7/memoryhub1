import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileStack } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { useAddClient } from "@/context/AddClientContext";
import { useQuotes } from "@/hooks/useQuotes";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { useFollowUpLastMap } from "@/hooks/useFollowUpLastMap";
import { useListPagination } from "@/hooks/useListPagination";
import { useOpenCommercialDocumentFromUrl } from "@/hooks/useOpenCommercialDocumentFromUrl";
import { deleteQuote, getQuote } from "@/lib/quotesApi";
import { deleteInvoice, getInvoice } from "@/lib/invoicesApi";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import { PageError, TableSkeleton } from "@/components/dashboard/PageFeedback";
import CommercialDocumentKindFilter from "@/components/dashboard/CommercialDocumentKindFilter";
import QuoteStatusFilter from "@/components/dashboard/QuoteStatusFilter";
import InvoiceStatusFilter from "@/components/dashboard/InvoiceStatusFilter";
import ClientFilterSelect from "@/components/dashboard/ClientFilterSelect";
import CommercialDocumentRowActions from "@/components/dashboard/CommercialDocumentRowActions";
import CommercialDocumentsHeaderActions from "@/components/dashboard/CommercialDocumentsHeaderActions";
import CommercialDocumentDetailModal from "@/components/dashboard/CommercialDocumentDetailModal";
import ImportWizard from "@/components/dashboard/ImportWizard";
import ListCollectionFooter from "@/components/dashboard/ListCollectionFooter";
import DeleteConfirmDialog from "@/components/dashboard/DeleteConfirmDialog";
import StatusBadge from "@/components/dashboard/StatusBadge";
import InvoiceStatusBadge from "@/components/dashboard/InvoiceStatusBadge";
import FollowUpLastHint from "@/components/dashboard/FollowUpLastHint";
import {
  LIST_TABLE_CONTAINER_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_HEAD_CELL_CLASS,
} from "@/components/dashboard/detailModalLayout";
import { formatQuoteDate } from "@/utils/quoteDisplay";
import { formatInvoiceDate, getInvoiceAmountDue, getInvoiceAmountPaid } from "@/utils/invoiceDisplay";
import {
  buildCommercialDocumentRows,
  formatCommercialDocumentAmount,
  getInvoiceAmountHint,
  isValidInvoiceStatus,
  isValidQuoteStatus,
} from "@/utils/commercialDocumentsDisplay";
import { formatDateFilterFr, parseDateFilterParam } from "@/utils/parseDateFilterParam";

const TYPE_STYLES = {
  quote: {
    badge: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
    row: "border-l-2 border-l-[#93C5FD]",
  },
  invoice: {
    badge: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
    row: "border-l-2 border-l-[#6EE7B7]",
  },
};

export default function CommercialDocumentsPage() {
  const { t, lang } = useDashboardLang();
  usePageTitle("page.commercialDocuments.title");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { openAddQuote, openEditQuote, notifyQuotesChanged, pendingOpenQuote, clearPendingOpenQuote, refreshKey: quotesRefreshKey } =
    useAddQuote();
  const {
    openAddInvoice,
    openEditInvoice,
    notifyInvoicesChanged,
    pendingOpenInvoice,
    clearPendingOpenInvoice,
    refreshKey: invoicesRefreshKey,
  } = useAddInvoice();
  const { openAddClient } = useAddClient();
  const { clients, loading: clientsLoading } = useClients();

  const urlKind = searchParams.get("kind");
  const urlClientId = searchParams.get("clientId") || "";
  const urlStatus = searchParams.get("status") || "";
  const fromFilter = parseDateFilterParam(searchParams.get("from"));
  const toFilter = parseDateFilterParam(searchParams.get("to"));

  const kindFilter = urlKind === "quote" || urlKind === "invoice" ? urlKind : "all";
  const clientFilter = urlClientId;

  const statusFilter = useMemo(() => {
    if (!urlStatus) return "";
    if (kindFilter === "quote" && isValidQuoteStatus(urlStatus)) return urlStatus;
    if (kindFilter === "invoice" && isValidInvoiceStatus(urlStatus)) return urlStatus;
    return "";
  }, [urlStatus, kindFilter]);

  const periodFilters = useMemo(
    () => ({
      clientId: clientFilter || undefined,
      from: fromFilter && toFilter ? fromFilter : undefined,
      to: fromFilter && toFilter ? toFilter : undefined,
      timezone: "Europe/Paris",
    }),
    [clientFilter, fromFilter, toFilter]
  );

  const patchSearchParams = useCallback(
    (patch) => {
      const params = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value == null || value === "" || value === "all") params.delete(key);
        else params.set(key, String(value));
      });
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("kind");
    params.delete("status");
    params.delete("clientId");
    params.delete("from");
    params.delete("to");
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (searchParams.get("import") === "1") {
      navigate("/dashboard/files?import=1", { replace: true });
    }
  }, [searchParams, navigate]);
  const [viewingQuote, setViewingQuote] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [deletingQuote, setDeletingQuote] = useState(null);
  const [deletingInvoice, setDeletingInvoice] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importKind, setImportKind] = useState("quote");

  const loadQuotes = kindFilter !== "invoice";
  const loadInvoices = kindFilter !== "quote";
  const quoteStatus = kindFilter === "quote" ? statusFilter : "";
  const invoiceStatus = kindFilter === "invoice" ? statusFilter : "";

  const { quotes, total: quotesTotal, loading: quotesLoading, error: quotesError } = useQuotes(
    quoteStatus,
    { ...periodFilters, enabled: loadQuotes }
  );
  const { invoices, total: invoicesTotal, loading: invoicesLoading, error: invoicesError } = useInvoices(
    invoiceStatus,
    { ...periodFilters, enabled: loadInvoices }
  );

  const loading = (loadQuotes && quotesLoading) || (loadInvoices && invoicesLoading);
  const error = quotesError || invoicesError;

  const filteredRows = useMemo(() => {
    const q = loadQuotes ? quotes : [];
    const inv = loadInvoices ? invoices : [];
    return buildCommercialDocumentRows(q, inv);
  }, [quotes, invoices, loadQuotes, loadInvoices]);

  const loadedCount = filteredRows.length;
  const apiTotal =
    kindFilter === "quote" ? quotesTotal : kindFilter === "invoice" ? invoicesTotal : quotesTotal + invoicesTotal;

  const {
    pageItems: pageRows,
    page,
    setPage,
    totalPages,
    rangeStart,
    rangeEnd,
    totalItems,
  } = useListPagination(filteredRows, {
    pageSize: 24,
    resetKey: `${kindFilter}:${statusFilter}:${clientFilter}:${fromFilter}:${toFilter}`,
  });

  const pageQuotes = useMemo(() => pageRows.filter((row) => row.kind === "quote").map((row) => row.raw), [pageRows]);
  const pageInvoices = useMemo(() => pageRows.filter((row) => row.kind === "invoice").map((row) => row.raw), [pageRows]);
  const { getLast: getQuoteFollowUp } = useFollowUpLastMap("quote", pageQuotes);
  const { getLast: getInvoiceFollowUp } = useFollowUpLastMap("invoice", pageInvoices);

  const handleOpenQuote = useCallback((quote) => setViewingQuote(quote), []);
  const handleOpenInvoice = useCallback((invoice) => setViewingInvoice(invoice), []);

  useOpenCommercialDocumentFromUrl({
    loading,
    onOpenQuote: handleOpenQuote,
    onOpenInvoice: handleOpenInvoice,
  });

  useEffect(() => {
    if (!pendingOpenQuote) return;
    setViewingQuote(pendingOpenQuote);
    clearPendingOpenQuote();
  }, [pendingOpenQuote, clearPendingOpenQuote]);

  useEffect(() => {
    if (!pendingOpenInvoice) return;
    setViewingInvoice(pendingOpenInvoice);
    clearPendingOpenInvoice();
  }, [pendingOpenInvoice, clearPendingOpenInvoice]);

  useEffect(() => {
    if (!viewingQuote?.id) return;
    let cancelled = false;
    getQuote(viewingQuote.id)
      .then((quote) => {
        if (!cancelled) setViewingQuote(quote);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [quotesRefreshKey, viewingQuote?.id]);

  useEffect(() => {
    if (!viewingInvoice?.id) return;
    let cancelled = false;
    getInvoice(viewingInvoice.id)
      .then((invoice) => {
        if (!cancelled) setViewingInvoice(invoice);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [invoicesRefreshKey, viewingInvoice?.id]);

  const hasClients = !clientsLoading && clients.length > 0;
  const hasActiveFilters =
    kindFilter !== "all" ||
    Boolean(clientFilter) ||
    Boolean(statusFilter) ||
    Boolean(fromFilter && toFilter);
  const isFilteredEmpty = !loading && filteredRows.length === 0 && hasActiveFilters;
  const isEmpty = !loading && filteredRows.length === 0;

  const handleDeleteQuote = async () => {
    if (!deletingQuote) return;
    setDeleteSubmitting(true);
    try {
      await deleteQuote(deletingQuote.id);
      toast.success(t("toast.quoteDeleted"));
      notifyQuotesChanged();
      setDeletingQuote(null);
    } catch (err) {
      toastApiError(err, t, "toast.quoteError");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deletingInvoice) return;
    setDeleteSubmitting(true);
    try {
      await deleteInvoice(deletingInvoice.id);
      toast.success(t("toast.invoiceDeleted"));
      notifyInvoicesChanged();
      notifyQuotesChanged();
      setDeletingInvoice(null);
    } catch (err) {
      toastApiError(err, t, "toast.invoiceError");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openImport = (kind) => {
    setImportKind(kind);
    setImportOpen(true);
  };

  const stopRowClick = (event) => event.stopPropagation();

  const openRow = (row) => {
    if (row.kind === "quote") setViewingQuote(row.raw);
    else setViewingInvoice(row.raw);
  };

  const headers = [
    t("commercialDocuments.col.type"),
    t("commercialDocuments.col.number"),
    t("commercialDocuments.col.client"),
    t("commercialDocuments.col.amount"),
    t("commercialDocuments.col.status"),
    t("commercialDocuments.col.date"),
    "",
  ];

  return (
    <div className="space-y-6" data-testid="commercial-documents-page">
      <PageHeader
        title={t("page.commercialDocuments.title")}
        subtitle={t("page.commercialDocuments.subtitle")}
        testId="commercial-documents-header"
        trailing={
          <CommercialDocumentsHeaderActions
            hasClients={hasClients}
            onCreateQuote={() => openAddQuote()}
            onCreateInvoice={() => openAddInvoice()}
            onImportQuote={() => openImport("quote")}
            onImportInvoice={() => openImport("invoice")}
            onNeedClient={() => openAddClient("quote")}
          />
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <CommercialDocumentKindFilter
            value={kindFilter}
            onChange={(next) => {
              patchSearchParams({
                kind: next === "all" ? "" : next,
                status: "",
              });
            }}
          />
          <ClientFilterSelect
            clients={clients}
            value={clientFilter}
            onChange={(next) => patchSearchParams({ clientId: next || "" })}
            disabled={clientsLoading}
            className="w-full lg:w-64"
            testId="commercial-documents-client-filter"
          />
          <div className="flex flex-wrap items-end gap-2" data-testid="commercial-documents-period">
            <label className="text-xs text-[#6B7280]">
              <span className="block mb-1 font-medium">{t("commercialDocuments.filters.from")}</span>
              <input
                type="date"
                value={fromFilter}
                onChange={(e) => patchSearchParams({ from: e.target.value || "" })}
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] bg-white"
                data-testid="commercial-documents-from"
              />
            </label>
            <label className="text-xs text-[#6B7280]">
              <span className="block mb-1 font-medium">{t("commercialDocuments.filters.to")}</span>
              <input
                type="date"
                value={toFilter}
                onChange={(e) => patchSearchParams({ to: e.target.value || "" })}
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] bg-white"
                data-testid="commercial-documents-to"
              />
            </label>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-semibold text-[#0A2540] hover:underline px-1 py-2"
                data-testid="commercial-documents-reset"
              >
                {t("commercialDocuments.filters.reset")}
              </button>
            ) : null}
          </div>
        </div>
        {fromFilter && toFilter ? (
          <p className="text-xs text-[#6B7280]" data-testid="commercial-documents-period-label">
            {t("commercialDocuments.filters.periodLabel")
              .replace("{from}", formatDateFilterFr(fromFilter, lang))
              .replace("{to}", formatDateFilterFr(toFilter, lang))}
          </p>
        ) : null}
        {kindFilter === "quote" ? (
          <QuoteStatusFilter
            value={statusFilter}
            onChange={(next) => patchSearchParams({ status: next || "" })}
            testId="commercial-documents-quote-status"
          />
        ) : null}
        {kindFilter === "invoice" ? (
          <InvoiceStatusFilter
            value={statusFilter}
            onChange={(next) => patchSearchParams({ status: next || "" })}
            testId="commercial-documents-invoice-status"
          />
        ) : null}
      </div>

      {loading ? (
        <TableSkeleton testId="commercial-documents-loading" />
      ) : error ? (
        <PageError message={error} testId="commercial-documents-error" />
      ) : isEmpty ? (
        <EmptyState
          icon={FileStack}
          title={
            isFilteredEmpty
              ? t("commercialDocuments.empty.filteredTitle")
              : kindFilter === "quote"
                ? hasClients
                  ? t("quotes.empty.title")
                  : t("quotes.empty.needsClientTitle")
                : kindFilter === "invoice"
                  ? hasClients
                    ? t("invoices.empty.title")
                    : t("invoices.empty.needsClientTitle")
                  : hasClients
                    ? t("commercialDocuments.empty.title")
                    : t("commercialDocuments.empty.needsClientTitle")
          }
          description={
            isFilteredEmpty
              ? t("commercialDocuments.empty.filteredDesc")
              : kindFilter === "quote"
                ? hasClients
                  ? t("quotes.empty.desc")
                  : t("quotes.empty.needsClientDesc")
                : kindFilter === "invoice"
                  ? hasClients
                    ? t("invoices.empty.desc")
                    : t("invoices.empty.needsClientDesc")
                  : hasClients
                    ? t("commercialDocuments.empty.desc")
                    : t("commercialDocuments.empty.needsClientDesc")
          }
          cta={
            isFilteredEmpty
              ? t("common.clearFilter")
              : kindFilter === "invoice"
                ? hasClients
                  ? t("actions.createInvoice")
                  : t("empty.noClients.cta")
                : hasClients
                  ? t("actions.createQuote")
                  : t("empty.noClients.cta")
          }
          onCta={
            isFilteredEmpty
              ? clearFilters
              : kindFilter === "invoice"
                ? hasClients
                  ? () => openAddInvoice()
                : openAddClient("invoice")
              : hasClients
                ? () => openAddQuote()
                : openAddClient("quote")
          }
          testId="commercial-documents-empty"
        />
      ) : (
        <div className="space-y-0">
          <div className={LIST_TABLE_CONTAINER_CLASS}>
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  {headers.map((label, index) => (
                    <th key={label || "actions"} className={TABLE_HEAD_CELL_CLASS}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const typeStyle = TYPE_STYLES[row.kind];
                  const rowTestId = row.kind === "quote" ? `quote-row-${row.id}` : `invoice-row-${row.id}`;

                  return (
                    <tr
                      key={`${row.kind}-${row.id}`}
                      onClick={() => openRow(row)}
                      className={[
                        "border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA] cursor-pointer",
                        typeStyle.row,
                      ].join(" ")}
                      data-testid={rowTestId}
                    >
                      <td className="px-6 py-3.5">
                        <span
                          className={[
                            "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border",
                            typeStyle.badge,
                          ].join(" ")}
                        >
                          {t(`commercialDocuments.kind.${row.kind}`)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-medium text-[#111827]">{row.number}</td>
                      <td className="px-6 py-3.5 text-[#4B5563]">
                        <div>{row.clientName}</div>
                        <FollowUpLastHint
                          last={
                            row.kind === "quote"
                              ? getQuoteFollowUp(row.id)
                              : getInvoiceFollowUp(row.id)
                          }
                        />
                      </td>
                      <td className="px-6 py-3.5 font-medium text-[#111827] whitespace-nowrap">
                        <div>{formatCommercialDocumentAmount(row, lang)}</div>
                        {row.kind === "invoice" &&
                        getInvoiceAmountPaid(row.raw) > 0 &&
                        getInvoiceAmountDue(row.raw) > 0 ? (
                          <div className="text-[11px] text-[#B45309] font-normal mt-0.5">
                            {getInvoiceAmountHint(row.raw, lang, t)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-3.5">
                        {row.kind === "quote" ? (
                          <StatusBadge kind="quote" status={row.status} />
                        ) : (
                          <InvoiceStatusBadge invoice={row.raw} />
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-[#6B7280] whitespace-nowrap">
                        {row.kind === "quote"
                          ? formatQuoteDate(row.sortAt, lang)
                          : formatInvoiceDate(row.sortAt, lang)}
                      </td>
                      <td className="px-4 py-3.5" onClick={stopRowClick}>
                        <CommercialDocumentRowActions
                          kind={row.kind}
                          document={row.raw}
                          onDelete={() =>
                            row.kind === "quote" ? setDeletingQuote(row.raw) : setDeletingInvoice(row.raw)
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ListCollectionFooter
            t={t}
            loadedCount={loadedCount}
            total={apiTotal}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            testId="commercial-documents-list-footer"
          />
        </div>
      )}

      <DeleteConfirmDialog
        open={Boolean(deletingQuote)}
        onOpenChange={(open) => !open && !deleteSubmitting && setDeletingQuote(null)}
        title={t("quoteForm.deleteTitle")}
        description={t("quoteForm.deleteDesc")}
        cancelLabel={t("quoteForm.cancel")}
        confirmLabel={t("quoteForm.confirmDelete")}
        onConfirm={handleDeleteQuote}
        submitting={deleteSubmitting}
        testId="quote-delete-dialog"
      />

      <DeleteConfirmDialog
        open={Boolean(deletingInvoice)}
        onOpenChange={(open) => !open && !deleteSubmitting && setDeletingInvoice(null)}
        title={t("invoiceForm.deleteTitle")}
        description={t("invoiceForm.deleteDesc")}
        cancelLabel={t("invoiceForm.cancel")}
        confirmLabel={t("invoiceForm.confirmDelete")}
        onConfirm={handleDeleteInvoice}
        submitting={deleteSubmitting}
        testId="invoice-delete-dialog"
      />

      <ImportWizard
        open={importOpen}
        onOpenChange={setImportOpen}
        defaultKind={importKind}
        onSuccess={() => {
          notifyQuotesChanged();
          notifyInvoicesChanged();
        }}
      />

      <CommercialDocumentDetailModal
        type="quote"
        document={viewingQuote}
        open={Boolean(viewingQuote)}
        onOpenChange={(open) => !open && setViewingQuote(null)}
        onEdit={(quote) => openEditQuote(quote)}
        onDelete={(quote) => setDeletingQuote(quote)}
      />

      <CommercialDocumentDetailModal
        type="invoice"
        document={viewingInvoice}
        open={Boolean(viewingInvoice)}
        onOpenChange={(open) => !open && setViewingInvoice(null)}
        onEdit={(invoice) => openEditInvoice(invoice)}
        onDelete={(invoice) => setDeletingInvoice(invoice)}
        onDocumentUpdated={(updated) => setViewingInvoice(updated)}
      />
    </div>
  );
}
