import { Loader2, Link2, RefreshCw, Unplug, Phone } from "lucide-react";
import { ActionButton } from "@/components/dashboard/ActionButton";

const cardBase =
  "flex flex-col h-full min-h-[320px] rounded-2xl bg-dash-surface p-6 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_4px_16px_rgba(17,24,39,0.04)] ring-1 ring-[#E5E7EB]/80";

function formatDate(value, language) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function StatusBadge({ connected, syncing, t, testId }) {
  if (syncing) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-sky-50 text-sky-800"
        data-testid={testId}
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        {t("integrations.phone.statusSyncing")}
      </span>
    );
  }
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        connected ? "bg-emerald-50 text-emerald-700" : "bg-dash-surface-muted text-dash-text-muted",
      ].join(" ")}
      data-testid={testId}
    >
      {connected
        ? t("integrations.shared.statusConnected")
        : t("integrations.shared.statusNotConnected")}
    </span>
  );
}

export default function PhoneIntegrationCard({
  status,
  preview,
  confirmImport,
  busy,
  t,
  lang,
  Logo,
  onConnect,
  onPreviewImport,
  onConfirmImport,
  onCancelImport,
  onSync,
  onDisconnect,
}) {
  const connected = Boolean(status?.connected);
  const syncing = Boolean(status?.syncing) || busy;
  const account = status?.account;
  const lastSync = status?.lastSync;
  const lastCall = status?.lastCall;
  const lastSyncedLabel = formatDate(account?.lastSyncedAt || lastSync?.finishedAt, lang);
  const lastCallLabel = formatDate(lastCall?.startedAt, lang);
  const importPrompt = t("integrations.phone.importPrompt").replace(
    "{count}",
    String(preview?.callCount ?? 0),
  );

  return (
    <article className={cardBase} data-testid="phone-card">
      <div className="flex items-start gap-4 mb-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-dash-bg ring-1 ring-[#E5E7EB]/60">
          {Logo ? <Logo className="w-7 h-7" /> : <Phone className="w-6 h-6 text-dash-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-cabinet text-base font-semibold text-dash-text tracking-tight">
            {t("integrations.phone.title")}
          </h3>
          <p className="mt-1 text-sm text-dash-text-muted line-clamp-2 leading-relaxed">
            {t("integrations.phone.desc")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <StatusBadge connected={connected} syncing={Boolean(status?.syncing)} t={t} testId="phone-status" />
        {account?.accountName ? (
          <span className="truncate text-xs text-dash-text-muted" data-testid="phone-account">
            {account.accountName}
          </span>
        ) : null}
        {status?.providerMode ? (
          <span className="text-[11px] text-dash-text-subtle" data-testid="phone-provider-mode">
            {status.providerMode}
          </span>
        ) : null}
      </div>

      <div className="space-y-1.5 mb-4 text-xs text-dash-text-subtle">
        <p data-testid="phone-last-sync">
          {t("integrations.shared.lastSync")}: {lastSyncedLabel || "—"}
        </p>
        <p data-testid="phone-last-call">
          {t("integrations.phone.lastCall")}:{" "}
          {lastCallLabel
            ? `${lastCallLabel}${lastCall?.phoneNumber ? ` · ${lastCall.phoneNumber}` : ""}`
            : "—"}
        </p>
      </div>

      {(status?.stats?.total || 0) > 0 ? (
        <dl className="grid grid-cols-2 gap-2 mb-4 text-sm" data-testid="phone-summary">
          {[
            ["linked", status.stats.linked],
            ["total", status.stats.total],
            ["missed", status.stats.missed],
            ["unmatched", status.stats.unmatched],
          ].map(([key, value]) => (
            <div key={key} className="rounded-lg bg-dash-bg px-3 py-2">
              <dt className="text-[11px] text-dash-text-subtle">
                {t(`integrations.phone.summary.${key}`)}
              </dt>
              <dd className="font-semibold text-dash-text tabular-nums" data-testid={`phone-summary-${key}`}>
                {value ?? 0}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="flex-1 mb-4" />
      )}

      {confirmImport ? (
        <div className="mt-auto space-y-3" data-testid="phone-confirm-import">
          <p className="text-sm text-dash-text">{importPrompt}</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="primary" disabled={busy} onClick={onConfirmImport} data-testid="phone-confirm">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t("integrations.shared.confirmImport")}
            </ActionButton>
            <ActionButton variant="secondary" disabled={busy} onClick={onCancelImport} data-testid="phone-cancel">
              {t("actions.cancel")}
            </ActionButton>
          </div>
        </div>
      ) : (
        <div className="mt-auto flex flex-wrap gap-2">
          {!connected ? (
            <ActionButton
              variant="primary"
              disabled={busy}
              onClick={onConnect}
              data-testid="phone-connect"
              className="gap-1.5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {t("integrations.shared.connect")}
            </ActionButton>
          ) : (
            <>
              <ActionButton
                variant="secondary"
                disabled={busy || syncing}
                onClick={onPreviewImport}
                data-testid="phone-preview"
              >
                {t("integrations.shared.import")}
              </ActionButton>
              <ActionButton
                variant="secondary"
                disabled={busy || syncing}
                onClick={onSync}
                data-testid="phone-sync"
                className="gap-1.5"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {t("integrations.shared.sync")}
              </ActionButton>
              <ActionButton
                variant="ghost"
                disabled={busy}
                onClick={onDisconnect}
                data-testid="phone-disconnect"
                className="gap-1.5 text-dash-text-muted"
              >
                <Unplug className="w-4 h-4" />
                {t("integrations.shared.disconnect")}
              </ActionButton>
            </>
          )}
        </div>
      )}
    </article>
  );
}
