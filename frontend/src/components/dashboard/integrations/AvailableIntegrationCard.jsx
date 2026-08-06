import { Loader2, Link2, RefreshCw, Unplug } from "lucide-react";
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

export default function AvailableIntegrationCard({
  testIdPrefix,
  title,
  desc,
  Logo,
  status,
  preview,
  confirmImport,
  busy,
  t,
  lang,
  summaryKeys,
  onConnect,
  onPreviewImport,
  onConfirmImport,
  onCancelImport,
  onSync,
  onDisconnect,
  importPromptTemplate,
}) {
  const connected = Boolean(status?.connected);
  const account = status?.account;
  const lastSync = status?.lastSync;
  const hasSummary = Array.isArray(summaryKeys) && summaryKeys.length > 0;
  const lastSyncedLabel = formatDate(account?.lastSyncedAt || lastSync?.finishedAt, lang);
  const importPrompt = (importPromptTemplate || "").replace(
    "{count}",
    String(preview?.contactCount ?? preview?.messageCount ?? 0),
  );

  return (
    <article className={cardBase} data-testid={`${testIdPrefix}-card`}>
      <div className="flex items-start gap-4 mb-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-dash-bg ring-1 ring-[#E5E7EB]/60">
          <Logo className="w-7 h-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-cabinet text-base font-semibold text-dash-text tracking-tight">{title}</h3>
          <p className="mt-1 text-sm text-dash-text-muted line-clamp-2 leading-relaxed">{desc}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={[
            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
            connected ? "bg-emerald-50 text-emerald-700" : "bg-dash-surface-muted text-dash-text-muted",
          ].join(" ")}
          data-testid={`${testIdPrefix}-status`}
        >
          {connected
            ? t("integrations.shared.statusConnected")
            : t("integrations.shared.statusNotConnected")}
        </span>
        {account?.accountEmail ? (
          <span className="truncate text-xs text-dash-text-muted" data-testid={`${testIdPrefix}-email`}>
            {account.accountEmail}
          </span>
        ) : null}
      </div>

      {lastSyncedLabel ? (
        <p className="text-xs text-dash-text-subtle mb-3" data-testid={`${testIdPrefix}-last-sync`}>
          {t("integrations.shared.lastSync")}: {lastSyncedLabel}
        </p>
      ) : (
        <div className="mb-3" aria-hidden />
      )}

      {hasSummary ? (
        <dl
          className="grid grid-cols-2 gap-2 mb-4 text-sm"
          data-testid={`${testIdPrefix}-summary`}
        >
          {summaryKeys.map(([key, value]) => (
            <div key={key} className="rounded-lg bg-dash-bg px-3 py-2">
              <dt className="text-[11px] text-dash-text-subtle">{t(`integrations.shared.summary.${key}`)}</dt>
              <dd
                className="font-semibold text-dash-text tabular-nums"
                data-testid={`${testIdPrefix}-summary-${key}`}
              >
                {value ?? 0}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="flex-1" />
      )}

      {confirmImport && preview ? (
        <div
          className="rounded-xl bg-dash-bg p-4 mb-4 space-y-3 ring-1 ring-[#E5E7EB]/60"
          data-testid={`${testIdPrefix}-import-confirm`}
        >
          <p className="text-sm text-dash-text">{importPrompt}</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              type="button"
              disabled={busy}
              onClick={onConfirmImport}
              data-testid={`${testIdPrefix}-confirm-import`}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t("integrations.shared.confirmImport")}
            </ActionButton>
            <ActionButton
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={onCancelImport}
              data-testid={`${testIdPrefix}-cancel-import`}
            >
              {t("actions.cancel")}
            </ActionButton>
          </div>
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        {!connected ? (
          <ActionButton
            type="button"
            variant="primary"
            disabled={busy || !status?.configured}
            onClick={onConnect}
            data-testid={`${testIdPrefix}-connect`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {t("integrations.shared.connect")}
          </ActionButton>
        ) : (
          <>
            {!confirmImport ? (
              <ActionButton
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={onPreviewImport}
                data-testid={`${testIdPrefix}-import`}
              >
                {t("integrations.shared.configure")}
              </ActionButton>
            ) : null}
            <ActionButton
              type="button"
              variant="primary"
              disabled={busy}
              onClick={onSync}
              data-testid={`${testIdPrefix}-sync`}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {t("integrations.shared.sync")}
            </ActionButton>
            <ActionButton
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={onDisconnect}
              data-testid={`${testIdPrefix}-disconnect`}
            >
              <Unplug className="w-4 h-4" />
              {t("integrations.shared.disconnect")}
            </ActionButton>
          </>
        )}
      </div>

      {!status?.configured ? (
        <p className="mt-3 text-xs text-dash-text-subtle" data-testid={`${testIdPrefix}-not-configured`}>
          {t("integrations.shared.notConfigured")}
        </p>
      ) : null}

      {status?.providerMode === "mock" ? (
        <p className="mt-2 text-xs text-dash-text-subtle" data-testid={`${testIdPrefix}-mock-mode`}>
          {t("integrations.shared.mockMode")}
        </p>
      ) : null}
    </article>
  );
}
