import { useState } from "react";
import { Plus, StickyNote, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddNote } from "@/context/AddNoteContext";
import { useNotes } from "@/hooks/useNotes";
import { deleteNote } from "@/lib/notesApi";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import NoteTypeFilter from "@/components/dashboard/NoteTypeFilter";
import {
  formatNoteDate,
  getNoteTypeStyle,
  normalizeNoteType,
  getNoteDate,
  truncateContent,
} from "@/utils/noteDisplay";
import DeleteConfirmDialog from "@/components/dashboard/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";

export default function NotesPage() {
  const { t, lang } = useDashboardLang();
  const { openAddNote, openEditNote, notifyNotesChanged } = useAddNote();
  const [typeFilter, setTypeFilter] = useState("");
  const { notes, loading, error } = useNotes(typeFilter);
  const [deletingNote, setDeletingNote] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!deletingNote) return;

    setDeleteSubmitting(true);
    try {
      await deleteNote(deletingNote.id);
      toast.success(t("toast.noteDeleted"));
      notifyNotesChanged();
      setDeletingNote(null);
    } catch (err) {
      toast.error(err.message || t("toast.noteError"));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="notes-page">
      <PageHeader
        title={t("page.notes.title")}
        subtitle={t("page.notes.subtitle")}
        primaryLabel={t("noteForm.addTitle")}
        primaryIcon={Plus}
        onPrimary={() => openAddNote()}
        testId="notes-header"
      />

      <NoteTypeFilter value={typeFilter} onChange={setTypeFilter} />

      {loading ? (
        <div
          className="flex items-center justify-center py-16 text-[#6B7280]"
          data-testid="notes-loading"
        >
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t("noteForm.loading")}
        </div>
      ) : error ? (
        <div
          className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5 text-sm text-[#991B1B]"
          data-testid="notes-error"
        >
          {error}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title={typeFilter ? t("notes.empty.filteredTitle") : t("notes.empty.title")}
          description={typeFilter ? t("notes.empty.filteredDesc") : t("notes.empty.desc")}
          cta={t("noteForm.addTitle")}
          onCta={() => openAddNote()}
          testId="notes-empty"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {notes.map((note) => {
            const typeKey = normalizeNoteType(note.type);
            const typeStyle = getNoteTypeStyle(typeKey);
            return (
              <article
                key={note.id}
                data-testid={`note-card-${note.id}`}
                className="bg-white border border-[#E5E7EB] rounded-xl p-5 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-16px_rgba(10,37,64,0.2)] transition-all"
              >
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}
                    >
                      {t(`noteType.${typeKey}`)}
                    </span>
                    {note.clientName && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#0A2540] text-[10px] font-semibold truncate max-w-[140px]">
                        {note.clientName}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#9CA3AF] shrink-0">
                    {formatNoteDate(getNoteDate(note), lang)}
                  </span>
                </div>

                <h3 className="font-cabinet text-base font-semibold text-[#111827] tracking-tight mb-2 flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-[#92400E] shrink-0" />
                  <span className="truncate">{note.title}</span>
                </h3>

                <p className="text-[13px] text-[#4B5563] leading-relaxed mb-4">
                  {truncateContent(note.content)}
                </p>

                <div className="flex items-center gap-2 pt-3 border-t border-[#F3F4F6]">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`note-edit-${note.id}`}
                    onClick={() => openEditNote(note)}
                    className="gap-1.5 h-8 text-xs rounded-lg"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {t("noteForm.editAction")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`note-delete-${note.id}`}
                    onClick={() => setDeletingNote(note)}
                    className="gap-1.5 h-8 text-xs rounded-lg text-[#991B1B] border-[#FECACA] hover:bg-[#FEF2F2]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t("noteForm.deleteAction")}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <DeleteConfirmDialog
        open={Boolean(deletingNote)}
        onOpenChange={(open) => !open && !deleteSubmitting && setDeletingNote(null)}
        title={t("noteForm.deleteTitle")}
        description={t("noteForm.deleteDesc")}
        cancelLabel={t("noteForm.cancel")}
        confirmLabel={t("noteForm.confirmDelete")}
        onConfirm={handleDelete}
        submitting={deleteSubmitting}
        testId="note-delete-dialog"
      />
    </div>
  );
}
