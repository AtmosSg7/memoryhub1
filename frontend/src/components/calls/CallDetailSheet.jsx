import { useEffect, useState } from "react";
import {
  Ban,
  BellPlus,
  Link2,
  Loader2,
  MessageSquareText,
  Phone,
  StickyNote,
  UserPlus,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  associatePhoneCall,
  createClientFromPhoneCall,
  fetchPhoneCall,
  markPhoneCallSpam,
} from "@/lib/phoneApi";
import { fetchHubConversation } from "@/lib/hubApi";
import { createNote } from "@/lib/notesApi";
import { useClients } from "@/hooks/useClients";
import { useAddNote } from "@/context/AddNoteContext";
import {
  callDisplayName,
  callStatusTone,
  formatCallDate,
  formatCallDuration,
  formatCallTime,
} from "@/utils/callJournalFormat";

const STATUS_TONE = {
  danger: "text-red-700 bg-red-50",
  warn: "text-amber-800 bg-amber-50",
  muted: "text-dash-text-muted bg-dash-surface-muted",
  ok: "text-emerald-700 bg-emerald-50",
  neutral: "text-dash-text-muted bg-dash-bg",
};

function statusLabel(t, status) {
  const key = `calls.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

function directionLabel(t, direction) {
  const key = `calls.direction.${direction}`;
  const label = t(key);
  return label === key ? direction : label;
}

function tomorrowMorningIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

function MetaRow({ label, value, testId }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm" data-testid={testId}>
      <span className="text-dash-text-subtle shrink-0">{label}</span>
      <span className="text-dash-text text-right break-all">{value}</span>
    </div>
  );
}

export default function CallDetailSheet({ callId, open, onClose, t, lang, onChanged }) {
  const navigate = useNavigate();
  const { clients } = useClients();
  const { openAddNote } = useAddNote();
  const [call, setCall] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState("");
  const [newName, setNewName] = useState("");
  const [assocOpen, setAssocOpen] = useState("");

  useEffect(() => {
    if (!open || !callId) return;
    let mounted = true;
    setLoading(true);
    setError("");
    setConversation(null);
    setClientId("");
    setAssocOpen("");
    setCall(null);

    fetchPhoneCall(callId)
      .then(async (data) => {
        if (!mounted) return;
        setCall(data);
        setNewName(data.counterpartyName || data.phoneNumber || "");
        if (data.conversationId) {
          try {
            const detail = await fetchHubConversation(data.conversationId);
            if (mounted) setConversation(detail?.conversation || null);
          } catch {
            if (mounted) setConversation(null);
          }
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message || t("calls.detail.error"));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, callId, t]);

  if (!open) return null;

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      const fresh = await fetchPhoneCall(callId);
      setCall(fresh);
      setNewName(fresh.counterpartyName || fresh.phoneNumber || "");
      onChanged?.(fresh);
    } catch (err) {
      setError(err.message || t("calls.detail.error"));
    } finally {
      setBusy(false);
    }
  };

  const phoneHref = call ? `tel:${call.phoneNumber || call.normalizedPhone}` : "#";
  const displayName = call ? callDisplayName(call) : "";
  const knownName =
    call?.counterpartyName?.trim() &&
    call.counterpartyName.trim() !== (call.phoneNumber || "").trim()
      ? call.counterpartyName.trim()
      : null;
  const tone = STATUS_TONE[callStatusTone(call?.status)] || STATUS_TONE.neutral;
  const vendorLabel = call?.vendor
    ? t(`calls.detail.source.${call.vendor}`) !== `calls.detail.source.${call.vendor}`
      ? t(`calls.detail.source.${call.vendor}`)
      : call.vendor
    : t("calls.detail.source.manual");

  const handleCreateReminder = async () => {
    if (!call || busy) return;
    setBusy(true);
    setError("");
    try {
      const label = knownName || call.phoneNumber || displayName;
      await createNote({
        title: t("calls.detail.reminderTitle").replace("{name}", label),
        content: t("calls.detail.reminderBody")
          .replace("{phone}", call.phoneNumber || call.normalizedPhone || "")
          .replace("{when}", formatCallDate(call.startedAt, lang)),
        type: "phone",
        clientId: call.clientId || undefined,
        remindAt: tomorrowMorningIso(),
      });
      toast.success(t("calls.detail.reminderCreated"));
    } catch (err) {
      setError(err.message || t("calls.detail.error"));
    } finally {
      setBusy(false);
    }
  };

  const handleAddNote = () => {
    if (!call) return;
    openAddNote(
      call.clientId
        ? { id: call.clientId, name: call.clientName || knownName || call.phoneNumber }
        : null,
    );
  };

  const openConversation = () => {
    if (!call?.conversationId) return;
    if (call.clientId) {
      navigate(
        `/dashboard/clients/${call.clientId}?section=emails&conversation=${call.conversationId}`,
      );
      onClose?.();
      return;
    }
    navigate(`/dashboard/communications?conversation=${call.conversationId}`);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      data-testid="call-detail-sheet"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      <div className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-dash-surface shadow-xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b border-dash-border bg-dash-surface/95 backdrop-blur-sm">
          <h2 className="text-base font-semibold text-dash-text">{t("calls.detail.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-dash-text-muted"
            data-testid="call-detail-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-dash-primary" />
            </div>
          ) : call ? (
            <>
              {/* 1. Header — consultation first */}
              <header className="space-y-3" data-testid="call-detail-header">
                <div className="space-y-1">
                  <p className="text-xl font-semibold tracking-tight text-dash-text tabular-nums">
                    {call.phoneNumber || call.normalizedPhone || "—"}
                  </p>
                  {knownName ? (
                    <p className="text-sm font-medium text-dash-text">{knownName}</p>
                  ) : null}
                  {call.clientId ? (
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/dashboard/clients/${call.clientId}`);
                        onClose?.();
                      }}
                      className="text-sm text-dash-primary hover:underline"
                      data-testid="call-detail-open-client"
                    >
                      {call.clientName || t("calls.detail.openClient")}
                    </button>
                  ) : (
                    <p className="text-xs text-dash-text-subtle">{t("calls.unknown")}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={["text-[11px] font-medium rounded-md px-2 py-1", tone].join(" ")}
                    data-testid="call-detail-status"
                  >
                    {statusLabel(t, call.status)}
                  </span>
                  <span className="text-xs text-dash-text-muted tabular-nums">
                    {formatCallDate(call.startedAt, lang)}
                  </span>
                  <span className="text-xs text-dash-text-subtle">·</span>
                  <span className="text-xs text-dash-text-muted tabular-nums">
                    {formatCallTime(call.startedAt, lang)}
                  </span>
                  <span className="text-xs text-dash-text-subtle">·</span>
                  <span className="text-xs text-dash-text-muted tabular-nums">
                    {formatCallDuration(call.duration)}
                  </span>
                </div>

                {call.notes ? (
                  <p
                    className="text-sm text-dash-text leading-relaxed rounded-lg bg-dash-bg px-3 py-2"
                    data-testid="call-detail-notes"
                  >
                    {call.notes}
                  </p>
                ) : null}
              </header>

              {/* 2. Primary actions — one row */}
              <div
                className="grid grid-cols-3 gap-2"
                data-testid="call-detail-primary-actions"
              >
                <a
                  href={phoneHref}
                  className="inline-flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl bg-dash-primary px-2 text-white text-[11px] font-medium"
                  data-testid="call-detail-tel"
                >
                  <Phone className="w-4 h-4" />
                  {t("calls.detail.actions.call")}
                </a>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCreateReminder}
                  className="inline-flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border border-dash-border bg-dash-surface px-2 text-[11px] font-medium text-dash-text disabled:opacity-50"
                  data-testid="call-detail-reminder"
                >
                  <BellPlus className="w-4 h-4 text-dash-primary" />
                  {t("calls.detail.actions.reminder")}
                </button>
                <button
                  type="button"
                  onClick={handleAddNote}
                  className="inline-flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border border-dash-border bg-dash-surface px-2 text-[11px] font-medium text-dash-text"
                  data-testid="call-detail-add-note"
                >
                  <StickyNote className="w-4 h-4 text-dash-primary" />
                  {t("calls.detail.actions.note")}
                </button>
              </div>

              {/* 3. Phone conversation */}
              {call.conversationId ? (
                <section
                  className="rounded-xl border border-dash-border bg-dash-bg/60 px-3.5 py-3 space-y-2"
                  data-testid="call-detail-conversation"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-dash-text">
                    <MessageSquareText className="w-4 h-4 text-dash-primary shrink-0" />
                    {t("calls.detail.conversation")}
                  </div>
                  <p className="text-sm text-dash-text line-clamp-2">
                    {conversation?.subject || call.subject || t("calls.detail.conversationFallback")}
                  </p>
                  <p className="text-xs text-dash-text-muted line-clamp-2">
                    {conversation?.preview ||
                      t("calls.detail.conversationMeta").replace(
                        "{count}",
                        String(conversation?.messageCount ?? "—"),
                      )}
                  </p>
                  <ActionButton
                    variant="secondary"
                    className="w-full min-h-10 text-sm"
                    onClick={openConversation}
                    data-testid="call-detail-open-conversation"
                  >
                    {t("calls.detail.openConversation")}
                  </ActionButton>
                </section>
              ) : null}

              {/* 4. Technical info */}
              <section
                className="rounded-xl border border-dash-border-soft px-3.5 py-2 divide-y divide-dash-border-soft"
                data-testid="call-detail-tech"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-dash-text-subtle py-2">
                  {t("calls.detail.techTitle")}
                </p>
                <MetaRow
                  label={t("calls.detail.tech.direction")}
                  value={directionLabel(t, call.direction)}
                  testId="call-detail-tech-direction"
                />
                <MetaRow
                  label={t("calls.detail.tech.duration")}
                  value={formatCallDuration(call.duration)}
                  testId="call-detail-tech-duration"
                />
                <MetaRow
                  label={t("calls.detail.tech.source")}
                  value={vendorLabel}
                  testId="call-detail-tech-source"
                />
                <MetaRow
                  label={t("calls.detail.tech.normalized")}
                  value={call.normalizedPhone || "—"}
                  testId="call-detail-tech-normalized"
                />
              </section>

              {/* 5. Association — collapsed by default */}
              <Accordion
                type="single"
                collapsible
                value={assocOpen}
                onValueChange={setAssocOpen}
                className="rounded-xl border border-dash-border px-3.5"
                data-testid="call-detail-association"
              >
                <AccordionItem value="association" className="border-0">
                  <AccordionTrigger
                    className="py-3 text-sm font-medium text-dash-text hover:no-underline min-h-11"
                    data-testid="call-detail-association-trigger"
                  >
                    <span className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-dash-text-muted" />
                      {t("calls.detail.associationTitle")}
                      {call.clientId ? (
                        <span className="text-[11px] font-normal text-dash-text-subtle">
                          · {call.clientName || t("calls.linkedClient")}
                        </span>
                      ) : (
                        <span className="text-[11px] font-normal text-dash-text-subtle">
                          · {t("calls.unknown")}
                        </span>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 space-y-3">
                    {call.clientId ? (
                      <ActionButton
                        variant="secondary"
                        className="w-full min-h-11"
                        onClick={() => {
                          navigate(`/dashboard/clients/${call.clientId}`);
                          onClose?.();
                        }}
                        data-testid="call-detail-assoc-open-client"
                      >
                        {t("calls.detail.openClient")}
                      </ActionButton>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <p className="text-xs text-dash-text-muted">
                            {t("calls.detail.associate")}
                          </p>
                          <select
                            className="w-full min-h-11 rounded-lg border border-dash-border bg-dash-bg px-3 text-sm"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            data-testid="call-detail-client-select"
                          >
                            <option value="">{t("calls.detail.pickClient")}</option>
                            {(clients || []).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name || c.company || c.email || c.phone}
                              </option>
                            ))}
                          </select>
                          <ActionButton
                            variant="secondary"
                            className="w-full min-h-11 gap-1.5"
                            disabled={!clientId || busy}
                            onClick={() => run(() => associatePhoneCall(call.id, clientId))}
                            data-testid="call-detail-associate"
                          >
                            <Link2 className="w-4 h-4" />
                            {t("calls.actions.associate")}
                          </ActionButton>
                        </div>

                        <div className="border-t border-dash-border-soft pt-3 space-y-2">
                          <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder={t("calls.detail.clientName")}
                            className="min-h-11"
                            data-testid="call-detail-new-name"
                          />
                          <ActionButton
                            variant="primary"
                            className="w-full min-h-11 gap-1.5"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                const res = await createClientFromPhoneCall(call.id, {
                                  name: newName || call.phoneNumber,
                                  phone: call.phoneNumber,
                                });
                                if (res?.client?.id) {
                                  navigate(`/dashboard/clients/${res.client.id}`);
                                  onClose?.();
                                }
                              })
                            }
                            data-testid="call-detail-create-client"
                          >
                            <UserPlus className="w-4 h-4" />
                            {t("calls.actions.createClient")}
                          </ActionButton>
                        </div>
                      </>
                    )}

                    {String(call.status || "").toLowerCase() !== "spam" ? (
                      <ActionButton
                        variant="ghost"
                        className="w-full min-h-11 gap-1.5 text-dash-text-muted"
                        disabled={busy}
                        onClick={() => run(() => markPhoneCallSpam(call.id))}
                        data-testid="call-detail-spam"
                      >
                        <Ban className="w-4 h-4" />
                        {t("calls.actions.spam")}
                      </ActionButton>
                    ) : null}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          ) : null}

          {error ? (
            <p className="text-sm text-red-600" data-testid="call-detail-error">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
