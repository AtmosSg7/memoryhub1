import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
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
import {
  POSTPONE_PRESETS,
  postponeCustomIso,
} from "@/utils/actionSnoozePresets";
import { splitRemindAt } from "@/utils/personalReminderDisplay";

/**
 * Mobile-first postpone picker for Action Engine rows ("Reporter").
 */
export default function ActionPostponeDialog({
  open,
  onOpenChange,
  onSelectUntil,
  busy = false,
  testId = "action-postpone-dialog",
}) {
  const { t } = useDashboardLang();
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("09:00");

  const handleOpenChange = (next) => {
    if (next) {
      const { date, time } = splitRemindAt(new Date().toISOString());
      setCustomDate(date);
      setCustomTime(time || "09:00");
    }
    onOpenChange?.(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-sm bg-[var(--dash-modal-bg,#FFFFFF)] backdrop-blur-none"
        data-testid={testId}
      >
        <DialogHeader>
          <DialogTitle>{t("dashboardV2.engine.postponeTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {POSTPONE_PRESETS.map((preset) => (
            <ActionButton
              key={preset.id}
              variant="secondary"
              className="w-full justify-start min-h-11"
              disabled={busy}
              onClick={() => onSelectUntil?.(preset.until())}
              data-testid={`${testId}-preset-${preset.id}`}
            >
              {t(`dashboardV2.engine.postponePresets.${preset.id}`)}
            </ActionButton>
          ))}
          <div className="space-y-2 pt-2 border-t border-dash-border-soft">
            <Label className={FORM_LABEL_CLASS}>
              {t("dashboardV2.engine.postponePresets.pickDate")}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className={FORM_FIELD_CLASS}
                disabled={busy}
                data-testid={`${testId}-date`}
              />
              <Input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className={FORM_FIELD_CLASS}
                disabled={busy}
                data-testid={`${testId}-time`}
              />
            </div>
            <ActionButton
              variant="primary"
              className="w-full min-h-11"
              disabled={busy || !customDate}
              onClick={() => {
                const iso = postponeCustomIso(customDate, customTime);
                if (iso) onSelectUntil?.(iso);
              }}
              data-testid={`${testId}-confirm`}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("dashboardV2.engine.postponePresets.confirm")
              )}
            </ActionButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
