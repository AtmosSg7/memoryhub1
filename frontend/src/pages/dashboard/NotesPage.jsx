import { useState } from "react";

import { Plus, StickyNote, Trash2 } from "lucide-react";

import { toast } from "sonner";

import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";

import { useAddNote } from "@/context/AddNoteContext";

import { useNotes } from "@/hooks/useNotes";

import { deleteNote } from "@/lib/notesApi";

import PageHeader from "@/components/dashboard/PageHeader";

import EmptyState from "@/components/dashboard/EmptyState";

import { PageError, PageLoader } from "@/components/dashboard/PageFeedback";

import NoteTypeFilter from "@/components/dashboard/NoteTypeFilter";

import {

  formatNoteDate,

  getNoteTypeStyle,

  normalizeNoteType,

  getNoteDate,

  truncateContent,

} from "@/utils/noteDisplay";

import DeleteConfirmDialog from "@/components/dashboard/DeleteConfirmDialog";

import { ActionButton } from "@/components/dashboard/ActionButton";



export default function NotesPage() {

  const { t, lang } = useDashboardLang();
  usePageTitle("page.notes.title");

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



  const isFiltered = Boolean(typeFilter);



  return (

    <div className="space-y-6" data-testid="notes-page">

      <PageHeader

        title={t("page.notes.title")}

        subtitle={t("page.notes.subtitle")}

        primaryLabel={t("actions.createNote")}

        primaryIcon={Plus}

        onPrimary={() => openAddNote()}

        testId="notes-header"

      />



      <NoteTypeFilter value={typeFilter} onChange={setTypeFilter} />



      {loading ? (

        <PageLoader label={t("noteForm.loading")} testId="notes-loading" />

      ) : error ? (

        <PageError message={error} testId="notes-error" />

      ) : notes.length === 0 ? (

        <EmptyState

          icon={StickyNote}

          title={isFiltered ? t("notes.empty.filteredTitle") : t("notes.empty.title")}

          description={isFiltered ? t("notes.empty.filteredDesc") : t("notes.empty.desc")}

          cta={isFiltered ? undefined : t("actions.createNote")}

          onCta={isFiltered ? undefined : () => openAddNote()}

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

                role="button"

                tabIndex={0}

                onClick={() => openEditNote(note)}

                onKeyDown={(e) => {

                  if (e.key === "Enter" || e.key === " ") {

                    e.preventDefault();

                    openEditNote(note);

                  }

                }}

                data-testid={`note-card-${note.id}`}

                className="bg-white border border-[#E5E7EB] rounded-xl p-5 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-16px_rgba(10,37,64,0.2)] transition-all cursor-pointer"

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



                <h3 className="font-cabinet text-base font-semibold text-[#111827] tracking-tight mb-2 truncate">

                  {note.title}

                </h3>



                <p className="text-[13px] text-[#4B5563] leading-relaxed line-clamp-3">

                  {truncateContent(note.content)}

                </p>



                <div

                  className="flex items-center justify-end pt-3 mt-3 border-t border-[#F3F4F6]"

                  onClick={(e) => e.stopPropagation()}

                >

                  <ActionButton

                    variant="dangerIcon"

                    data-testid={`note-delete-${note.id}`}

                    onClick={() => setDeletingNote(note)}

                    aria-label={t("actions.delete")}

                  >

                    <Trash2 className="w-3.5 h-3.5" />

                  </ActionButton>

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


