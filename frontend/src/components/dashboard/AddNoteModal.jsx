import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddNote } from "@/context/AddNoteContext";
import { useClients } from "@/hooks/useClients";
import { createNote, updateNote } from "@/lib/notesApi";
import { NOTE_TYPES, datetimeLocalToIso, toDatetimeLocalValue } from "@/utils/noteDisplay";
import { getDisplayCompany } from "@/utils/clientDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY_FORM = {
  title: "",
  content: "",
  type: "general",
  clientId: "",
  noteDate: "",
};

const MODAL_OVERLAY_CLASS =
  "z-[100] bg-[#0A0A0B]/50 backdrop-blur-md";

const MODAL_CONTENT_CLASS =
  "z-[100] w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-[#E7E9EE] rounded-[22px] p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_60px_-15px_rgba(10,10,11,0.35)] sm:rounded-[22px] [&>button]:rounded-lg [&>button]:text-[#8A8F98] [&>button]:hover:bg-black/[0.04] [&>button]:hover:opacity-100";

const FIELD_CLASS =
  "h-10 rounded-xl border border-[#E7E9EE] bg-white px-4 text-[15px] text-[#111827] shadow-none placeholder:text-[#8A8F98] focus-visible:border-[#0A2540] focus-visible:ring-2 focus-visible:ring-[#0A2540]/15";

const TEXTAREA_CLASS = `${FIELD_CLASS} min-h-[120px] py-3 h-auto`;

const LABEL_CLASS = "text-sm font-medium text-[#374151]";

const SELECT_CONTENT_CLASS =
  "z-[110] rounded-xl border border-[#E7E9EE] bg-white text-[#111827] shadow-lg";

function noteToForm(note, prefillClient) {
  if (note) {
    return {
      title: note.title === "Note sans titre" ? "" : note.title || "",
      content: note.content || "",
      type: note.type || "general",
      clientId: note.clientId || "",
      noteDate: toDatetimeLocalValue(note.noteDate || note.createdAt),
    };
  }

  return {
    ...EMPTY_FORM,
    clientId: prefillClient?.id || "",
    noteDate: toDatetimeLocalValue(new Date().toISOString()),
  };
}

export default function AddNoteModal() {
  const { t } = useDashboardLang();
  const {
    isOpen,
    editingNote,
    prefillClient,
    closeAddNote,
    notifyNotesChanged,
  } = useAddNote();
  const { clients } = useClients();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(editingNote);
  const clientLocked = Boolean(prefillClient && !isEdit);

  useEffect(() => {
    if (isOpen) {
      setForm(noteToForm(editingNote, prefillClient));
    }
  }, [isOpen, editingNote, prefillClient]);

  const setField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const content = form.content.trim();
    if (!content) {
      toast.error(t("noteForm.errors.contentRequired"));
      return;
    }

    const payload = {
      title: form.title.trim() || undefined,
      content,
      type: form.type,
      clientId: form.clientId || undefined,
      noteDate: datetimeLocalToIso(form.noteDate),
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateNote(editingNote.id, payload);
        toast.success(t("toast.noteUpdated"));
      } else {
        await createNote(payload);
        toast.success(t("toast.noteCreated"));
      }
      notifyNotesChanged();
      closeAddNote();
    } catch (err) {
      toast.error(err.message || t("toast.noteError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAddNote()}>
      <DialogContent
        overlayClassName={MODAL_OVERLAY_CLASS}
        className={MODAL_CONTENT_CLASS}
        data-testid="add-note-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827]">
            {isEdit ? t("noteForm.editTitle") : t("noteForm.addTitle")}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {isEdit ? t("noteForm.editSubtitle") : t("noteForm.addSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-title" className={LABEL_CLASS}>
              {t("noteForm.title")}
            </Label>
            <Input
              id="note-title"
              data-testid="note-form-title"
              value={form.title}
              onChange={setField("title")}
              placeholder={t("noteForm.titlePlaceholder")}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note-content" className={LABEL_CLASS}>
              {t("noteForm.content")} *
            </Label>
            <Textarea
              id="note-content"
              data-testid="note-form-content"
              value={form.content}
              onChange={setField("content")}
              rows={5}
              className={TEXTAREA_CLASS}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="note-type" className={LABEL_CLASS}>
                {t("noteForm.type")}
              </Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger data-testid="note-form-type" className={FIELD_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
                  {NOTE_TYPES.map((type) => (
                    <SelectItem
                      key={type}
                      value={type}
                      className="rounded-lg focus:bg-[#F3F4F6] focus:text-[#111827]"
                    >
                      {t(`noteType.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note-date" className={LABEL_CLASS}>
                {t("noteForm.noteDate")}
              </Label>
              <Input
                id="note-date"
                type="datetime-local"
                data-testid="note-form-date"
                value={form.noteDate}
                onChange={setField("noteDate")}
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note-client" className={LABEL_CLASS}>
              {t("noteForm.client")}
            </Label>
            {clientLocked ? (
              <Input
                id="note-client"
                data-testid="note-form-client-locked"
                value={getDisplayCompany(prefillClient)}
                readOnly
                className={`${FIELD_CLASS} bg-[#F9FAFB] text-[#6B7280]`}
              />
            ) : (
              <Select
                value={form.clientId || "none"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    clientId: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger data-testid="note-form-client" className={FIELD_CLASS}>
                  <SelectValue placeholder={t("noteForm.noClient")} />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
                  <SelectItem
                    value="none"
                    className="rounded-lg focus:bg-[#F3F4F6] focus:text-[#111827]"
                  >
                    {t("noteForm.noClient")}
                  </SelectItem>
                  {clients.map((client) => (
                    <SelectItem
                      key={client.id}
                      value={client.id}
                      className="rounded-lg focus:bg-[#F3F4F6] focus:text-[#111827]"
                    >
                      {getDisplayCompany(client)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeAddNote}
              disabled={submitting}
              className="rounded-xl border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB] hover:text-[#111827]"
            >
              {t("noteForm.cancel")}
            </Button>
            <Button
              type="submit"
              data-testid="note-form-submit"
              disabled={submitting}
              className="rounded-xl bg-[#0A2540] text-white hover:bg-[#173A5E]"
            >
              {submitting
                ? t("noteForm.saving")
                : isEdit
                  ? t("noteForm.save")
                  : t("noteForm.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
