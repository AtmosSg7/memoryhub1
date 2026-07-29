import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Upload,
  FileText,
  FolderClosed,
  Download,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useDocuments } from "@/hooks/useDocuments";
import { useDocumentsContext } from "@/context/DocumentsContext";
import { useAddClient } from "@/context/AddClientContext";
import { useClients } from "@/hooks/useClients";
import { useListPagination } from "@/hooks/useListPagination";
import {
  deleteDocument,
  fetchDocumentBlob,
  triggerBlobDownload,
  uploadDocument,
} from "@/lib/documentsApi";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import DocumentDropzone from "@/components/dashboard/DocumentDropzone";
import DocumentPreviewModal from "@/components/dashboard/DocumentPreviewModal";
import ImportWizard from "@/components/dashboard/ImportWizard";
import ClientFilterSelect from "@/components/dashboard/ClientFilterSelect";
import ListCollectionFooter from "@/components/dashboard/ListCollectionFooter";
import { PageError, TableSkeleton } from "@/components/dashboard/PageFeedback";
import { ActionButton } from "@/components/dashboard/ActionButton";
import SearchField from "@/components/dashboard/SearchField";
import SearchEmptyState from "@/components/dashboard/SearchEmptyState";
import {
  LIST_TABLE_CONTAINER_CLASS,
  TABLE_BODY_CELL_CLASS,
  TABLE_BODY_ROW_CLASS,
  TABLE_HEAD_CELL_CLASS,
  TABLE_HEAD_ROW_CLASS,
} from "@/components/dashboard/detailModalLayout";
import {
  canPreviewDocument,
  formatFileSize,
  getDocumentTypeStyle,
} from "@/utils/documentDisplay";
import DeleteConfirmDialog from "@/components/dashboard/DeleteConfirmDialog";

export default function DocumentsPage() {
  const { t, lang } = useDashboardLang();
  usePageTitle("page.files.title");
  const [searchParams, setSearchParams] = useSearchParams();
  const [clientFilter, setClientFilter] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const { documents, total, loading, error } = useDocuments(clientFilter);
  const { notifyDocumentsChanged } = useDocumentsContext();
  const { openAddClient } = useAddClient();
  const { clients, loading: clientsLoading } = useClients();
  const [previewDoc, setPreviewDoc] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [resumeImportId, setResumeImportId] = useState(null);

  useEffect(() => {
    const importParam = searchParams.get("import");
    if (!importParam) return;
    if (importParam === "1") {
      setResumeImportId(null);
    } else {
      setResumeImportId(importParam);
    }
    setImportOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("import");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const filteredDocuments = useMemo(() => {
    const term = nameQuery.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter((doc) => {
      const haystack = [doc.name, doc.clientName, doc.extension].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [documents, nameQuery]);

  const {
    pageItems: pageDocuments,
    page,
    setPage,
    totalPages,
    rangeStart,
    rangeEnd,
    totalItems,
  } = useListPagination(filteredDocuments, { pageSize: 50, resetKey: `${clientFilter}:${nameQuery}` });

  const handleUpload = async (file) => {
    try {
      await uploadDocument(file);
      notifyDocumentsChanged();
      toast.success(t("toast.documentUploaded"));
    } catch (err) {
      toastApiError(err, t, "toast.documentError");
    }
  };

  const handleDownload = async (doc) => {
    setActionId(doc.id);
    try {
      const blob = await fetchDocumentBlob(doc.id, "download");
      triggerBlobDownload(blob, doc.name);
    } catch (err) {
      toastApiError(err, t, "documents.errors.downloadFailed");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingDoc) return;
    setDeleteSubmitting(true);
    try {
      await deleteDocument(deletingDoc.id);
      notifyDocumentsChanged();
      toast.success(t("toast.documentDeleted"));
      setDeletingDoc(null);
    } catch (err) {
      toastApiError(err, t, "toast.documentError");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const headers = [
    t("documents.columns.file"),
    t("documents.columns.client"),
    t("documents.columns.type"),
    t("documents.columns.size"),
    "",
  ];

  return (
    <div className="space-y-6" data-testid="files-page">
      <PageHeader
        title={t("page.files.title")}
        subtitle={t("page.files.subtitle")}
        primaryLabel={t("importWizard.importDocument")}
        primaryIcon={Upload}
        onPrimary={() => setImportOpen(true)}
        testId="files-header"
      />

      <p className="text-xs text-[#6B7280] leading-relaxed">{t("documents.uploadHint")}</p>

      <DocumentDropzone onUpload={handleUpload} />

      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <ClientFilterSelect
          clients={clients}
          value={clientFilter}
          onChange={setClientFilter}
          disabled={clientsLoading}
          className="w-full lg:w-64"
          testId="files-client-filter"
        />
        <div className="flex-1 max-w-md">
          <SearchField
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder={t("documents.searchPlaceholder")}
            data-testid="files-name-search"
            aria-label={t("documents.searchPlaceholder")}
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={6} columns={5} testId="documents-loading" />
      ) : error ? (
        <PageError message={error} testId="documents-error" />
      ) : filteredDocuments.length ? (
        <div className="space-y-3">
          <div className={LIST_TABLE_CONTAINER_CLASS}>
            <table className="w-full text-sm">
              <thead>
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  {headers.map((h) => (
                    <th key={h || "actions"} className={TABLE_HEAD_CELL_CLASS}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageDocuments.map((doc) => {
                  const typeStyle = getDocumentTypeStyle(doc);
                  return (
                    <tr
                      key={doc.id}
                      className={TABLE_BODY_ROW_CLASS}
                      data-testid={`document-row-${doc.id}`}
                    >
                      <td className={TABLE_BODY_CELL_CLASS}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#4B5563]">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="text-[#111827] font-medium">{doc.name}</span>
                        </div>
                      </td>
                      <td className={`${TABLE_BODY_CELL_CLASS} text-[#4B5563]`}>
                        {doc.clientName || "—"}
                      </td>
                      <td className={TABLE_BODY_CELL_CLASS}>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}
                        >
                          {typeStyle.label}
                        </span>
                      </td>
                      <td className={`${TABLE_BODY_CELL_CLASS} text-[#6B7280]`}>
                        {formatFileSize(doc.sizeBytes, lang)}
                      </td>
                      <td className={TABLE_BODY_CELL_CLASS}>
                        <div className="flex items-center justify-end gap-1">
                          {canPreviewDocument(doc) && (
                            <ActionButton
                              variant="ghostIcon"
                              aria-label={t("documents.preview")}
                              onClick={() => setPreviewDoc(doc)}
                            >
                              <Eye className="w-4 h-4" />
                            </ActionButton>
                          )}
                          <ActionButton
                            variant="ghostIcon"
                            aria-label={t("documents.download")}
                            disabled={actionId === doc.id}
                            onClick={() => handleDownload(doc)}
                          >
                            {actionId === doc.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </ActionButton>
                          <ActionButton
                            variant="dangerIcon"
                            aria-label={t("documents.deleteAction")}
                            onClick={() => setDeletingDoc(doc)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListCollectionFooter
            t={t}
            loadedCount={totalItems}
            total={nameQuery.trim() ? totalItems : total}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            testId="files-list-footer"
          />
        </div>
      ) : documents.length ? (
        <SearchEmptyState
          message={t("documents.searchEmpty").replace("{query}", nameQuery.trim())}
          testId="files-search-empty"
        />
      ) : (
        <EmptyState
          icon={FolderClosed}
          title={t("empty.noDocs.title")}
          description={t("empty.noDocs.desc")}
          cta={t("empty.noDocs.cta")}
          onCta={() => setImportOpen(true)}
          secondaryCta={clients.length === 0 ? t("empty.noDocs.secondaryCta") : undefined}
          onSecondaryCta={clients.length === 0 ? openAddClient : undefined}
          testId="empty-docs"
        />
      )}

      <DocumentPreviewModal
        document={previewDoc}
        open={Boolean(previewDoc)}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
      />

      <DeleteConfirmDialog
        open={Boolean(deletingDoc)}
        onOpenChange={(open) => !open && !deleteSubmitting && setDeletingDoc(null)}
        title={t("documents.deleteTitle")}
        description={t("documents.deleteDesc")}
        cancelLabel={t("documents.cancel")}
        confirmLabel={t("documents.confirmDelete")}
        onConfirm={handleDelete}
        submitting={deleteSubmitting}
        testId="document-delete-dialog"
      />

      <ImportWizard
        open={importOpen}
        onOpenChange={(next) => {
          setImportOpen(next);
          if (!next) setResumeImportId(null);
        }}
        resumeSessionId={resumeImportId}
        onSuccess={() => notifyDocumentsChanged()}
      />
    </div>
  );
}
