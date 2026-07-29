import { useState } from "react";
import { Check, Clock, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddNote } from "@/context/AddNoteContext";
import { completePersonalReminder, snoozePersonalReminder } from "@/lib/personalRemindersApi";
import { getNote } from "@/lib/notesApi";
import {
  combineDateAndTimeToIso,
  snoozeOneHourIso,
  snoozeTomorrowMorningIso,
  splitRemindAt,
} from "@/utils/personalReminderDisplay";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { FORM_FIELD_CLASS, FORM_LABEL_CLASS } from "@/components/dashboard/detailModalLayout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PersonalReminderRowActions({ reminder, onChanged, disabled = false }) {
  const { t } = useDashboardLang();
  const { openEditNote, notifyNotesChanged } = useAddNote();
  const [acting, setActing] = useState(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("08:00");

  const reminderId = reminder.personalReminderId;

  const handleView = async () => {
    if (!reminder.noteId) return;
    setActing("view");
    try {
      const note = await getNote(reminder.noteId);
      openEditNote(note);
    } catch (err) {
      toastApiError(err, t, "dashboardV2.today.loadError");
    } finally {
      setActing(null);
    }
  };

  const handleComplete = async () => {
    setActing("complete");
    try {
      await completePersonalReminder(reminderId);
      notifyNotesChanged();
      toast.success(t("personalReminder.doneSuccess"));
      onChanged?.();
    } catch (err) {
      toastApiError(err, t, "personalReminder.actionError");
    } finally {
      setActing(null);
    }
  };

  const handleSnooze = async (remindAt) => {
    setActing("snooze");
    try {
      await snoozePersonalReminder(reminderId, remindAt);
      notifyNotesChanged();
      toast.success(t("personalReminder.snoozeSuccess"));
      setSnoozeOpen(false);
      onChanged?.();
    } catch (err) {
      toastApiError(err, t, "personalReminder.actionError");
    } finally {
      setActing(null);
    }
  };

  const openCustomSnooze = () => {
    const { date, time } = splitRemindAt(reminder.date);
    setCustomDate(date || splitRemindAt(new Date().toISOString()).date);
    setCustomTime(time);
    setSnoozeOpen(true);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
        <ActionButton
          variant="quick"
          disabled={disabled || Boolean(acting)}
          onClick={(e) => {
            e.stopPropagation();
            handleView();
          }}
          data-testid={`personal-reminder-view-${reminderId}`}
          className="gap-1"
        >
          {acting === "view" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{t("personalReminder.actions.view")}</span>
        </ActionButton>
        <ActionButton
          variant="quick"
          disabled={disabled || Boolean(acting)}
          onClick={(e) => {
            e.stopPropagation();
            handleComplete();
          }}
          data-testid={`personal-reminder-done-${reminderId}`}
          className="gap-1"
        >
          {acting === "complete" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">{t("personalReminder.actions.done")}</span>
        </ActionButton>
        <ActionButton
          variant="quick"
          disabled={disabled || Boolean(acting)}
          onClick={(e) => {
            e.stopPropagation();
            openCustomSnooze();
          }}
          data-testid={`personal-reminder-snooze-${reminderId}`}
          className="gap-1"
        >
          {acting === "snooze" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Clock className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">{t("personalReminder.actions.snooze")}</span>
        </ActionButton>
      </div>

      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent className="max-w-sm" data-testid="personal-reminder-snooze-dialog">
          <DialogHeader>
            <DialogTitle>{t("personalReminder.snoozeTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <ActionButton
              variant="secondary"
              className="w-full justify-start"
              onClick={() => handleSnooze(snoozeOneHourIso())}
            >
              {t("personalReminder.snooze.oneHour")}
            </ActionButton>
            <ActionButton
              variant="secondary"
              className="w-full justify-start"
              onClick={() => handleSnooze(snoozeTomorrowMorningIso())}
            >
              {t("personalReminder.snooze.tomorrowMorning")}
            </ActionButton>
            <div className="space-y-2 pt-2 border-t border-[#F3F4F6]">
              <Label className={FORM_LABEL_CLASS}>{t("personalReminder.snooze.pickDate")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className={FORM_FIELD_CLASS}
                  data-testid="personal-reminder-snooze-date"
                />
                <Input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className={FORM_FIELD_CLASS}
                  data-testid="personal-reminder-snooze-time"
                />
              </div>
              <ActionButton
                variant="primary"
                className="w-full"
                disabled={!customDate}
                onClick={() => {
                  const iso = combineDateAndTimeToIso(customDate, customTime);
                  if (iso) handleSnooze(iso);
                }}
              >
                {t("personalReminder.snooze.confirm")}
              </ActionButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
