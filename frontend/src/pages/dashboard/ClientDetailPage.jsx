import { useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Trash2, Loader2, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddClient } from "@/context/AddClientContext";
import { useAddNote } from "@/context/AddNoteContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { useClientQuotes } from "@/hooks/useClientQuotes";
import { useClientInvoices } from "@/hooks/useClientInvoices";
import { useClient } from "@/hooks/useClient";
import { useClientNotes } from "@/hooks/useClientNotes";
import { useClientDocuments } from "@/hooks/useClientDocuments";
import { useClientTimeline } from "@/hooks/useClientTimeline";
import { useClientFollowUps } from "@/hooks/useClientFollowUps";
import { useFollowUpLastMap } from "@/hooks/useFollowUpLastMap";
import { useDocumentsContext } from "@/context/DocumentsContext";
import { deleteClient } from "@/lib/clientsApi";
import { deleteNote } from "@/lib/notesApi";
import { deleteQuote } from "@/lib/quotesApi";
import { deleteInvoice } from "@/lib/invoicesApi";
import {
  deleteDocument,
  fetchDocumentBlob,
  triggerBlobDownload,
  uploadDocument,
} from "@/lib/documentsApi";
import QuoteStatusFilter from "@/components/dashboard/QuoteStatusFilter";
import QuoteInvoiceAction from "@/components/dashboard/QuoteInvoiceAction";
import FollowUpAction from "@/components/dashboard/FollowUpAction";
import DocumentSendAction from "@/components/dashboard/DocumentSendAction";
import CommercialPdfDownload from "@/components/dashboard/CommercialPdfDownload";
import CommercialDocumentDetailModal from "@/components/dashboard/CommercialDocumentDetailModal";
import InvoiceStatusFilter from "@/components/dashboard/InvoiceStatusFilter";
import InvoicePaymentAction from "@/components/dashboard/InvoicePaymentAction";
import NoteTypeFilter from "@/components/dashboard/NoteTypeFilter";
import DocumentDropzone from "@/components/dashboard/DocumentDropzone";
import DocumentPreviewModal from "@/components/dashboard/DocumentPreviewModal";
import DeleteConfirmDialog from "@/components/dashboard/DeleteConfirmDialog";
import StatusBadge from "@/components/dashboard/StatusBadge";
import InvoiceStatusBadge from "@/components/dashboard/InvoiceStatusBadge";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { PageLoader } from "@/components/dashboard/PageFeedback";
import ClientDetailHeader from "@/components/dashboard/client/ClientDetailHeader";
import ClientPortalAccess from "@/components/dashboard/client/ClientPortalAccess";
import ClientCommercialSummary from "@/components/dashboard/client/ClientCommercialSummary";
import ClientDocumentHighlight from "@/components/dashboard/client/ClientDocumentHighlight";
import ClientTimelineList from "@/components/dashboard/client/ClientTimelineList";
import ClientFollowUpList from "@/components/dashboard/client/ClientFollowUpList";
import FollowUpLastHint from "@/components/dashboard/FollowUpLastHint";
import ClientSectionNav from "@/components/dashboard/client/ClientSectionNav";
import SectionPanel from "@/components/dashboard/client/SectionPanel";
import { formatQuoteAmount, formatQuoteDate, getQuoteDate } from "@/utils/quoteDisplay";
import {
  formatInvoiceAmount,
  formatInvoiceDate,
  getInvoiceDate,
  invoiceMatchesStatus,
} from "@/utils/invoiceDisplay";
import {
  formatNoteDate,
  getNoteTypeStyle,
  normalizeNoteType,
  getNoteDate,
} from "@/utils/noteDisplay";
import {
  canPreviewDocument,
  formatFileSize,
  getDocumentTypeStyle,
} from "@/utils/documentDisplay";
import { computeClientCommercialStats } from "@/utils/clientCommercialStats";

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, lang } = useDashboardLang();
  const { openEditClient, notifyClientsChanged } = useAddClient();
  const { openAddNote, openEditNote, notifyNotesChanged } = useAddNote();
  const { openAddQuote, openEditQuote, notifyQuotesChanged } = useAddQuote();
  const { openAddInvoice, openEditInvoice, notifyInvoicesChanged } = useAddInvoice();
  const { notifyDocumentsChanged } = useDocumentsContext();

  const { client, loading, error } = useClient(id);
  const [noteTypeFilter, setNoteTypeFilter] = useState("");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("");

  const { notes: clientNotes, total: clientNotesTotal, loading: notesLoading, error: notesError } =
    useClientNotes(id, noteTypeFilter);
  const { quotes: allQuotes, total: clientQuotesTotal, loading: quotesLoading, error: quotesError } =
    useClientQuotes(id, "");
  const { invoices: allInvoices, total: clientInvoicesTotal, loading: invoicesLoading, error: invoicesError } =
    useClientInvoices(id, "");
  const { documents: clientDocs, total: clientDocsTotal, loading: docsLoading, error: docsError } =
    useClientDocuments(id);
  const { events: timelineEvents, loading: timelineLoading, error: timelineError } =
    useClientTimeline(id);
  const { items: followUps, total: followUpsTotal, loading: followUpsLoading, error: followUpsError } =
    useClientFollowUps(id, 10);
  const { getLast: getQuoteFollowUp } = useFollowUpLastMap("quote", allQuotes);
  const { getLast: getInvoiceFollowUp } = useFollowUpLastMap("invoice", allInvoices);

  const [deletingNote, setDeletingNote] = useState(null);
  const [deleteNoteSubmitting, setDeleteNoteSubmitting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const [deleteDocSubmitting, setDeleteDocSubmitting] = useState(false);
  const [deletingQuote, setDeletingQuote] = useState(null);
  const [deleteQuoteSubmitting, setDeleteQuoteSubmitting] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState(null);
  const [deleteInvoiceSubmitting, setDeleteInvoiceSubmitting] = useState(false);
  const [viewingQuote, setViewingQuote] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [docActionId, setDocActionId] = useState(null);

  const activeSection = searchParams.get("section") || "overview";

  const setSection = (section) => {
    if (section === "overview") {
      searchParams.delete("section");
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ section }, { replace: true });
    }
  };

  const stats = useMemo(
    () => computeClientCommercialStats(allQuotes, allInvoices),
    [allQuotes, allInvoices],
  );

  const filteredQuotes = useMemo(
    () => (quoteStatusFilter ? allQuotes.filter((q) => q.status === quoteStatusFilter) : allQuotes),
    [allQuotes, quoteStatusFilter],
  );

  const filteredInvoices = useMemo(
    () => allInvoices.filter((inv) => invoiceMatchesStatus(inv, invoiceStatusFilter)),
    [allInvoices, invoiceStatusFilter],
  );

  const recentNotes = useMemo(() => clientNotes.slice(0, 3), [clientNotes]);

  const overviewTimelineEvents = useMemo(
    () => timelineEvents.filter((event) => event.type !== "follow_up_recorded"),
    [timelineEvents],
  );

  const handleDelete = async () => {
    try {
      await deleteClient(id);
      notifyClientsChanged();
      toast.success(t("toast.clientDeleted"));
      navigate("/dashboard/clients");
    } catch (err) {
      const message = err.message || t("toast.clientError");
      if (message.includes("notes ou des documents") || message.includes("linked notes or documents")) {
        toast.error(t("toast.clientDeleteBlockedLinked"));
      } else if (message.includes("linked notes") || message.includes("notes y sont")) {
        toast.error(t("toast.clientDeleteBlockedNotes"));
      } else {
        toast.error(message);
      }
    }
  };

  const handleUploadDocument = async (file) => {
    try {
      await uploadDocument(file, id);
      notifyDocumentsChanged();
      toast.success(t("toast.documentUploaded"));
    } catch (err) {
      toast.error(err.message || t("toast.documentError"));
    }
  };

  const handleDownloadDocument = async (doc) => {
    setDocActionId(doc.id);
    try {
      const blob = await fetchDocumentBlob(doc.id, "download");
      triggerBlobDownload(blob, doc.name);
    } catch (err) {
      toast.error(err.message || t("documents.errors.downloadFailed"));
    } finally {
      setDocActionId(null);
    }
  };

  const handleDeleteNote = async () => {
    if (!deletingNote) return;
    setDeleteNoteSubmitting(true);
    try {
      await deleteNote(deletingNote.id);
      toast.success(t("toast.noteDeleted"));
      notifyNotesChanged();
      setDeletingNote(null);
    } catch (err) {
      toast.error(err.message || t("toast.noteError"));
    } finally {
      setDeleteNoteSubmitting(false);
    }
  };

  const handleDeleteQuote = async () => {
    if (!deletingQuote) return;
    setDeleteQuoteSubmitting(true);
    try {
      await deleteQuote(deletingQuote.id);
      toast.success(t("toast.quoteDeleted"));
      notifyQuotesChanged();
      setDeletingQuote(null);
    } catch (err) {
      toast.error(err.message || t("toast.quoteError"));
    } finally {
      setDeleteQuoteSubmitting(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deletingInvoice) return;
    setDeleteInvoiceSubmitting(true);
    try {
      await deleteInvoice(deletingInvoice.id);
      toast.success(t("toast.invoiceDeleted"));
      notifyInvoicesChanged();
      notifyQuotesChanged();
      setDeletingInvoice(null);
    } catch (err) {
      toast.error(err.message || t("toast.invoiceError"));
    } finally {
      setDeleteInvoiceSubmitting(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!deletingDoc) return;
    setDeleteDocSubmitting(true);
    try {
      await deleteDocument(deletingDoc.id);
      notifyDocumentsChanged();
      toast.success(t("toast.documentDeleted"));
      setDeletingDoc(null);
    } catch (err) {
      toast.error(err.message || t("toast.documentError"));
    } finally {
      setDeleteDocSubmitting(false);
    }
  };

  if (loading) {
    return <PageLoader label={t("clientForm.loading")} testId="client-detail-loading" />;
  }

  if (error || !client) {
    return (
      <div className="space-y-4" data-testid="client-detail-page">
        <button
          type="button"
          onClick={() => navigate("/dashboard/clients")}
          data-testid="client-detail-back"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4B5563] hover:text-[#111827]"
        >
          {t("clientDetail.back")}
        </button>
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5 text-sm text-[#991B1B]">
          {error || t("clientDetail.notFound")}
        </div>
      </div>
    );
  }

  const sectionCounts = {
    quotes: clientQuotesTotal,
    invoices: clientInvoicesTotal,
    notes: clientNotesTotal,
    documents: clientDocsTotal,
  };

  return (
    <div className="space-y-6" data-testid="client-detail-page">
      <ClientDetailHeader
        client={client}
        lang={lang}
        t={t}
        onBack={() => navigate("/dashboard/clients")}
        onEdit={() => openEditClient(client)}
        onDelete={handleDelete}
        onCreateQuote={() => openAddQuote(client)}
        onCreateInvoice={() => openAddInvoice(client)}
      />

      <ClientSectionNav active={activeSection} counts={sectionCounts} t={t} onChange={setSection} />

      {activeSection === "overview" && (
        <div className="space-y-6">
          <ClientCommercialSummary stats={stats} lang={lang} t={t} />

          <ClientPortalAccess clientId={client.id} t={t} />

          <SectionPanel id="client-overview-follow-ups" title={t("followUpHistory.title")} testId="client-overview-follow-ups">
            <ClientFollowUpList
              items={followUps}
              loading={followUpsLoading}
              error={followUpsError}
              emptyLabel={t("followUpHistory.empty")}
              limit={5}
            />
            {followUpsTotal > 5 ? (
              <button
                type="button"
                onClick={() => navigate("/dashboard/communications?category=follow_up&clientId=" + client.id)}
                className="mt-3 text-xs font-medium text-[#0A2540] hover:underline"
              >
                {t("followUpHistory.seeAll")} ({followUpsTotal})
              </button>
            ) : null}
          </SectionPanel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ClientDocumentHighlight
              type="quote"
              document={stats.lastQuote}
              emptyLabel={t("clientDetail.noQuotes")}
              lang={lang}
              t={t}
              onClick={setViewingQuote}
            />
            <ClientDocumentHighlight
              type="invoice"
              document={stats.lastInvoice}
              emptyLabel={t("clientDetail.noInvoices")}
              lang={lang}
              t={t}
              onClick={setViewingInvoice}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionPanel id="client-overview-notes" title={t("nav.notes")} testId="client-overview-notes">
              {notesLoading ? (
                <div className="flex items-center text-sm text-[#6B7280]">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {t("noteForm.loading")}
                </div>
              ) : recentNotes.length ? (
                <ul className="space-y-2">
                  {recentNotes.map((n) => {
                    const typeKey = normalizeNoteType(n.type);
                    const typeStyle = getNoteTypeStyle(typeKey);
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => openEditNote(n)}
                          className="w-full text-left rounded-lg border border-[#F3F4F6] bg-[#FAFAFA] px-3 py-2.5 hover:border-[#0A2540]/20 transition-colors"
                          data-testid={`client-overview-note-${n.id}`}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}>
                              {t(`noteType.${typeKey}`)}
                            </span>
                            <span className="text-[11px] text-[#9CA3AF]">{formatNoteDate(getNoteDate(n), lang)}</span>
                          </div>
                          <div className="font-medium text-sm text-[#111827] truncate">{n.title}</div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-[#6B7280]">{t("clientDetail.noNotes")}</p>
              )}
              {clientNotesTotal > 3 ? (
                <button
                  type="button"
                  onClick={() => setSection("notes")}
                  className="mt-3 text-xs font-medium text-[#0A2540] hover:underline"
                >
                  {t("clientDetail.seeAllNotes")} ({clientNotesTotal})
                </button>
              ) : null}
            </SectionPanel>

            <SectionPanel id="client-overview-timeline" title={t("nav.timeline")} testId="client-overview-timeline">
              <ClientTimelineList
                events={overviewTimelineEvents}
                loading={timelineLoading}
                error={timelineError}
                emptyLabel={t("clientDetail.noTimeline")}
                limit={6}
                compact
              />
              {overviewTimelineEvents.length > 6 ? (
                <button
                  type="button"
                  onClick={() => setSection("timeline")}
                  className="mt-3 text-xs font-medium text-[#0A2540] hover:underline"
                >
                  {t("clientDetail.seeAllTimeline")}
                </button>
              ) : null}
            </SectionPanel>
          </div>
        </div>
      )}

      {activeSection === "quotes" && (
        <SectionPanel
          id="client-section-quotes"
          title={t("nav.quotes")}
          testId="client-section-quotes"
          action={
            <ActionButton variant="secondary" onClick={() => openAddQuote(client)} className="gap-1.5 h-8 text-xs">
              <Plus className="w-3.5 h-3.5" />
              {t("actions.createQuote")}
            </ActionButton>
          }
        >
          <div className="mb-4">
            <QuoteStatusFilter value={quoteStatusFilter} onChange={setQuoteStatusFilter} testId="client-quotes-status-filter" />
          </div>
          {quotesLoading ? (
            <div className="flex items-center text-sm text-[#6B7280]"><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("quoteForm.loading")}</div>
          ) : quotesError ? (
            <p className="text-sm text-[#991B1B]">{quotesError}</p>
          ) : filteredQuotes.length ? (
            <ul className="divide-y divide-[#F3F4F6]">
              {filteredQuotes.map((q) => (
                <li
                  key={q.id}
                  className="py-3 flex items-center justify-between gap-3 text-sm cursor-pointer hover:bg-[#FAFAFA] -mx-2 px-2 rounded-lg"
                  onClick={() => setViewingQuote(q)}
                  data-testid={`client-quote-${q.id}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[#111827]">{q.number} · {q.title}</div>
                    <div className="text-[#6B7280] text-xs mt-0.5">{formatQuoteDate(getQuoteDate(q), lang)}</div>
                    <FollowUpLastHint last={getQuoteFollowUp(q.id)} className="mt-0.5" />
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="font-medium text-[#111827] tabular-nums">{formatQuoteAmount(q.amountTTC, lang)}</span>
                    <StatusBadge kind="quote" status={q.status} size="sm" />
                    <CommercialPdfDownload type="quote" item={q} compact />
                    <QuoteInvoiceAction quote={q} compact />
                    <DocumentSendAction entityType="quote" entity={q} compact />
                    <FollowUpAction entityType="quote" entity={q} compact />
                    <ActionButton variant="dangerIcon" onClick={() => setDeletingQuote(q)} aria-label={t("actions.delete")}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#6B7280]">{quoteStatusFilter ? t("quotes.empty.filteredDesc") : t("clientDetail.noQuotes")}</p>
          )}
        </SectionPanel>
      )}

      {activeSection === "invoices" && (
        <SectionPanel
          id="client-section-invoices"
          title={t("nav.invoices")}
          testId="client-section-invoices"
          action={
            <ActionButton variant="secondary" onClick={() => openAddInvoice(client)} className="gap-1.5 h-8 text-xs">
              <Plus className="w-3.5 h-3.5" />
              {t("actions.createInvoice")}
            </ActionButton>
          }
        >
          <div className="mb-4">
            <InvoiceStatusFilter value={invoiceStatusFilter} onChange={setInvoiceStatusFilter} testId="client-invoices-status-filter" />
          </div>
          {invoicesLoading ? (
            <div className="flex items-center text-sm text-[#6B7280]"><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("invoiceForm.loading")}</div>
          ) : invoicesError ? (
            <p className="text-sm text-[#991B1B]">{invoicesError}</p>
          ) : filteredInvoices.length ? (
            <ul className="divide-y divide-[#F3F4F6]">
              {filteredInvoices.map((inv) => (
                <li
                  key={inv.id}
                  className="py-3 flex items-center justify-between gap-3 text-sm cursor-pointer hover:bg-[#FAFAFA] -mx-2 px-2 rounded-lg"
                  onClick={() => setViewingInvoice(inv)}
                  data-testid={`client-invoice-${inv.id}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[#111827]">{inv.number} · {inv.title}</div>
                    <div className="text-[#6B7280] text-xs mt-0.5">{formatInvoiceDate(getInvoiceDate(inv), lang)}</div>
                    <FollowUpLastHint last={getInvoiceFollowUp(inv.id)} className="mt-0.5" />
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="font-medium text-[#111827] tabular-nums">{formatInvoiceAmount(inv.amountTTC, lang)}</span>
                    <InvoiceStatusBadge invoice={inv} size="sm" />
                    <CommercialPdfDownload type="invoice" item={inv} compact />
                    <InvoicePaymentAction invoice={inv} compact />
                    <DocumentSendAction entityType="invoice" entity={inv} compact />
                    <FollowUpAction entityType="invoice" entity={inv} compact />
                    <ActionButton variant="dangerIcon" onClick={() => setDeletingInvoice(inv)} aria-label={t("actions.delete")}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#6B7280]">{invoiceStatusFilter ? t("invoices.empty.filteredDesc") : t("clientDetail.noInvoices")}</p>
          )}
        </SectionPanel>
      )}

      {activeSection === "notes" && (
        <SectionPanel
          id="client-section-notes"
          title={t("nav.notes")}
          testId="client-section-notes"
          action={
            <ActionButton variant="secondary" onClick={() => openAddNote(client)} className="gap-1.5 h-8 text-xs" data-testid="client-notes-add">
              <Plus className="w-3.5 h-3.5" />
              {t("actions.createNote")}
            </ActionButton>
          }
        >
          <div className="mb-4">
            <NoteTypeFilter value={noteTypeFilter} onChange={setNoteTypeFilter} testId="client-notes-type-filter" />
          </div>
          {notesLoading ? (
            <div className="flex items-center text-sm text-[#6B7280]"><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("noteForm.loading")}</div>
          ) : notesError ? (
            <p className="text-sm text-[#991B1B]">{notesError}</p>
          ) : clientNotes.length ? (
            <ul className="space-y-2">
              {clientNotes.map((n) => {
                const typeKey = normalizeNoteType(n.type);
                const typeStyle = getNoteTypeStyle(typeKey);
                return (
                  <li
                    key={n.id}
                    className="p-3 rounded-lg bg-[#FAFAFA] border border-[#F3F4F6] cursor-pointer hover:border-[#0A2540]/20"
                    onClick={() => openEditNote(n)}
                    data-testid={`client-note-${n.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}>
                            {t(`noteType.${typeKey}`)}
                          </span>
                          <span className="text-[11px] text-[#9CA3AF]">{formatNoteDate(getNoteDate(n), lang)}</span>
                        </div>
                        <div className="font-medium text-sm text-[#111827]">{n.title}</div>
                        <p className="text-xs text-[#4B5563] mt-1 line-clamp-3 whitespace-pre-wrap">{n.content}</p>
                      </div>
                      <ActionButton
                        variant="dangerIcon"
                        onClick={(e) => { e.stopPropagation(); setDeletingNote(n); }}
                        aria-label={t("actions.delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </ActionButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[#6B7280]">{noteTypeFilter ? t("notes.empty.filteredDesc") : t("clientDetail.noNotes")}</p>
          )}
        </SectionPanel>
      )}

      {activeSection === "documents" && (
        <SectionPanel id="client-section-documents" title={t("nav.documents")} testId="client-section-documents">
          <div className="space-y-4">
            <DocumentDropzone onUpload={handleUploadDocument} compact testId="client-documents-dropzone" />
            {docsLoading ? (
              <div className="flex items-center text-sm text-[#6B7280]"><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("documents.loading")}</div>
            ) : docsError ? (
              <p className="text-sm text-[#991B1B]">{docsError}</p>
            ) : clientDocs.length ? (
              <ul className="divide-y divide-[#F3F4F6]">
                {clientDocs.map((doc) => {
                  const typeStyle = getDocumentTypeStyle(doc);
                  return (
                    <li key={doc.id} className="py-3 flex items-center justify-between gap-3 text-sm" data-testid={`client-document-${doc.id}`}>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[#111827] truncate">{doc.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}>
                            {typeStyle.label}
                          </span>
                          <span className="text-[11px] text-[#9CA3AF]">{formatFileSize(doc.sizeBytes, lang)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canPreviewDocument(doc) && (
                          <ActionButton variant="ghostIcon" aria-label={t("documents.preview")} onClick={() => setPreviewDoc(doc)}>
                            <Eye className="w-3.5 h-3.5" />
                          </ActionButton>
                        )}
                        <ActionButton
                          variant="ghostIcon"
                          aria-label={t("documents.download")}
                          disabled={docActionId === doc.id}
                          onClick={() => handleDownloadDocument(doc)}
                        >
                          {docActionId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        </ActionButton>
                        <ActionButton variant="dangerIcon" aria-label={t("documents.deleteAction")} onClick={() => setDeletingDoc(doc)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </ActionButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-[#6B7280]">{t("clientDetail.noItems")}</p>
            )}
          </div>
        </SectionPanel>
      )}

      {activeSection === "timeline" && (
        <SectionPanel id="client-section-timeline" title={t("nav.timeline")} testId="client-section-timeline">
          <ClientTimelineList
            events={timelineEvents}
            loading={timelineLoading}
            error={timelineError}
            emptyLabel={t("clientDetail.noTimeline")}
          />
        </SectionPanel>
      )}

      <DeleteConfirmDialog
        open={Boolean(deletingNote)}
        onOpenChange={(open) => !open && !deleteNoteSubmitting && setDeletingNote(null)}
        title={t("noteForm.deleteTitle")}
        description={t("noteForm.deleteDesc")}
        cancelLabel={t("noteForm.cancel")}
        confirmLabel={t("noteForm.confirmDelete")}
        onConfirm={handleDeleteNote}
        submitting={deleteNoteSubmitting}
        testId="client-note-delete-dialog"
      />
      <DocumentPreviewModal document={previewDoc} open={Boolean(previewDoc)} onOpenChange={(open) => !open && setPreviewDoc(null)} />
      <DeleteConfirmDialog
        open={Boolean(deletingDoc)}
        onOpenChange={(open) => !open && !deleteDocSubmitting && setDeletingDoc(null)}
        title={t("documents.deleteTitle")}
        description={t("documents.deleteDesc")}
        cancelLabel={t("documents.cancel")}
        confirmLabel={t("documents.confirmDelete")}
        onConfirm={handleDeleteDocument}
        submitting={deleteDocSubmitting}
        testId="client-document-delete-dialog"
      />
      <DeleteConfirmDialog
        open={Boolean(deletingQuote)}
        onOpenChange={(open) => !open && !deleteQuoteSubmitting && setDeletingQuote(null)}
        title={t("quoteForm.deleteTitle")}
        description={t("quoteForm.deleteDesc")}
        cancelLabel={t("quoteForm.cancel")}
        confirmLabel={t("quoteForm.confirmDelete")}
        onConfirm={handleDeleteQuote}
        submitting={deleteQuoteSubmitting}
        testId="client-quote-delete-dialog"
      />
      <DeleteConfirmDialog
        open={Boolean(deletingInvoice)}
        onOpenChange={(open) => !open && !deleteInvoiceSubmitting && setDeletingInvoice(null)}
        title={t("invoiceForm.deleteTitle")}
        description={t("invoiceForm.deleteDesc")}
        cancelLabel={t("invoiceForm.cancel")}
        confirmLabel={t("invoiceForm.confirmDelete")}
        onConfirm={handleDeleteInvoice}
        submitting={deleteInvoiceSubmitting}
        testId="client-invoice-delete-dialog"
      />
      <CommercialDocumentDetailModal
        type="quote"
        document={viewingQuote}
        open={Boolean(viewingQuote)}
        onOpenChange={(open) => !open && setViewingQuote(null)}
        onEdit={(quote) => { setViewingQuote(null); openEditQuote(quote); }}
      />
      <CommercialDocumentDetailModal
        type="invoice"
        document={viewingInvoice}
        open={Boolean(viewingInvoice)}
        onOpenChange={(open) => !open && setViewingInvoice(null)}
        onEdit={(invoice) => { setViewingInvoice(null); openEditInvoice(invoice); }}
      />
    </div>
  );
}
