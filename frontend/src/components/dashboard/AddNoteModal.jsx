import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useFormSubmitShortcut } from "@/hooks/useFormSubmitShortcut";
import { useAddNote } from "@/context/AddNoteContext";
import { useClients } from "@/hooks/useClients";
import { createNote, updateNote } from "@/lib/notesApi";
import { NOTE_TYPES, datetimeLocalToIso, toDatetimeLocalValue } from "@/utils/noteDisplay";
import {
  combineDateAndTimeToIso,
  splitRemindAt,
} from "@/utils/personalReminderDisplay";
import { getDisplayCompany } from "@/utils/clientDisplay";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  DETAIL_MODAL_FORM_CONTENT_CLASS,
  NESTED_MODAL_FORM_CONTENT_CLASS,
  NESTED_MODAL_OVERLAY_CLASS,
  DetailModalFooter,
  FORM_FIELD_CLASS,
  FORM_LABEL_CLASS,
  FORM_SELECT_CONTENT_CLASS,
  FORM_TEXTAREA_CLASS,
} from "@/components/dashboard/detailModalLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  type: "phone",
  clientId: "",
  noteDate: "",
  enableReminder: false,
  remindDate: "",
  remindTime: "08:00",
};

function defaultRemindDate() {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function noteToForm(note, prefillClient) {
  if (note) {
    const { date, time } = splitRemindAt(note.remindAt);
    return {
      title: note.title === "Note sans titre" ? "" : note.title || "",
      content: note.content || "",
      type: note.type || "general",
      clientId: note.clientId || "",
      noteDate: toDatetimeLocalValue(note.noteDate || note.createdAt),
      enableReminder: Boolean(note.remindAt),
      remindDate: date || defaultRemindDate(),
      remindTime: time,
    };
  }

  return {
    ...EMPTY_FORM,
    clientId: prefillClient?.id || "",
    noteDate: toDatetimeLocalValue(new Date().toISOString()),
    remindDate: defaultRemindDate(),
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
  const { clients } = useClients({ enabled: isOpen });
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const formRef = useRef(null);

  const isEdit = Boolean(editingNote);
  const clientLocked = Boolean(prefillClient && !isEdit);

  useFormSubmitShortcut(formRef, isOpen && !submitting);

  useEffect(() => {
    if (isOpen) {
      setForm(noteToForm(editingNote, prefillClient));
      setShowMore(isEdit);
    }
  }, [isOpen, editingNote, prefillClient, isEdit]);

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

    if (form.enableReminder) {
      const remindAt = combineDateAndTimeToIso(form.remindDate, form.remindTime);
      if (!remindAt) {
        toast.error(t("noteForm.errors.remindDateRequired"));
        return;
      }
      payload.remindAt = remindAt;
    } else if (isEdit && editingNote?.remindAt) {
      payload.clearReminder = true;
    }

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
      toastApiError(err, t, "toast.noteError");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAddNote()}>
      <DialogContent
        overlayClassName={NESTED_MODAL_OVERLAY_CLASS}
        className={NESTED_MODAL_FORM_CONTENT_CLASS}
        data-testid="add-note-modal"
      >
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827]">
            {isEdit ? t("noteForm.editTitle") : t("noteForm.addTitle")}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {isEdit ? t("noteForm.editSubtitle") : t("noteForm.addSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-content" className={FORM_LABEL_CLASS}>
              {t("noteForm.content")} *
            </Label>
            <Textarea
              id="note-content"
              data-testid="note-form-content"
              value={form.content}
              onChange={setField("content")}
              rows={5}
              className={FORM_TEXTAREA_CLASS}
              placeholder={t("noteForm.contentPlaceholder")}
              required
              autoFocus
            />
          </div>

          <button
            type="button"
            onClick={() => setShowMore((value) => !value)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0A2540] hover:text-[#173A5E]"
            data-testid="note-form-toggle-options"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMore ? "rotate-180" : ""}`} />
            {showMore ? t("noteForm.hideOptions") : t("noteForm.showMoreOptions")}
          </button>

          {showMore ? (
            <>
          <div className="space-y-2">
            <Label htmlFor="note-title" className={FORM_LABEL_CLASS}>
              {t("noteForm.title")}
            </Label>
            <Input
              id="note-title"
              data-testid="note-form-title"
              value={form.title}
              onChange={setField("title")}
              placeholder={t("noteForm.titlePlaceholder")}
              className={FORM_FIELD_CLASS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="note-type" className={FORM_LABEL_CLASS}>
                {t("noteForm.type")}
              </Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger data-testid="note-form-type" className={FORM_FIELD_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={FORM_SELECT_CONTENT_CLASS}>
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
              <Label htmlFor="note-date" className={FORM_LABEL_CLASS}>
                {t("noteForm.noteDate")}
              </Label>
              <Input
                id="note-date"
                type="datetime-local"
                data-testid="note-form-date"
                value={form.noteDate}
                onChange={setField("noteDate")}
                className={FORM_FIELD_CLASS}
              />
            </div>
          </div>

          {!clientLocked ? (
          <div className="space-y-2">
            <Label htmlFor="note-client" className={FORM_LABEL_CLASS}>
              {t("noteForm.client")}
            </Label>
              <Select
                value={form.clientId || "none"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    clientId: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger data-testid="note-form-client" className={FORM_FIELD_CLASS}>
                  <SelectValue placeholder={t("noteForm.noClient")} />
                </SelectTrigger>
                <SelectContent className={FORM_SELECT_CONTENT_CLASS}>
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
          </div>
          ) : null}

          <div className="rounded-xl border border-[#F3F4F6] bg-[#FAFAFA] px-4 py-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#111827]">{t("noteForm.reminderToggle")}</p>
                <p className="text-xs text-[#6B7280] mt-0.5">{t("noteForm.reminderHint")}</p>
              </div>
              <Switch
                checked={form.enableReminder}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    enableReminder: checked,
                    remindDate: prev.remindDate || defaultRemindDate(),
                  }))
                }
                data-testid="note-form-reminder-toggle"
              />
            </div>

            {form.enableReminder ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-2">
                  <Label htmlFor="note-remind-date" className={FORM_LABEL_CLASS}>
                    {t("noteForm.remindDate")}
                  </Label>
                  <Input
                    id="note-remind-date"
                    type="date"
                    data-testid="note-form-remind-date"
                    value={form.remindDate}
                    onChange={setField("remindDate")}
                    className={FORM_FIELD_CLASS}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note-remind-time" className={FORM_LABEL_CLASS}>
                    {t("noteForm.remindTime")}
                  </Label>
                  <Input
                    id="note-remind-time"
                    type="time"
                    data-testid="note-form-remind-time"
                    value={form.remindTime}
                    onChange={setField("remindTime")}
                    className={FORM_FIELD_CLASS}
                  />
                </div>
              </div>
            ) : null}
          </div>
            </>
          ) : null}

          <DetailModalFooter
            primary={
              <ActionButton type="submit" variant="primary" data-testid="note-form-submit" disabled={submitting}>
                {submitting
                  ? t("noteForm.saving")
                  : isEdit
                    ? t("noteForm.save")
                    : t("noteForm.create")}
              </ActionButton>
            }
            secondary={
              <ActionButton type="button" variant="secondary" onClick={closeAddNote} disabled={submitting}>
                {t("noteForm.cancel")}
              </ActionButton>
            }
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
