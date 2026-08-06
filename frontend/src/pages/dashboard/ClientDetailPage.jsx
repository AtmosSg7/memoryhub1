import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { FileText, Receipt, StickyNote, Trash2, Loader2, Eye, Download, FolderClosed } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddClient } from "@/context/AddClientContext";
import { useClients } from "@/hooks/useClients";
import { useAddNote } from "@/context/AddNoteContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { useClientQuotes } from "@/hooks/useClientQuotes";
import { useClientInvoices } from "@/hooks/useClientInvoices";
import { useClient } from "@/hooks/useClient";
import { useClientNotes } from "@/hooks/useClientNotes";
import { useClientDocuments } from "@/hooks/useClientDocuments";
import { useClientTimelineV2 } from "@/hooks/useClientTimelineV2";
import { useFollowUpLastMap } from "@/hooks/useFollowUpLastMap";
import { useListPagination } from "@/hooks/useListPagination";
import { useDocumentsContext } from "@/context/DocumentsContext";
import { deleteClient, getClient360, updateClient } from "@/lib/clientsApi";
import { deleteNote } from "@/lib/notesApi";
import { deleteQuote, getQuote } from "@/lib/quotesApi";
import { deleteInvoice, getInvoice } from "@/lib/invoicesApi";
import {
  deleteDocument,
  fetchDocumentBlob,
  triggerBlobDownload,
  uploadDocument,
} from "@/lib/documentsApi";
import QuoteStatusFilter from "@/components/dashboard/QuoteStatusFilter";
import CommercialDocumentRowActions from "@/components/dashboard/CommercialDocumentRowActions";
import CommercialDocumentDetailModal from "@/components/dashboard/CommercialDocumentDetailModal";
import InvoiceStatusFilter from "@/components/dashboard/InvoiceStatusFilter";
import NoteTypeFilter from "@/components/dashboard/NoteTypeFilter";
import DocumentDropzone from "@/components/dashboard/DocumentDropzone";
import DocumentPreviewModal from "@/components/dashboard/DocumentPreviewModal";
import DeleteConfirmDialog from "@/components/dashboard/DeleteConfirmDialog";
import StatusBadge from "@/components/dashboard/StatusBadge";
import InvoiceStatusBadge from "@/components/dashboard/InvoiceStatusBadge";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { PageLoader, InlineLoader, PageError } from "@/components/dashboard/PageFeedback";
import ClientDetailHeader from "@/components/dashboard/client/ClientDetailHeader";
import ClientDocumentHighlight from "@/components/dashboard/client/ClientDocumentHighlight";
import ClientTimelineList from "@/components/dashboard/client/ClientTimelineList";
import FollowUpLastHint from "@/components/dashboard/FollowUpLastHint";
import ListCollectionFooter from "@/components/dashboard/ListCollectionFooter";
import ClientSectionNav from "@/components/dashboard/client/ClientSectionNav";
import ClientContactsSection from "@/components/dashboard/client/ClientContactsSection";
import ClientEmailsSection from "@/components/dashboard/client/ClientEmailsSection";
import ClientInboxSection from "@/components/dashboard/client/ClientInboxSection";
import ClientRelationSummary from "@/components/dashboard/client/ClientRelationSummary";
import SectionPanel from "@/components/dashboard/client/SectionPanel";
import {
  CLIENT_DIVIDER_LIST_CLASS,
  CLIENT_FILTER_WRAP_CLASS,
  CLIENT_LIST_ROW_STATIC_CLASS,
  CLIENT_NOTE_CARD_CLASS,
  ClientSectionAction,
  ClientSectionLink,
  ClientTabEmpty,
} from "@/components/dashboard/client/clientDetailLayout";
import { formatQuoteAmount, formatQuoteDate, getQuoteDate } from "@/utils/quoteDisplay";
import {
  formatInvoiceAmount,
  formatInvoiceDate,
  getInvoiceDate,
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
import { getDisplayCompany, isClientFavorite, normalizeClient } from "@/utils/clientDisplay";
import { prepareContactsForSave } from "@/utils/clientContacts";

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, lang } = useDashboardLang();
  const { openEditClient, notifyClientsChanged } = useAddClient();
  const { clients: allClients } = useClients();
  const { openAddNote, openEditNote, notifyNotesChanged } = useAddNote();
  const { openAddQuote, openEditQuote, notifyQuotesChanged, pendingOpenQuote, clearPendingOpenQuote, refreshKey: quotesRefreshKey } = useAddQuote();
  const { openAddInvoice, openEditInvoice, notifyInvoicesChanged, pendingOpenInvoice, clearPendingOpenInvoice, refreshKey: invoicesRefreshKey } = useAddInvoice();
  const { notifyDocumentsChanged } = useDocumentsContext();

  const { client, loading, error, refetch } = useClient(id);
  const [noteTypeFilter, setNoteTypeFilter] = useState("");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("");
  const [contactsSaving, setContactsSaving] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [emailsTotal, setEmailsTotal] = useState(0);
  const activeSection = searchParams.get("section") || "overview";
  const needsOverview = activeSection === "overview";
  const needsQuotesSection = activeSection === "quotes";
  const needsInvoicesSection = activeSection === "invoices";
  const needsNotesSection = activeSection === "notes";
  const needsTimelineSection = activeSection === "timeline";

  const { notes: clientNotes, total: clientNotesTotal, loading: notesLoading, error: notesError } =
    useClientNotes(id, noteTypeFilter, { enabled: needsOverview || needsNotesSection });
  const { quotes: overviewQuotes, total: overviewQuotesTotal } =
    useClientQuotes(id, "", { enabled: needsOverview });
  const {
    quotes: loadedSectionQuotes,
    total: sectionQuotesTotal,
    loading: quotesLoading,
    error: quotesError,
  } = useClientQuotes(id, quoteStatusFilter, { enabled: needsQuotesSection });
  const { invoices: overviewInvoices, total: overviewInvoicesTotal } =
    useClientInvoices(id, "", { enabled: needsOverview });
  const {
    invoices: loadedSectionInvoices,
    total: sectionInvoicesTotal,
    loading: invoicesLoading,
    error: invoicesError,
  } = useClientInvoices(id, invoiceStatusFilter, { enabled: needsInvoicesSection });
  const { documents: clientDocs, total: clientDocsTotal, loading: docsLoading, error: docsError } =
    useClientDocuments(id, { enabled: activeSection === "documents" });
  const {
    items: timelineItems,
    summary: timelineSummary,
    total: timelineTotal,
    loading: timelineLoading,
    loadingMore: timelineLoadingMore,
    error: timelineError,
    hasMore: timelineHasMore,
    loadMore: loadMoreTimeline,
    category: timelineCategory,
    setCategory: setTimelineCategory,
    refetch: refetchTimeline,
  } = useClientTimelineV2(id, {
    pageSize: 40,
    enabled: needsOverview || needsTimelineSection,
  });
  const quotesForSection = needsQuotesSection ? loadedSectionQuotes : overviewQuotes;
  const invoicesForSection = needsInvoicesSection ? loadedSectionInvoices : overviewInvoices;
  const clientQuotesTotal = needsQuotesSection ? sectionQuotesTotal : overviewQuotesTotal;
  const clientInvoicesTotal = needsInvoicesSection ? sectionInvoicesTotal : overviewInvoicesTotal;

  const {
    pageItems: pagedQuotes,
    page: quotesPage,
    setPage: setQuotesPage,
    totalPages: quotesTotalPages,
    rangeStart: quotesRangeStart,
    rangeEnd: quotesRangeEnd,
    totalItems: quotesLoadedCount,
  } = useListPagination(quotesForSection, { pageSize: 20, resetKey: `${quoteStatusFilter}:${id}` });

  const {
    pageItems: pagedInvoices,
    page: invoicesPage,
    setPage: setInvoicesPage,
    totalPages: invoicesTotalPages,
    rangeStart: invoicesRangeStart,
    rangeEnd: invoicesRangeEnd,
    totalItems: invoicesLoadedCount,
  } = useListPagination(invoicesForSection, { pageSize: 20, resetKey: `${invoiceStatusFilter}:${id}` });

  const {
    pageItems: pagedNotes,
    page: notesPage,
    setPage: setNotesPage,
    totalPages: notesTotalPages,
    rangeStart: notesRangeStart,
    rangeEnd: notesRangeEnd,
    totalItems: notesLoadedCount,
  } = useListPagination(clientNotes, { pageSize: 20, resetKey: `${noteTypeFilter}:${id}` });

  const {
    pageItems: pagedClientDocs,
    page: docsPage,
    setPage: setDocsPage,
    totalPages: docsTotalPages,
    rangeStart: docsRangeStart,
    rangeEnd: docsRangeEnd,
    totalItems: docsLoadedCount,
  } = useListPagination(clientDocs, { pageSize: 20, resetKey: id });

  const { getLast: getQuoteFollowUp } = useFollowUpLastMap("quote", pagedQuotes, {
    enabled: needsQuotesSection,
  });
  const { getLast: getInvoiceFollowUp } = useFollowUpLastMap("invoice", pagedInvoices, {
    enabled: needsInvoicesSection,
  });

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

  const setSection = (section) => {
    if (section === "overview") {
      searchParams.delete("section");
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ section }, { replace: true });
    }
  };

  const stats = useMemo(
    () => computeClientCommercialStats(overviewQuotes, overviewInvoices),
    [overviewQuotes, overviewInvoices],
  );

  const sortedClients = useMemo(
    () => [...allClients].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [allClients]
  );
  const clientIndex = sortedClients.findIndex((entry) => entry.id === id);
  const prevClient = clientIndex > 0 ? sortedClients[clientIndex - 1] : null;
  const nextClient =
    clientIndex >= 0 && clientIndex < sortedClients.length - 1
      ? sortedClients[clientIndex + 1]
      : null;

  const navigateToClient = (targetId) => {
    const suffix = activeSection && activeSection !== "overview" ? `?section=${activeSection}` : "";
    navigate(`/dashboard/clients/${targetId}${suffix}`);
  };

  const recentNotes = useMemo(() => clientNotes.slice(0, 3), [clientNotes]);

  const overviewTimelineItems = useMemo(
    () => timelineItems.filter((item) => item.type !== "follow_up_recorded"),
    [timelineItems],
  );

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
    if (!id) return;
    let cancelled = false;
    getClient360(id)
      .then((payload) => {
        if (cancelled) return;
        setEmailsTotal(payload?.stats?.exchangesTotal ?? 0);
      })
      .catch(() => {
        if (!cancelled) setEmailsTotal(0);
      });
    return () => {
      cancelled = true;
    };
  }, [id, quotesRefreshKey, invoicesRefreshKey]);

  useEffect(() => {
    if (!id) return;
    import("@/lib/onboardingApi")
      .then(({ markClient360Viewed }) => markClient360Viewed())
      .catch(() => {});
  }, [id]);

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

  const handleDelete = async () => {
    try {
      await deleteClient(id);
      notifyClientsChanged();
      toast.success(t("toast.clientDeleted"));
      navigate("/dashboard/clients");
    } catch (err) {
      toastApiError(err, t, "toast.clientError");
    }
  };

  const handleSaveContacts = async (partial) => {
    if (!client?.id) return;
    setContactsSaving(true);
    try {
      const normalized = normalizeClient(client);
      const payload = {
        emails: prepareContactsForSave(partial.emails ?? normalized.emails),
        phones: prepareContactsForSave(partial.phones ?? normalized.phones),
        addresses: prepareContactsForSave(partial.addresses ?? normalized.addresses),
      };
      // Only send the changed collection(s)
      const body = {};
      if (partial.emails) body.emails = payload.emails;
      if (partial.phones) body.phones = payload.phones;
      if (partial.addresses) body.addresses = payload.addresses;
      await updateClient(client.id, body);
      notifyClientsChanged();
      await refetch();
      toast.success(t("toast.clientUpdated"));
    } catch (err) {
      toastApiError(err, t, "toast.clientError");
    } finally {
      setContactsSaving(false);
    }
  };

  const handleSaveTags = async (tags) => {
    if (!client?.id) return;
    setContactsSaving(true);
    try {
      await updateClient(client.id, { tags });
      notifyClientsChanged();
      await refetch();
      toast.success(t("toast.clientUpdated"));
    } catch (err) {
      toastApiError(err, t, "toast.clientError");
    } finally {
      setContactsSaving(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!client?.id || favoriteSaving) return;
    setFavoriteSaving(true);
    try {
      const next = !isClientFavorite(client);
      await updateClient(client.id, { isFavorite: next });
      notifyClientsChanged();
      await refetch();
      toast.success(next ? t("clientDetail.favoriteOn") : t("clientDetail.favoriteOff"));
    } catch (err) {
      toastApiError(err, t, "toast.clientError");
    } finally {
      setFavoriteSaving(false);
    }
  };

  const handleUploadDocument = async (file) => {
    try {
      await uploadDocument(file, id);
      notifyDocumentsChanged();
      toast.success(t("toast.documentUploaded"));
    } catch (err) {
      toastApiError(err, t, "toast.documentError");
    }
  };

  const handleDownloadDocument = async (doc) => {
    setDocActionId(doc.id);
    try {
      const blob = await fetchDocumentBlob(doc.id, "download");
      triggerBlobDownload(blob, doc.name);
    } catch (err) {
      toastApiError(err, t, "documents.errors.downloadFailed");
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
      toastApiError(err, t, "toast.noteError");
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
      toastApiError(err, t, "toast.quoteError");
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
      toastApiError(err, t, "toast.invoiceError");
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
      toastApiError(err, t, "toast.documentError");
    } finally {
      setDeleteDocSubmitting(false);
    }
  };

  if (loading) {
    return <PageLoader label={t("clientForm.loading")} testId="client-detail-loading" />;
  }

  if (error || !client) {
    return (
      <div className="space-y-6" data-testid="client-detail-page">
        <button
          type="button"
          onClick={() => navigate("/dashboard/clients")}
          data-testid="client-detail-back"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-dash-text-muted hover:text-dash-text transition-colors"
        >
          {t("clientDetail.back")}
        </button>
        <PageError message={error || t("clientDetail.notFound")} testId="client-detail-error" />
      </div>
    );
  }

  const sectionCounts = {
    emails: timelineSummary?.communicationCount ?? emailsTotal,
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
        lastExchangeAt={timelineSummary?.lastExchangeAt}
        onBack={() => navigate("/dashboard/clients")}
        onPrevClient={prevClient ? () => navigateToClient(prevClient.id) : undefined}
        onNextClient={nextClient ? () => navigateToClient(nextClient.id) : undefined}
        prevClientLabel={prevClient ? getDisplayCompany(prevClient) : ""}
        nextClientLabel={nextClient ? getDisplayCompany(nextClient) : ""}
        onEdit={() => openEditClient(client)}
        onDelete={handleDelete}
        onCreateQuote={() => openAddQuote(client)}
        onCreateInvoice={() => openAddInvoice(client)}
        onCreateNote={() => openAddNote(client)}
        onCreateReminder={() => openAddNote(client)}
        onOpenCommunications={() => setSection("emails")}
        onImportDocument={() => navigate("/dashboard/documents?import=1")}
        onToggleFavorite={handleToggleFavorite}
        favoriteSaving={favoriteSaving}
      />

      <ClientSectionNav active={activeSection} counts={sectionCounts} t={t} onChange={setSection} />

      {activeSection === "overview" && (
        <div className="space-y-6">
          <ClientRelationSummary
            summary={timelineSummary}
            lang={lang}
            loading={timelineLoading}
            error={timelineError}
            clientId={id}
            onChanged={refetchTimeline}
            onSeeAllActions={() => setSection("timeline")}
            showOpenActions
          />

          <SectionPanel id="client-overview-timeline" title={t("nav.timeline")} testId="client-overview-timeline">
            <ClientTimelineList
              items={overviewTimelineItems}
              summary={timelineSummary}
              loading={false}
              error={null}
              emptyLabel={timelineLoading ? undefined : t("clientDetail.noTimeline")}
              limit={8}
              compact
              clientId={id}
              showFilters={false}
              showSummary={false}
              showOpenActions={false}
              onChanged={refetchTimeline}
            />
            {overviewTimelineItems.length > 8 || timelineTotal > 8 ? (
              <ClientSectionLink onClick={() => setSection("timeline")}>
                {t("clientDetail.seeAllTimeline")}
              </ClientSectionLink>
            ) : null}
          </SectionPanel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ClientDocumentHighlight
              type="quote"
              document={stats.lastQuote}
              emptyLabel={t("clientDetail.noQuotes")}
              emptyActionLabel={t("documentActions.importDocument")}
              onEmptyAction={() => navigate("/dashboard/documents?import=1")}
              lang={lang}
              t={t}
              onClick={setViewingQuote}
            />
            <ClientDocumentHighlight
              type="invoice"
              document={stats.lastInvoice}
              emptyLabel={t("clientDetail.noInvoices")}
              emptyActionLabel={t("documentActions.importDocument")}
              onEmptyAction={() => navigate("/dashboard/documents?import=1")}
              lang={lang}
              t={t}
              onClick={setViewingInvoice}
            />
          </div>

          <SectionPanel
            id="client-overview-notes"
            title={t("nav.notes")}
            testId="client-overview-notes"
            action={
              <ClientSectionAction icon={StickyNote} onClick={() => openAddNote(client)}>
                {t("actions.createNote")}
              </ClientSectionAction>
            }
          >
            {notesLoading ? (
              <InlineLoader label={t("noteForm.loading")} className="py-6 justify-start" />
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
                        className={CLIENT_NOTE_CARD_CLASS}
                        data-testid={`client-overview-note-${n.id}`}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}>
                            {t(`noteType.${typeKey}`)}
                          </span>
                          <span className="text-[11px] text-dash-text-subtle">{formatNoteDate(getNoteDate(n), lang)}</span>
                        </div>
                        <div className="font-medium text-sm text-dash-text truncate">{n.title}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ClientTabEmpty
                icon={StickyNote}
                title={t("clientDetail.noNotes")}
                cta={t("actions.createNote")}
                onCta={() => openAddNote(client)}
                testId="client-overview-notes-empty"
              />
            )}
            {clientNotesTotal > 3 ? (
              <ClientSectionLink onClick={() => setSection("notes")}>
                {t("clientDetail.seeAllNotes")} ({clientNotesTotal})
              </ClientSectionLink>
            ) : null}
          </SectionPanel>
        </div>
      )}

      {activeSection === "contacts" && (
        <ClientContactsSection
          client={client}
          t={t}
          saving={contactsSaving}
          onSaveContacts={handleSaveContacts}
          onSaveTags={handleSaveTags}
        />
      )}

      {activeSection === "emails" && (
        <SectionPanel
          id="client-section-emails"
          title={t("clientInbox.title")}
          subtitle={t("clientInbox.subtitle")}
          testId="client-section-emails"
        >
          <div className="space-y-8">
            <ClientInboxSection
              clientId={client.id}
              t={t}
              lang={lang}
              initialConversationId={searchParams.get("conversation")}
            />
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-dash-text-subtle mb-3">
                {t("clientEmails.title")}
              </h3>
              <ClientEmailsSection clientId={client.id} t={t} lang={lang} />
            </div>
          </div>
        </SectionPanel>
      )}

      {activeSection === "quotes" && (
        <SectionPanel
          id="client-section-quotes"
          title={t("nav.quotes")}
          testId="client-section-quotes"
          action={
            <ClientSectionAction icon={FileText} onClick={() => navigate("/dashboard/documents?import=1")}>
              {t("documentActions.importDocument")}
            </ClientSectionAction>
          }
        >
          <div className={CLIENT_FILTER_WRAP_CLASS}>
            <QuoteStatusFilter value={quoteStatusFilter} onChange={setQuoteStatusFilter} testId="client-quotes-status-filter" />
          </div>
          {quotesLoading ? (
            <InlineLoader label={t("quoteForm.loading")} className="py-6 justify-start" />
          ) : quotesError ? (
            <PageError message={quotesError} testId="client-quotes-error" />
          ) : quotesForSection.length ? (
            <>
            <ul className={CLIENT_DIVIDER_LIST_CLASS}>
              {pagedQuotes.map((q) => (
                <li
                  key={q.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm cursor-pointer hover:bg-dash-surface-muted -mx-2 px-2 rounded-lg transition-colors"
                  onClick={() => setViewingQuote(q)}
                  data-testid={`client-quote-${q.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-dash-text">{q.number} · {q.title}</div>
                    <div className="text-dash-text-muted text-xs mt-0.5">{formatQuoteDate(getQuoteDate(q), lang)}</div>
                    <FollowUpLastHint last={getQuoteFollowUp(q.id)} className="mt-0.5" />
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-dash-text tabular-nums">
                        {formatQuoteAmount(q.amountTTC, lang)}
                      </span>
                      <StatusBadge kind="quote" status={q.status} size="sm" />
                    </div>
                    <CommercialDocumentRowActions
                      kind="quote"
                      document={q}
                      onView={() => setViewingQuote(q)}
                      onEdit={(doc) => openEditQuote(doc)}
                      onImportFinalInvoice={() => navigate("/dashboard/documents?import=1")}
                      onDelete={() => setDeletingQuote(q)}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <ListCollectionFooter
              t={t}
              loadedCount={quotesLoadedCount}
              total={clientQuotesTotal}
              rangeStart={quotesRangeStart}
              rangeEnd={quotesRangeEnd}
              page={quotesPage}
              totalPages={quotesTotalPages}
              onPageChange={setQuotesPage}
              testId="client-quotes-footer"
            />
            </>
          ) : (
            <ClientTabEmpty
              icon={FileText}
              filtered={Boolean(quoteStatusFilter)}
              filteredTitle={t("quotes.empty.filteredTitle")}
              filteredDesc={t("quotes.empty.filteredDesc")}
              title={t("clientDetail.noQuotes")}
              cta={t("documentActions.importDocument")}
              onCta={() => navigate("/dashboard/documents?import=1")}
              testId="client-quotes-empty"
            />
          )}
        </SectionPanel>
      )}

      {activeSection === "invoices" && (
        <SectionPanel
          id="client-section-invoices"
          title={t("nav.invoices")}
          testId="client-section-invoices"
          action={
            <ClientSectionAction icon={Receipt} onClick={() => navigate("/dashboard/documents?import=1")}>
              {t("documentActions.importDocument")}
            </ClientSectionAction>
          }
        >
          <div className={CLIENT_FILTER_WRAP_CLASS}>
            <InvoiceStatusFilter value={invoiceStatusFilter} onChange={setInvoiceStatusFilter} testId="client-invoices-status-filter" />
          </div>
          {invoicesLoading ? (
            <InlineLoader label={t("invoiceForm.loading")} className="py-6 justify-start" />
          ) : invoicesError ? (
            <PageError message={invoicesError} testId="client-invoices-error" />
          ) : invoicesForSection.length ? (
            <>
            <ul className={CLIENT_DIVIDER_LIST_CLASS}>
              {pagedInvoices.map((inv) => (
                <li
                  key={inv.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm cursor-pointer hover:bg-dash-surface-muted -mx-2 px-2 rounded-lg transition-colors"
                  onClick={() => setViewingInvoice(inv)}
                  data-testid={`client-invoice-${inv.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-dash-text">{inv.number} · {inv.title}</div>
                    <div className="text-dash-text-muted text-xs mt-0.5">{formatInvoiceDate(getInvoiceDate(inv), lang)}</div>
                    <FollowUpLastHint last={getInvoiceFollowUp(inv.id)} className="mt-0.5" />
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-dash-text tabular-nums">
                        {formatInvoiceAmount(inv.amountTTC, lang)}
                      </span>
                      <InvoiceStatusBadge invoice={inv} size="sm" />
                    </div>
                    <CommercialDocumentRowActions
                      kind="invoice"
                      document={inv}
                      onView={() => setViewingInvoice(inv)}
                      onEdit={(doc) => openEditInvoice(doc)}
                      onImportFinalInvoice={() => navigate("/dashboard/documents?import=1")}
                      onDelete={() => setDeletingInvoice(inv)}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <ListCollectionFooter
              t={t}
              loadedCount={invoicesLoadedCount}
              total={clientInvoicesTotal}
              rangeStart={invoicesRangeStart}
              rangeEnd={invoicesRangeEnd}
              page={invoicesPage}
              totalPages={invoicesTotalPages}
              onPageChange={setInvoicesPage}
              testId="client-invoices-footer"
            />
            </>
          ) : (
            <ClientTabEmpty
              icon={Receipt}
              filtered={Boolean(invoiceStatusFilter)}
              filteredTitle={t("invoices.empty.filteredTitle")}
              filteredDesc={t("invoices.empty.filteredDesc")}
              title={t("clientDetail.noInvoices")}
              cta={t("documentActions.importDocument")}
              onCta={() => navigate("/dashboard/documents?import=1")}
              testId="client-invoices-empty"
            />
          )}
        </SectionPanel>
      )}

      {activeSection === "notes" && (
        <SectionPanel
          id="client-section-notes"
          title={t("nav.notes")}
          testId="client-section-notes"
          action={
            <ClientSectionAction icon={StickyNote} onClick={() => openAddNote(client)} testId="client-notes-add">
              {t("actions.createNote")}
            </ClientSectionAction>
          }
        >
          <div className={CLIENT_FILTER_WRAP_CLASS}>
            <NoteTypeFilter value={noteTypeFilter} onChange={setNoteTypeFilter} testId="client-notes-type-filter" />
          </div>
          {notesLoading ? (
            <InlineLoader label={t("noteForm.loading")} className="py-6 justify-start" />
          ) : notesError ? (
            <PageError message={notesError} testId="client-notes-error" />
          ) : clientNotes.length ? (
            <>
            <ul className="space-y-2">
              {pagedNotes.map((n) => {
                const typeKey = normalizeNoteType(n.type);
                const typeStyle = getNoteTypeStyle(typeKey);
                return (
                  <li
                    key={n.id}
                    className="rounded-lg border border-dash-border bg-dash-surface-muted p-3 cursor-pointer hover:border-dash-primary/20 transition-colors"
                    onClick={() => openEditNote(n)}
                    data-testid={`client-note-${n.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}>
                            {t(`noteType.${typeKey}`)}
                          </span>
                          <span className="text-[11px] text-dash-text-subtle">{formatNoteDate(getNoteDate(n), lang)}</span>
                        </div>
                        <div className="font-medium text-sm text-dash-text">{n.title}</div>
                        <p className="text-xs text-dash-text-muted mt-1 line-clamp-3 whitespace-pre-wrap">{n.content}</p>
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
            <ListCollectionFooter
              t={t}
              loadedCount={notesLoadedCount}
              total={clientNotesTotal}
              rangeStart={notesRangeStart}
              rangeEnd={notesRangeEnd}
              page={notesPage}
              totalPages={notesTotalPages}
              onPageChange={setNotesPage}
              testId="client-notes-footer"
            />
            </>
          ) : (
            <ClientTabEmpty
              icon={StickyNote}
              filtered={Boolean(noteTypeFilter)}
              filteredTitle={t("notes.empty.filteredTitle")}
              filteredDesc={t("notes.empty.filteredDesc")}
              title={t("clientDetail.noNotes")}
              cta={t("actions.createNote")}
              onCta={() => openAddNote(client)}
              testId="client-notes-empty"
            />
          )}
        </SectionPanel>
      )}

      {activeSection === "documents" && (
        <SectionPanel id="client-section-documents" title={t("nav.files")} testId="client-section-documents">
          <div className="space-y-4">
            <DocumentDropzone onUpload={handleUploadDocument} compact testId="client-documents-dropzone" />
            {docsLoading ? (
              <InlineLoader label={t("documents.loading")} className="py-6 justify-start" />
            ) : docsError ? (
              <PageError message={docsError} testId="client-documents-error" />
            ) : clientDocs.length ? (
              <>
              <ul className={CLIENT_DIVIDER_LIST_CLASS}>
                {pagedClientDocs.map((doc) => {
                  const typeStyle = getDocumentTypeStyle(doc);
                  return (
                    <li key={doc.id} className={CLIENT_LIST_ROW_STATIC_CLASS} data-testid={`client-document-${doc.id}`}>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-dash-text truncate">{doc.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}>
                            {typeStyle.label}
                          </span>
                          <span className="text-[11px] text-dash-text-subtle">{formatFileSize(doc.sizeBytes, lang)}</span>
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
              <ListCollectionFooter
                t={t}
                loadedCount={docsLoadedCount}
                total={clientDocsTotal}
                rangeStart={docsRangeStart}
                rangeEnd={docsRangeEnd}
                page={docsPage}
                totalPages={docsTotalPages}
                onPageChange={setDocsPage}
                testId="client-documents-list-footer"
              />
              </>
            ) : (
              <ClientTabEmpty
                icon={FolderClosed}
                title={t("clientDetail.noDocuments")}
                testId="client-documents-empty"
              />
            )}
          </div>
        </SectionPanel>
      )}

      {activeSection === "timeline" && (
        <SectionPanel id="client-section-timeline" title={t("nav.timeline")} testId="client-section-timeline">
          <ClientTimelineList
            items={timelineItems}
            summary={timelineSummary}
            loading={timelineLoading}
            error={timelineError}
            emptyLabel={t("clientDetail.noTimeline")}
            hasMore={timelineHasMore}
            loadingMore={timelineLoadingMore}
            onLoadMore={loadMoreTimeline}
            category={timelineCategory}
            onCategoryChange={setTimelineCategory}
            clientId={id}
            showFilters
            showSummary
            showOpenActions
            onChanged={refetchTimeline}
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
