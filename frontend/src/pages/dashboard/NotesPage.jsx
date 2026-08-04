import { useState } from "react";

import { Plus, StickyNote, Trash2 } from "lucide-react";

import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";

import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";

import { useAddNote } from "@/context/AddNoteContext";
import { useClients } from "@/hooks/useClients";

import { useNotes } from "@/hooks/useNotes";
import { useListPagination } from "@/hooks/useListPagination";
import ListCollectionFooter from "@/components/dashboard/ListCollectionFooter";
import ClientFilterSelect from "@/components/dashboard/ClientFilterSelect";

import { deleteNote } from "@/lib/notesApi";

import PageHeader from "@/components/dashboard/PageHeader";

import EmptyState from "@/components/dashboard/EmptyState";

import { PageError, TableSkeleton } from "@/components/dashboard/PageFeedback";

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
  const { clients, loading: clientsLoading } = useClients();

  const [typeFilter, setTypeFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const { notes, total, loading, error } = useNotes(typeFilter, clientFilter);

  const {
    pageItems: pageNotes,
    page,
    setPage,
    totalPages,
    rangeStart,
    rangeEnd,
    totalItems,
  } = useListPagination(notes, { pageSize: 24, resetKey: `${typeFilter}:${clientFilter}` });

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

      toastApiError(err, t, "toast.noteError");

    } finally {

      setDeleteSubmitting(false);

    }

  };



  const isFiltered = Boolean(typeFilter || clientFilter);



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



      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <NoteTypeFilter value={typeFilter} onChange={setTypeFilter} />
        <ClientFilterSelect
          clients={clients}
          value={clientFilter}
          onChange={setClientFilter}
          disabled={clientsLoading}
          allLabel={t("communications.allClients")}
          className="w-full lg:w-64"
          testId="notes-client-filter"
        />
      </div>



      {loading ? (

        <TableSkeleton rows={6} columns={3} testId="notes-loading" />

      ) : error ? (

        <PageError message={error} testId="notes-error" />

      ) : notes.length === 0 ? (

        <EmptyState

          icon={StickyNote}

          title={isFiltered ? t("notes.empty.filteredTitle") : t("notes.empty.title")}

          description={isFiltered ? t("notes.empty.filteredDesc") : t("notes.empty.desc")}

          cta={isFiltered ? t("common.clearFilter") : t("actions.createNote")}

          onCta={
            isFiltered
              ? () => {
                  setTypeFilter("");
                  setClientFilter("");
                }
              : () => openAddNote()
          }

          testId="notes-empty"

        />

      ) : (

        <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {pageNotes.map((note) => {

            const typeKey = normalizeNoteType(note.type);

            const typeStyle = getNoteTypeStyle(typeKey);

            return (

              <button
                type="button"
                key={note.id}
                onClick={() => openEditNote(note)}
                data-testid={`note-card-${note.id}`}
                aria-label={note.title || t("page.notes.title")}
                className="bg-dash-surface border border-dash-border rounded-xl p-5 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-16px_rgba(10,37,64,0.2)] transition-all cursor-pointer w-full text-left"
              >

                <div className="flex items-center justify-between mb-3 gap-2">

                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">

                    <span

                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}

                    >

                      {t(`noteType.${typeKey}`)}

                    </span>

                    {note.clientName && (

                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-dash-accent-soft text-dash-primary text-[10px] font-semibold truncate max-w-[140px]">

                        {note.clientName}

                      </span>

                    )}

                  </div>

                  <span className="text-[11px] text-dash-text-subtle shrink-0">

                    {formatNoteDate(getNoteDate(note), lang)}

                  </span>

                </div>



                <h3 className="font-cabinet text-base font-semibold text-dash-text tracking-tight mb-2 truncate">

                  {note.title}

                </h3>



                <p className="text-[13px] text-dash-text-muted leading-relaxed line-clamp-3">

                  {truncateContent(note.content)}

                </p>



                <div

                  className="flex items-center justify-end pt-3 mt-3 border-t border-dash-border-soft"

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

              </button>

            );

          })}

        </div>
        <ListCollectionFooter
          t={t}
          loadedCount={totalItems}
          total={total}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          testId="notes-list-footer"
        />
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


