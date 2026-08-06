import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { createPhoneCall } from "@/lib/phoneApi";

function toLocalInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AddCallModal({ open, onOpenChange, t, onCreated }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [direction, setDirection] = useState("incoming");
  const [status, setStatus] = useState("answered");
  const [startedAt, setStartedAt] = useState(toLocalInputValue());
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setPhoneNumber("");
    setDirection("incoming");
    setStatus("answered");
    setStartedAt(toLocalInputValue());
    setDuration("");
    setNotes("");
    setError("");
    setSubmitting(false);
  };

  const handleClose = (next) => {
    if (submitting) return;
    if (!next) reset();
    onOpenChange?.(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!phoneNumber.trim()) {
      setError(t("calls.add.phoneRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const effectiveStatus =
        status === "missed" || status === "voicemail"
          ? status
          : direction === "outgoing"
            ? "answered"
            : status;
      const payload = {
        phoneNumber: phoneNumber.trim(),
        direction,
        status: effectiveStatus,
        startedAt: startedAt ? new Date(startedAt).toISOString() : undefined,
        duration: duration === "" ? undefined : Math.max(0, parseInt(duration, 10) || 0),
        notes: notes.trim() || undefined,
      };
      const result = await createPhoneCall(payload);
      onCreated?.(result.call);
      reset();
      onOpenChange?.(false);
    } catch (err) {
      setError(err.message || t("calls.add.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md max-h-[90dvh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        data-testid="add-call-modal"
      >
        <DialogHeader>
          <DialogTitle>{t("calls.add.title")}</DialogTitle>
          <DialogDescription>{t("calls.add.subtitle")}</DialogDescription>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-dash-text-muted">{t("calls.add.phone")}</span>
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="06 12 34 56 78"
              inputMode="tel"
              autoComplete="tel"
              data-testid="add-call-phone"
              className="min-h-11"
            />
          </label>

          <div className="grid grid-cols-3 gap-2" data-testid="add-call-direction">
            {[
              ["incoming", t("calls.direction.incoming")],
              ["outgoing", t("calls.direction.outgoing")],
              ["missed", t("calls.status.missed")],
            ].map(([key, label]) => {
              const active =
                key === "missed" ? status === "missed" : direction === key && status !== "missed";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === "missed") {
                      setDirection("incoming");
                      setStatus("missed");
                    } else {
                      setDirection(key);
                      setStatus(key === "outgoing" ? "answered" : "answered");
                    }
                  }}
                  className={[
                    "min-h-11 rounded-lg text-xs font-medium border px-2",
                    active
                      ? "bg-dash-primary text-white border-dash-primary"
                      : "bg-dash-surface text-dash-text border-dash-border",
                  ].join(" ")}
                  data-testid={`add-call-dir-${key}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-dash-text-muted">{t("calls.add.datetime")}</span>
            <Input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              data-testid="add-call-datetime"
              className="min-h-11"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-dash-text-muted">{t("calls.add.duration")}</span>
            <Input
              type="number"
              min="0"
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="120"
              data-testid="add-call-duration"
              className="min-h-11"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-dash-text-muted">{t("calls.add.notes")}</span>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="add-call-notes"
              className="min-h-11"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-600" data-testid="add-call-error">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <ActionButton
              type="button"
              variant="secondary"
              className="flex-1 min-h-11"
              disabled={submitting}
              onClick={() => handleClose(false)}
            >
              {t("actions.cancel")}
            </ActionButton>
            <ActionButton
              type="submit"
              variant="primary"
              className="flex-1 min-h-11"
              disabled={submitting}
              data-testid="add-call-submit"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t("calls.add.submit")}
            </ActionButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
