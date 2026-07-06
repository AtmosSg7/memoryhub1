import { useState, useEffect } from "react";
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
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useDocuments } from "@/hooks/useDocuments";
import { useDocumentsContext } from "@/context/DocumentsContext";
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
import {
  canPreviewDocument,
  formatFileSize,
  getDocumentTypeStyle,
} from "@/utils/documentDisplay";
import DeleteConfirmDialog from "@/components/dashboard/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";

export default function DocumentsPage() {
  const { t, lang } = useDashboardLang();
  usePageTitle("page.documents.title");
  const [searchParams, setSearchParams] = useSearchParams();
  const { documents, loading, error } = useDocuments();
  const { notifyDocumentsChanged } = useDocumentsContext();
  const [previewDoc, setPreviewDoc] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("import") === "1") {
      setImportOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("import");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleUpload = async (file) => {
    try {
      await uploadDocument(file);
      notifyDocumentsChanged();
      toast.success(t("toast.documentUploaded"));
    } catch (err) {
      toast.error(err.message || t("toast.documentError"));
    }
  };

  const handleDownload = async (doc) => {
    setActionId(doc.id);
    try {
      const blob = await fetchDocumentBlob(doc.id, "download");
      triggerBlobDownload(blob, doc.name);
    } catch (err) {
      toast.error(err.message || t("documents.errors.downloadFailed"));
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
      toast.error(err.message || t("toast.documentError"));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const headers = [
    lang === "fr" ? "Fichier" : "File",
    lang === "fr" ? "Client" : "Client",
    "Type",
    lang === "fr" ? "Taille" : "Size",
    "",
  ];

  return (
    <div className="space-y-6" data-testid="documents-page">
      <PageHeader
        title={t("page.documents.title")}
        subtitle={t("page.documents.subtitle")}
        primaryLabel={t("importWizard.importDocument")}
        primaryIcon={Upload}
        onPrimary={() => setImportOpen(true)}
        testId="documents-header"
      />

      <DocumentDropzone onUpload={handleUpload} />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#6B7280]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t("documents.loading")}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5 text-sm text-[#991B1B]">
          {error}
        </div>
      ) : documents.length ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#F3F4F6]">
                {headers.map((h) => (
                  <th
                    key={h || "actions"}
                    className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const typeStyle = getDocumentTypeStyle(doc);
                return (
                  <tr
                    key={doc.id}
                    className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA]"
                    data-testid={`document-row-${doc.id}`}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#4B5563]">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="text-[#111827] font-medium">{doc.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-[#4B5563]">
                      {doc.clientName || "—"}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}
                      >
                        {typeStyle.label}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-[#6B7280]">
                      {formatFileSize(doc.sizeBytes, lang)}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {canPreviewDocument(doc) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label={t("documents.preview")}
                            onClick={() => setPreviewDoc(doc)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          aria-label={t("documents.download")}
                          disabled={actionId === doc.id}
                          onClick={() => handleDownload(doc)}
                        >
                          {actionId === doc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-[#991B1B] hover:text-[#991B1B] hover:bg-[#FEF2F2]"
                          aria-label={t("documents.deleteAction")}
                          onClick={() => setDeletingDoc(doc)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={FolderClosed}
          title={t("empty.noDocs.title")}
          description={t("empty.noDocs.desc")}
          cta={t("empty.noDocs.cta")}
          onCta={() => setImportOpen(true)}
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
        onOpenChange={setImportOpen}
        onSuccess={() => notifyDocumentsChanged()}
      />
    </div>
  );
}
