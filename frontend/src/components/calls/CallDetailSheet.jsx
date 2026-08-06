import { useEffect, useState } from "react";
import { Loader2, Phone, UserPlus, Link2, Ban, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Input } from "@/components/ui/input";
import {
  associatePhoneCall,
  createClientFromPhoneCall,
  fetchPhoneCall,
  markPhoneCallSpam,
} from "@/lib/phoneApi";
import { useClients } from "@/hooks/useClients";
import {
  callDisplayName,
  formatCallDuration,
  formatCallWhen,
} from "@/utils/callJournalFormat";

export default function CallDetailSheet({ callId, open, onClose, t, lang, onChanged }) {
  const navigate = useNavigate();
  const { clients } = useClients();
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!open || !callId) return;
    let mounted = true;
    setLoading(true);
    setError("");
    fetchPhoneCall(callId)
      .then((data) => {
        if (!mounted) return;
        setCall(data);
        setNewName(data.counterpartyName || data.phoneNumber || "");
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
      onChanged?.(fresh);
    } catch (err) {
      setError(err.message || t("calls.detail.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      data-testid="call-detail-sheet"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-dash-surface shadow-xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-dash-border bg-dash-surface">
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

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-dash-primary" />
            </div>
          ) : call ? (
            <>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-dash-text">{callDisplayName(call)}</p>
                <p className="text-sm text-dash-text-muted">{call.phoneNumber}</p>
                <p className="text-xs text-dash-text-subtle">
                  {formatCallWhen(call.startedAt, lang)} · {formatCallDuration(call.duration)} ·{" "}
                  {t(`calls.status.${call.status}`) !== `calls.status.${call.status}`
                    ? t(`calls.status.${call.status}`)
                    : call.status}
                </p>
                {call.notes ? <p className="text-sm text-dash-text pt-1">{call.notes}</p> : null}
              </div>

              <a
                href={`tel:${call.phoneNumber || call.normalizedPhone}`}
                className="flex items-center justify-center gap-2 min-h-12 rounded-xl bg-dash-primary text-white font-medium"
                data-testid="call-detail-tel"
              >
                <Phone className="w-4 h-4" />
                {t("calls.actions.callBack")}
              </a>

              {call.clientId ? (
                <ActionButton
                  variant="secondary"
                  className="w-full min-h-11"
                  onClick={() => navigate(`/dashboard/clients/${call.clientId}`)}
                  data-testid="call-detail-open-client"
                >
                  {t("calls.detail.openClient")}
                </ActionButton>
              ) : (
                <div className="space-y-3 rounded-xl border border-dash-border p-3">
                  <p className="text-sm font-medium text-dash-text">{t("calls.detail.associate")}</p>
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
                          }
                        })
                      }
                      data-testid="call-detail-create-client"
                    >
                      <UserPlus className="w-4 h-4" />
                      {t("calls.actions.createClient")}
                    </ActionButton>
                  </div>

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
                </div>
              )}
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
