import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Voicemail, Phone } from "lucide-react";
import {
  callDisplayName,
  callStatusTone,
  formatCallDuration,
  formatCallWhen,
} from "@/utils/callJournalFormat";
import { ActionButton } from "@/components/dashboard/ActionButton";

function StatusIcon({ direction, status }) {
  const s = String(status || "").toLowerCase();
  if (s === "missed" || s === "rejected") return PhoneMissed;
  if (s === "voicemail") return Voicemail;
  if (direction === "outgoing" || s === "outgoing") return PhoneOutgoing;
  if (direction === "incoming" || s === "incoming") return PhoneIncoming;
  return Phone;
}

const TONE = {
  danger: "text-red-700 bg-red-50",
  warn: "text-amber-800 bg-amber-50",
  muted: "text-dash-text-muted bg-dash-surface-muted",
  ok: "text-emerald-700 bg-emerald-50",
  neutral: "text-dash-text-muted bg-dash-bg",
};

export default function CallCard({ call, t, lang, onOpen, onCallBack }) {
  const Icon = StatusIcon({ direction: call.direction, status: call.status });
  const tone = TONE[callStatusTone(call.status)] || TONE.neutral;
  const name = callDisplayName(call);
  const showCallback =
    call.actionStatus === "pending" ||
    ["missed", "voicemail"].includes(String(call.status || "").toLowerCase());

  return (
    <article
      className="rounded-xl border border-dash-border bg-dash-surface px-3.5 py-3 space-y-2 active:bg-dash-bg"
      data-testid={`call-card-${call.id}`}
    >
      <button
        type="button"
        onClick={() => onOpen?.(call)}
        className="w-full text-left space-y-2"
        data-testid={`call-card-open-${call.id}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              tone,
            ].join(" ")}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-dash-text truncate">{name}</h3>
              <span className="text-[11px] text-dash-text-subtle shrink-0 tabular-nums">
                {formatCallWhen(call.startedAt, lang)}
              </span>
            </div>
            <p className="text-xs text-dash-text-muted truncate mt-0.5">
              {call.phoneNumber || call.normalizedPhone}
              {call.clientName ? ` · ${t("calls.linkedClient")}` : call.isProspect ? ` · ${t("calls.unknown")}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className={["text-[11px] font-medium rounded-md px-1.5 py-0.5", tone].join(" ")}>
                {t(`calls.status.${call.status}`) !== `calls.status.${call.status}`
                  ? t(`calls.status.${call.status}`)
                  : call.status}
              </span>
              <span className="text-[11px] text-dash-text-subtle tabular-nums">
                {formatCallDuration(call.duration)}
              </span>
              {call.notes ? (
                <span className="text-[11px] text-dash-text-muted truncate max-w-[12rem]">
                  {call.notes}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </button>

      {showCallback ? (
        <div className="flex justify-end pt-0.5">
          <ActionButton
            variant="primary"
            className="min-h-11 px-4"
            onClick={() => onCallBack?.(call)}
            data-testid={`call-callback-${call.id}`}
          >
            {t("calls.actions.callBack")}
          </ActionButton>
        </div>
      ) : null}
    </article>
  );
}
