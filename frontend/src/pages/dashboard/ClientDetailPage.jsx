import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";

import {

  ArrowLeft,

  Mail,

  Phone,

  MapPin,

  FileText,

  Receipt,

  StickyNote,

  FolderClosed,

  Sparkles,

  MessageSquare,

  Pencil,

  Trash2,

  Loader2,

  Plus,

  Eye,

  Download,

} from "lucide-react";

import { toast } from "sonner";

import { useDashboardLang } from "@/hooks/useDashboardLang";

import { useAddClient } from "@/context/AddClientContext";
import { useAddNote } from "@/context/AddNoteContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { useClientQuotes } from "@/hooks/useClientQuotes";
import { useClientInvoices } from "@/hooks/useClientInvoices";
import QuoteStatusFilter from "@/components/dashboard/QuoteStatusFilter";
import QuoteInvoiceAction from "@/components/dashboard/QuoteInvoiceAction";
import CommercialPdfDownload from "@/components/dashboard/CommercialPdfDownload";
import CommercialDocumentDetailModal from "@/components/dashboard/CommercialDocumentDetailModal";
import InvoiceStatusFilter from "@/components/dashboard/InvoiceStatusFilter";
import InvoicePaymentAction from "@/components/dashboard/InvoicePaymentAction";
import { formatQuoteAmount, formatQuoteDate, getQuoteDate, getQuoteStatusStyle } from "@/utils/quoteDisplay";
import { formatInvoiceAmount, formatInvoiceDate, getInvoiceDate, getInvoiceStatusStyle, normalizeInvoiceStatus } from "@/utils/invoiceDisplay";

import { useClient } from "@/hooks/useClient";

import { useClientNotes } from "@/hooks/useClientNotes";

import { useClientDocuments } from "@/hooks/useClientDocuments";

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

import DocumentDropzone from "@/components/dashboard/DocumentDropzone";

import DocumentPreviewModal from "@/components/dashboard/DocumentPreviewModal";

import {

  canPreviewDocument,

  formatFileSize,

  getDocumentTypeStyle,

} from "@/utils/documentDisplay";

import NoteTypeFilter from "@/components/dashboard/NoteTypeFilter";

import {
  formatNoteDate,
  getNoteTypeStyle,
  normalizeNoteType,
  getNoteDate,
} from "@/utils/noteDisplay";

import {

  formatLastInteraction,

  getClientColor,

  getClientInitials,

  getDisplayCompany,

  getDisplayName,

} from "@/utils/clientDisplay";

import DeleteConfirmDialog, {
  DELETE_MODAL_CONTENT_CLASS,
  DELETE_MODAL_OVERLAY_CLASS,
} from "@/components/dashboard/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";

import {

  AlertDialog,

  AlertDialogAction,

  AlertDialogCancel,

  AlertDialogContent,

  AlertDialogDescription,

  AlertDialogFooter,

  AlertDialogHeader,

  AlertDialogTitle,

  AlertDialogTrigger,

} from "@/components/ui/alert-dialog";

import { useClientTimeline } from "@/hooks/useClientTimeline";
import {
  getEventDetail,
  getEventLabelKey,
  formatEventTime,
} from "@/utils/eventDisplay";

import {
  clientEmails,
} from "@/data/mockData";



const SECTIONS = ["quotes", "invoices", "notes", "documents"];



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

  const {

    notes: clientNotes,

    total: clientNotesTotal,

    loading: notesLoading,

    error: notesError,

  } = useClientNotes(id, noteTypeFilter);

  const {
    quotes: clientQuotes,
    total: clientQuotesTotal,
    loading: quotesLoading,
    error: quotesError,
  } = useClientQuotes(id, quoteStatusFilter);

  const {
    invoices: clientInvoices,
    total: clientInvoicesTotal,
    loading: invoicesLoading,
    error: invoicesError,
  } = useClientInvoices(id, invoiceStatusFilter);

  const {

    documents: clientDocs,

    total: clientDocsTotal,

    loading: docsLoading,

    error: docsError,

  } = useClientDocuments(id);

  const {
    events: timelineEvents,
    loading: timelineLoading,
    error: timelineError,
  } = useClientTimeline(id);

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



  const handleDelete = async () => {

    try {

      await deleteClient(id);

      notifyClientsChanged();

      toast.success(t("toast.clientDeleted"));

      navigate("/dashboard/clients");

    } catch (err) {

      const message = err.message || t("toast.clientError");

      if (

        message.includes("notes ou des documents") ||

        message.includes("linked notes or documents")

      ) {

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



  if (loading) {

    return (

      <div

        className="flex items-center justify-center py-20 text-[#6B7280]"

        data-testid="client-detail-loading"

      >

        <Loader2 className="w-5 h-5 animate-spin mr-2" />

        {t("clientForm.loading")}

      </div>

    );

  }



  if (error || !client) {

    return (

      <div className="space-y-4" data-testid="client-detail-page">

        <button

          onClick={() => navigate("/dashboard/clients")}

          data-testid="client-detail-back"

          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4B5563] hover:text-[#111827]"

        >

          <ArrowLeft className="w-3.5 h-3.5" />

          {t("clientDetail.back")}

        </button>

        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5 text-sm text-[#991B1B]">

          {error || t("clientDetail.notFound")}

        </div>

      </div>

    );

  }



  const initials = getClientInitials(client);

  const color = getClientColor(client.id);

  const company = getDisplayCompany(client);

  const contactName = getDisplayName(client);

  const location = [client.city, client.address].filter(Boolean).join(", ") || null;



  const filterCards = [

    {

      key: "quotes",

      icon: FileText,

      label: t("nav.quotes"),

      value: clientQuotesTotal,

      color: "text-[#0A2540]",

      bg: "bg-[#EFF6FF]",

    },

    {

      key: "invoices",

      icon: Receipt,

      label: t("nav.invoices"),

      value: clientInvoicesTotal,

      color: "text-[#065F46]",

      bg: "bg-[#ECFDF5]",

    },

    {

      key: "notes",

      icon: StickyNote,

      label: t("nav.notes"),

      value: clientNotesTotal,

      color: "text-[#92400E]",

      bg: "bg-[#FFFBEB]",

    },

    {

      key: "documents",

      icon: FolderClosed,

      label: t("nav.documents"),

      value: clientDocsTotal,

      color: "text-[#4B5563]",

      bg: "bg-[#F3F4F6]",

    },

  ];



  const showSection = (section) =>

    activeSection === "overview" || activeSection === section;



  return (

    <div className="space-y-6" data-testid="client-detail-page">

      <button

        onClick={() => navigate("/dashboard/clients")}

        data-testid="client-detail-back"

        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4B5563] hover:text-[#111827]"

      >

        <ArrowLeft className="w-3.5 h-3.5" />

        {t("clientDetail.back")}

      </button>



      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-6">

        <div className="flex items-start gap-4">

          <div

            className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-semibold text-white shrink-0"

            style={{ backgroundColor: color }}

          >

            {initials}

          </div>

          <div className="flex-1 min-w-0">

            <div className="flex flex-wrap items-start justify-between gap-3">

              <div>

                <h1 className="font-cabinet text-2xl font-bold text-[#111827] tracking-tight">

                  {company}

                </h1>

                <p className="text-sm text-[#4B5563] mt-0.5">

                  {contactName}

                  {client.activity ? ` • ${client.activity}` : ""}

                </p>

                <p className="text-[11px] text-[#9CA3AF] mt-1">

                  {formatLastInteraction(client.updatedAt, lang)}

                </p>

              </div>

              <div className="flex items-center gap-2 shrink-0">

                <Button

                  variant="outline"

                  size="sm"

                  data-testid="client-detail-edit"

                  onClick={() => openEditClient(client)}

                  className="gap-1.5"

                >

                  <Pencil className="w-3.5 h-3.5" />

                  {t("clientDetail.edit")}

                </Button>

                <AlertDialog>

                  <AlertDialogTrigger asChild>

                    <Button

                      variant="outline"

                      size="sm"

                      data-testid="client-detail-delete"

                      className="gap-1.5 text-[#991B1B] border-[#FECACA] hover:bg-[#FEF2F2]"

                    >

                      <Trash2 className="w-3.5 h-3.5" />

                      {t("clientDetail.delete")}

                    </Button>

                  </AlertDialogTrigger>

                  <AlertDialogContent
                    overlayClassName={DELETE_MODAL_OVERLAY_CLASS}
                    className={DELETE_MODAL_CONTENT_CLASS}
                    data-testid="client-delete-dialog"
                  >

                    <AlertDialogHeader>

                      <AlertDialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827]">
                        {t("clientDetail.deleteTitle")}
                      </AlertDialogTitle>

                      <AlertDialogDescription className="text-[#4B5563]">

                        {t("clientDetail.deleteDesc")}

                      </AlertDialogDescription>

                    </AlertDialogHeader>

                    <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">

                      <AlertDialogCancel className="rounded-xl border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB] hover:text-[#111827]">
                        {t("clientForm.cancel")}
                      </AlertDialogCancel>

                      <AlertDialogAction

                        onClick={handleDelete}

                        className="rounded-xl bg-[#991B1B] text-white hover:bg-[#7F1D1D]"

                      >

                        {t("clientDetail.confirmDelete")}

                      </AlertDialogAction>

                    </AlertDialogFooter>

                  </AlertDialogContent>

                </AlertDialog>

              </div>

            </div>

            <div className="flex flex-wrap gap-4 mt-4 text-xs text-[#4B5563]">

              {client.email && (

                <span className="inline-flex items-center gap-1.5">

                  <Mail className="w-3.5 h-3.5" />

                  {client.email}

                </span>

              )}

              {client.phone && (

                <span className="inline-flex items-center gap-1.5">

                  <Phone className="w-3.5 h-3.5" />

                  {client.phone}

                </span>

              )}

              {location && (

                <span className="inline-flex items-center gap-1.5">

                  <MapPin className="w-3.5 h-3.5" />

                  {location}

                </span>

              )}

            </div>

            {client.notes && (

              <p className="mt-4 text-sm text-[#4B5563] border-t border-[#F3F4F6] pt-4">

                {client.notes}

              </p>

            )}

          </div>

        </div>

      </div>



      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

        {filterCards.map((card) => {

          const isActive = activeSection === card.key;

          return (

            <button

              key={card.key}

              type="button"

              onClick={() => setSection(isActive ? "overview" : card.key)}

              data-testid={`client-filter-${card.key}`}

              className={[

                "text-left bg-white border rounded-xl p-4 transition-all",

                isActive

                  ? "border-[#0A2540] ring-2 ring-[#0A2540]/15 shadow-sm"

                  : "border-[#E5E7EB] hover:border-[#0A2540]/30 hover:-translate-y-0.5",

              ].join(" ")}

              aria-pressed={isActive}

            >

              <div className="flex items-center gap-3">

                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.bg} ${card.color}`}>

                  <card.icon className="w-4 h-4" />

                </div>

                <div>

                  <div className="font-cabinet text-xl font-bold text-[#111827] leading-none">

                    {card.value}

                  </div>

                  <div className="text-xs text-[#6B7280] mt-1">{card.label}</div>

                </div>

              </div>

            </button>

          );

        })}

      </div>



      {showSection("quotes") && (

        <SectionPanel

          id="client-section-quotes"

          title={t("nav.quotes")}

          testId="client-section-quotes"

          highlighted={activeSection === "quotes"}
          action={
            <Button variant="outline" size="sm" onClick={() => openAddQuote(client)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {t("quoteForm.addTitle")}
            </Button>
          }
        >
          <div className="mb-4">
            <QuoteStatusFilter value={quoteStatusFilter} onChange={setQuoteStatusFilter} testId="client-quotes-status-filter" />
          </div>

          {quotesLoading ? (
            <div className="flex items-center text-sm text-[#6B7280]"><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("quoteForm.loading")}</div>
          ) : quotesError ? (
            <p className="text-sm text-[#991B1B]">{quotesError}</p>
          ) : clientQuotes.length ? (
            <ul className="divide-y divide-[#F3F4F6]">
              {clientQuotes.map((q) => {
                const st = getQuoteStatusStyle(q.status);
                return (
                  <li key={q.id} className="py-3 flex items-center justify-between gap-3 text-sm" data-testid={`client-quote-${q.id}`}>
                    <div className="min-w-0">
                      <div className="font-medium text-[#111827]">{q.number} — {q.title}</div>
                      <div className="text-[#6B7280] text-xs mt-0.5">{formatQuoteDate(getQuoteDate(q), lang)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <CommercialPdfDownload type="quote" item={q} compact />
                      <QuoteInvoiceAction quote={q} compact />
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setViewingQuote(q)} aria-label={t("commercialDetail.viewQuote")}><Eye className="w-3.5 h-3.5" /></Button>
                      <span className="font-medium text-[#111827]">{formatQuoteAmount(q.amountTTC, lang)}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${st.bg} ${st.text} ${st.border}`}>{t(`quoteStatus.${q.status}`)}</span>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditQuote(q)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#991B1B] hover:text-[#991B1B] hover:bg-[#FEF2F2]" onClick={() => setDeletingQuote(q)} aria-label={t("quoteForm.confirmDelete")}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[#6B7280]">{quoteStatusFilter ? t("quotes.empty.filteredDesc") : t("clientDetail.noQuotes")}</p>
          )}

        </SectionPanel>

      )}



      {showSection("invoices") && (

        <SectionPanel

          id="client-section-invoices"

          title={t("nav.invoices")}

          testId="client-section-invoices"

          highlighted={activeSection === "invoices"}
          action={
            <Button variant="outline" size="sm" onClick={() => openAddInvoice(client)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {t("invoiceForm.addTitle")}
            </Button>
          }
        >
          <div className="mb-4">
            <InvoiceStatusFilter value={invoiceStatusFilter} onChange={setInvoiceStatusFilter} testId="client-invoices-status-filter" />
          </div>

          {invoicesLoading ? (
            <div className="flex items-center text-sm text-[#6B7280]"><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("invoiceForm.loading")}</div>
          ) : invoicesError ? (
            <p className="text-sm text-[#991B1B]">{invoicesError}</p>
          ) : clientInvoices.length ? (
            <ul className="divide-y divide-[#F3F4F6]">
              {clientInvoices.map((inv) => {
                const st = getInvoiceStatusStyle(inv.status);
                return (
                  <li key={inv.id} className="py-3 flex items-center justify-between gap-3 text-sm" data-testid={`client-invoice-${inv.id}`}>
                    <div className="min-w-0">
                      <div className="font-medium text-[#111827]">{inv.number} — {inv.title}</div>
                      <div className="text-[#6B7280] text-xs mt-0.5">{formatInvoiceDate(getInvoiceDate(inv), lang)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <CommercialPdfDownload type="invoice" item={inv} compact />
                      <InvoicePaymentAction invoice={inv} compact />
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setViewingInvoice(inv)} aria-label={t("commercialDetail.viewInvoice")}><Eye className="w-3.5 h-3.5" /></Button>
                      <span className="font-medium text-[#111827]">{formatInvoiceAmount(inv.amountTTC, lang)}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${st.bg} ${st.text} ${st.border}`}>{t(`invoiceStatus.${normalizeInvoiceStatus(inv.status)}`)}</span>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditInvoice(inv)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#991B1B] hover:text-[#991B1B] hover:bg-[#FEF2F2]" onClick={() => setDeletingInvoice(inv)} aria-label={t("invoiceForm.confirmDelete")}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[#6B7280]">{invoiceStatusFilter ? t("invoices.empty.filteredDesc") : t("clientDetail.noInvoices")}</p>
          )}

        </SectionPanel>

      )}



      {showSection("notes") && (

        <SectionPanel

          id="client-section-notes"

          title={t("nav.notes")}

          testId="client-section-notes"

          highlighted={activeSection === "notes"}

          action={

            <Button

              variant="outline"

              size="sm"

              data-testid="client-notes-add"

              onClick={() => openAddNote(client)}

              className="gap-1.5"

            >

              <Plus className="w-3.5 h-3.5" />

              {t("noteForm.addTitle")}

            </Button>

          }

        >

          <div className="mb-4">
            <NoteTypeFilter
              value={noteTypeFilter}
              onChange={setNoteTypeFilter}
              testId="client-notes-type-filter"
            />
          </div>

          {notesLoading ? (

            <div className="flex items-center text-sm text-[#6B7280]">

              <Loader2 className="w-4 h-4 animate-spin mr-2" />

              {t("noteForm.loading")}

            </div>

          ) : notesError ? (

            <p className="text-sm text-[#991B1B]">{notesError}</p>

          ) : clientNotes.length ? (

            <ul className="space-y-3">

              {clientNotes.map((n) => {

                const typeKey = normalizeNoteType(n.type);
                const typeStyle = getNoteTypeStyle(typeKey);

                return (

                  <li

                    key={n.id}

                    className="p-3 rounded-lg bg-[#FAFAFA] border border-[#F3F4F6]"

                    data-testid={`client-note-${n.id}`}

                  >

                    <div className="flex items-start justify-between gap-3">

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-wrap items-center gap-2 mb-1">

                          <span

                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}

                          >

                            {t(`noteType.${typeKey}`)}

                          </span>

                          <span className="text-[11px] text-[#9CA3AF]">

                            {formatNoteDate(getNoteDate(n), lang)}

                          </span>

                        </div>

                        <div className="font-medium text-sm text-[#111827]">{n.title}</div>

                        <p className="text-xs text-[#4B5563] mt-1 whitespace-pre-wrap">{n.content}</p>

                      </div>

                      <div className="flex items-center gap-1 shrink-0">

                        <Button

                          variant="ghost"

                          size="sm"

                          onClick={() => openEditNote(n)}

                          className="h-8 w-8 p-0"

                          aria-label={t("noteForm.editAction")}

                        >

                          <Pencil className="w-3.5 h-3.5" />

                        </Button>

                        <Button

                          variant="ghost"

                          size="sm"

                          onClick={() => setDeletingNote(n)}

                          className="h-8 w-8 p-0 text-[#991B1B] hover:text-[#991B1B] hover:bg-[#FEF2F2]"

                          aria-label={t("noteForm.deleteAction")}

                        >

                          <Trash2 className="w-3.5 h-3.5" />

                        </Button>

                      </div>

                    </div>

                  </li>

                );

              })}

            </ul>

          ) : (

            <p className="text-sm text-[#6B7280]">
              {noteTypeFilter ? t("notes.empty.filteredDesc") : t("clientDetail.noNotes")}
            </p>

          )}

        </SectionPanel>

      )}



      {showSection("documents") && (

        <SectionPanel

          id="client-section-documents"

          title={t("nav.documents")}

          testId="client-section-documents"

          highlighted={activeSection === "documents"}

        >

          <div className="space-y-4">

            <DocumentDropzone

              onUpload={handleUploadDocument}

              compact

              testId="client-documents-dropzone"

            />

            {docsLoading ? (

              <div className="flex items-center text-sm text-[#6B7280]">

                <Loader2 className="w-4 h-4 animate-spin mr-2" />

                {t("documents.loading")}

              </div>

            ) : docsError ? (

              <p className="text-sm text-[#991B1B]">{docsError}</p>

            ) : clientDocs.length ? (

              <ul className="divide-y divide-[#F3F4F6]">

                {clientDocs.map((doc) => {

                  const typeStyle = getDocumentTypeStyle(doc);

                  return (

                    <li

                      key={doc.id}

                      className="py-3 flex items-center justify-between gap-3 text-sm"

                      data-testid={`client-document-${doc.id}`}

                    >

                      <div className="min-w-0 flex-1">

                        <div className="font-medium text-[#111827] truncate">{doc.name}</div>

                        <div className="flex items-center gap-2 mt-1">

                          <span

                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}

                          >

                            {typeStyle.label}

                          </span>

                          <span className="text-[11px] text-[#9CA3AF]">

                            {formatFileSize(doc.sizeBytes, lang)}

                          </span>

                        </div>

                      </div>

                      <div className="flex items-center gap-1 shrink-0">

                        {canPreviewDocument(doc) && (

                          <Button

                            variant="ghost"

                            size="sm"

                            className="h-8 w-8 p-0"

                            aria-label={t("documents.preview")}

                            onClick={() => setPreviewDoc(doc)}

                          >

                            <Eye className="w-3.5 h-3.5" />

                          </Button>

                        )}

                        <Button

                          variant="ghost"

                          size="sm"

                          className="h-8 w-8 p-0"

                          aria-label={t("documents.download")}

                          disabled={docActionId === doc.id}

                          onClick={() => handleDownloadDocument(doc)}

                        >

                          {docActionId === doc.id ? (

                            <Loader2 className="w-3.5 h-3.5 animate-spin" />

                          ) : (

                            <Download className="w-3.5 h-3.5" />

                          )}

                        </Button>

                        <Button

                          variant="ghost"

                          size="sm"

                          className="h-8 w-8 p-0 text-[#991B1B] hover:text-[#991B1B] hover:bg-[#FEF2F2]"

                          aria-label={t("documents.deleteAction")}

                          onClick={() => setDeletingDoc(doc)}

                        >

                          <Trash2 className="w-3.5 h-3.5" />

                        </Button>

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



      <SectionPanel

        id="client-section-timeline"

        title={t("nav.timeline")}

        testId="client-section-timeline"

        action={

          <button

            type="button"

            onClick={() => setSection(activeSection === "timeline" ? "overview" : "timeline")}

            className="text-xs text-[#0A2540] hover:underline"

          >

            {activeSection === "timeline" ? t("clientDetail.showAll") : t("clientDetail.focus")}

          </button>

        }

        highlighted={activeSection === "timeline"}

        hidden={activeSection !== "overview" && activeSection !== "timeline" && SECTIONS.includes(activeSection)}

      >

        {timelineLoading ? (
          <div className="flex items-center justify-center py-6 text-[#6B7280]">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          </div>
        ) : timelineError ? (
          <p className="text-sm text-[#991B1B]">{timelineError}</p>
        ) : timelineEvents.length === 0 ? (
          <p className="text-sm text-[#6B7280]">{t("clientDetail.noTimeline")}</p>
        ) : (
          <ul className="relative space-y-4">
            <div className="absolute left-4 top-2 bottom-2 w-px bg-[#F3F4F6]" />

            {timelineEvents.map((ev) => (
              <li key={ev.id} className="relative flex gap-3">
                <div className="relative z-10 w-8 h-8 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0A2540]" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-[#111827]">
                      {t(getEventLabelKey(ev.type))}
                    </span>
                    <span className="text-[11px] text-[#9CA3AF] shrink-0">
                      {formatEventTime(ev.createdAt, lang)}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-[#4B5563] mt-0.5">
                    {getEventDetail(ev, lang)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

      </SectionPanel>



      <SectionPanel

        id="client-section-emails"

        title={t("clientDetail.emails.title")}

        subtitle={t("clientDetail.emails.subtitle")}

        testId="client-section-emails"

        icon={MessageSquare}

        highlighted={activeSection === "emails"}

        hidden={activeSection !== "overview" && activeSection !== "emails" && SECTIONS.includes(activeSection)}

      >

        <ul className="divide-y divide-[#F3F4F6]">

          {clientEmails.map((email) => (

            <li key={email.id} className="py-3">

              <div className="flex items-center justify-between gap-2">

                <span className="text-[13px] font-medium text-[#111827]">

                  {email.subject[lang]}

                </span>

                <span className="text-[11px] text-[#9CA3AF] shrink-0">

                  {typeof email.time === "object" ? email.time[lang] : email.time}

                </span>

              </div>

              <p className="text-[12px] text-[#6B7280] mt-0.5">

                {email.from[lang]} — {email.snippet[lang]}

              </p>

            </li>

          ))}

        </ul>

      </SectionPanel>



      <section

        id="client-section-ai"

        data-testid="client-section-ai"

        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#0A2540] via-[#0F2E4F] to-[#173A5E] text-white p-5 md:p-6"

      >

        <div className="grain absolute inset-0 pointer-events-none rounded-xl" />

        <div className="relative">

          <div className="flex items-center gap-2 mb-3">

            <Sparkles className="w-4 h-4 text-[#7BB8FF]" />

            <span className="text-[10px] uppercase tracking-widest text-white/70">

              {t("ai.badge")}

            </span>

          </div>

          <h3 className="font-cabinet text-lg font-bold tracking-tight mb-2">

            {t("clientDetail.ai.title")}

          </h3>

          <p className="text-[13px] text-white/85 leading-relaxed">

            {t("ai.answer.body")}

          </p>

          <p className="text-[11px] text-white/50 mt-3">{t("ai.hint")}</p>

        </div>

      </section>



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



      <DocumentPreviewModal

        document={previewDoc}

        open={Boolean(previewDoc)}

        onOpenChange={(open) => !open && setPreviewDoc(null)}

      />



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
        onEdit={(quote) => {
          setViewingQuote(null);
          openEditQuote(quote);
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



function SectionPanel({

  id,

  title,

  subtitle,

  children,

  testId,

  highlighted = false,

  hidden = false,

  action,

  icon: Icon,

}) {

  if (hidden) return null;



  return (

    <section

      id={id}

      data-testid={testId}

      className={[

        "bg-white border rounded-xl p-5 md:p-6 transition-all",

        highlighted ? "border-[#0A2540] ring-2 ring-[#0A2540]/10" : "border-[#E5E7EB]",

      ].join(" ")}

    >

      <div className="flex items-start justify-between mb-4">

        <div>

          <h3 className="font-cabinet text-lg font-bold text-[#111827] tracking-tight flex items-center gap-2">

            {Icon && <Icon className="w-4 h-4 text-[#0A2540]" />}

            {title}

          </h3>

          {subtitle && (

            <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p>

          )}

        </div>

        {action}

      </div>

      {children}

    </section>

  );

}


