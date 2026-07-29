import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Link2, Loader2, RefreshCw, Unplug } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import PageHeader from "@/components/dashboard/PageHeader";
import SettingsShell from "@/components/dashboard/SettingsShell";
import { PageLoader } from "@/components/dashboard/PageFeedback";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  disconnectGmail,
  disconnectGoogleContacts,
  fetchGmailStatus,
  fetchGoogleContactsStatus,
  importGoogleContacts,
  previewGmail,
  previewGoogleContacts,
  startGmailConnect,
  startGoogleContactsConnect,
  syncGmail,
  syncGoogleContacts,
} from "@/lib/integrationsApi";

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

function IntegrationCard({
  testIdPrefix,
  title,
  desc,
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
  const lastSyncedLabel = formatDate(account?.lastSyncedAt || lastSync?.finishedAt, lang);
  const importPrompt = (importPromptTemplate || "").replace(
    "{count}",
    String(preview?.contactCount ?? preview?.messageCount ?? 0),
  );

  return (
    <SettingsShell.Section title={title} testId={`${testIdPrefix}-card`}>
      <p className="text-sm text-[#6B7280] mb-4">{desc}</p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span
          className={[
            "inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium",
            connected ? "bg-emerald-50 text-emerald-800" : "bg-[#F3F4F6] text-[#4B5563]",
          ].join(" ")}
          data-testid={`${testIdPrefix}-status`}
        >
          {connected
            ? t("integrations.shared.statusConnected")
            : t("integrations.shared.statusDisconnected")}
        </span>
        {account?.accountEmail ? (
          <span className="text-sm text-[#111827]" data-testid={`${testIdPrefix}-email`}>
            {account.accountEmail}
          </span>
        ) : null}
      </div>

      {lastSyncedLabel ? (
        <p className="text-xs text-[#6B7280] mb-4" data-testid={`${testIdPrefix}-last-sync`}>
          {t("integrations.shared.lastSync")}: {lastSyncedLabel}
        </p>
      ) : null}

      {lastSync ? (
        <dl
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 text-sm"
          data-testid={`${testIdPrefix}-summary`}
        >
          {summaryKeys.map(([key, value]) => (
            <div key={key} className="rounded-xl bg-[#F9FAFB] px-3 py-2">
              <dt className="text-xs text-[#6B7280]">{t(`integrations.shared.summary.${key}`)}</dt>
              <dd
                className="font-semibold text-[#111827]"
                data-testid={`${testIdPrefix}-summary-${key}`}
              >
                {value ?? 0}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {confirmImport && preview ? (
        <div
          className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 mb-4 space-y-3"
          data-testid={`${testIdPrefix}-import-confirm`}
        >
          <p className="text-sm text-[#111827]">{importPrompt}</p>
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

      <div className="flex flex-wrap gap-2">
        {!connected ? (
          <ActionButton
            type="button"
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
                {t("integrations.shared.import")}
              </ActionButton>
            ) : null}
            <ActionButton
              type="button"
              disabled={busy}
              onClick={onSync}
              data-testid={`${testIdPrefix}-sync`}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {t("integrations.shared.syncNow")}
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
        <p className="mt-3 text-xs text-[#9CA3AF]" data-testid={`${testIdPrefix}-not-configured`}>
          {t("integrations.shared.notConfigured")}
        </p>
      ) : null}

      {status?.providerMode === "mock" ? (
        <p className="mt-2 text-xs text-[#9CA3AF]" data-testid={`${testIdPrefix}-mock-mode`}>
          {t("integrations.shared.mockMode")}
        </p>
      ) : null}
    </SettingsShell.Section>
  );
}

export default function IntegrationsPage() {
  const { t, lang } = useDashboardLang();
  usePageTitle("page.integrations.title");
  const [searchParams, setSearchParams] = useSearchParams();

  const [contactsStatus, setContactsStatus] = useState(null);
  const [gmailStatus, setGmailStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [contactsPreview, setContactsPreview] = useState(null);
  const [gmailPreview, setGmailPreview] = useState(null);
  const [confirmContacts, setConfirmContacts] = useState(false);
  const [confirmGmail, setConfirmGmail] = useState(false);

  const reload = useCallback(async () => {
    const [contacts, gmail] = await Promise.all([
      fetchGoogleContactsStatus(),
      fetchGmailStatus(),
    ]);
    setContactsStatus(contacts);
    setGmailStatus(gmail);
    return { contacts, gmail };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await reload();
      } catch (err) {
        if (mounted) toast.error(err.message || t("integrations.shared.loadError"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [reload, t]);

  useEffect(() => {
    const contactsFlag = searchParams.get("google_contacts");
    const gmailFlag = searchParams.get("gmail");
    if (!contactsFlag && !gmailFlag) return;

    if (contactsFlag === "connected") {
      toast.success(t("integrations.google.connectedToast"));
      setConfirmContacts(true);
      previewGoogleContacts().then(setContactsPreview).catch(() => setContactsPreview(null));
      reload().catch(() => {});
    } else if (contactsFlag === "error") {
      toast.error(t("integrations.google.connectError"));
    }

    if (gmailFlag === "connected") {
      toast.success(t("integrations.gmail.connectedToast"));
      setConfirmGmail(true);
      previewGmail().then(setGmailPreview).catch(() => setGmailPreview(null));
      reload().catch(() => {});
    } else if (gmailFlag === "error") {
      toast.error(t("integrations.gmail.connectError"));
    }

    const next = new URLSearchParams(searchParams);
    next.delete("google_contacts");
    next.delete("gmail");
    next.delete("reason");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, reload, t]);

  const runBusy = async (key, fn) => {
    setBusyKey(key);
    try {
      await fn();
    } finally {
      setBusyKey(null);
    }
  };

  const contactsSummary = contactsStatus?.lastSync
    ? [
        ["created", contactsStatus.lastSync.created],
        ["enriched", contactsStatus.lastSync.enriched],
        ["conflicts", contactsStatus.lastSync.conflicts],
        ["skipped", contactsStatus.lastSync.skipped],
      ]
    : [];

  const gmailSummary = gmailStatus?.lastSync
    ? [
        ["linked", gmailStatus.lastSync.created],
        ["skipped", gmailStatus.lastSync.skipped],
        ["total", gmailStatus.lastSync.total],
      ]
    : [];

  return (
    <div className="space-y-6" data-testid="integrations-page">
      <PageHeader
        title={t("page.integrations.title")}
        subtitle={t("page.integrations.subtitle")}
        testId="integrations-header"
      />

      <SettingsShell activeKey="integrations">
        {loading ? (
          <PageLoader />
        ) : (
          <div className="space-y-4">
            <IntegrationCard
              testIdPrefix="google-contacts"
              title={t("integrations.google.title")}
              desc={t("integrations.google.desc")}
              status={contactsStatus}
              preview={contactsPreview}
              confirmImport={confirmContacts}
              busy={busyKey === "contacts"}
              t={t}
              lang={lang}
              summaryKeys={contactsSummary}
              importPromptTemplate={t("integrations.google.importPrompt")}
              onConnect={() =>
                runBusy("contacts", async () => {
                  const data = await startGoogleContactsConnect();
                  if (data?.authorizeUrl) window.location.href = data.authorizeUrl;
                  else toast.error(t("integrations.google.connectError"));
                })
              }
              onPreviewImport={() =>
                runBusy("contacts", async () => {
                  const data = await previewGoogleContacts();
                  setContactsPreview(data);
                  setConfirmContacts(true);
                })
              }
              onConfirmImport={() =>
                runBusy("contacts", async () => {
                  const data = await importGoogleContacts();
                  setContactsStatus((prev) => ({
                    ...prev,
                    connected: true,
                    account: data.account,
                    lastSync: data.summary,
                  }));
                  setConfirmContacts(false);
                  setContactsPreview(null);
                  toast.success(t("integrations.google.importDone"));
                })
              }
              onCancelImport={() => {
                setConfirmContacts(false);
                setContactsPreview(null);
              }}
              onSync={() =>
                runBusy("contacts", async () => {
                  const data = await syncGoogleContacts();
                  setContactsStatus((prev) => ({
                    ...prev,
                    connected: true,
                    account: data.account,
                    lastSync: data.summary,
                  }));
                  toast.success(t("integrations.google.syncDone"));
                })
              }
              onDisconnect={() =>
                runBusy("contacts", async () => {
                  if (!window.confirm(t("integrations.google.disconnectConfirm"))) return;
                  await disconnectGoogleContacts();
                  setContactsStatus((prev) => ({
                    ...prev,
                    connected: false,
                    account: null,
                    lastSync: null,
                  }));
                  setContactsPreview(null);
                  setConfirmContacts(false);
                  toast.success(t("integrations.google.disconnectedToast"));
                })
              }
            />

            <IntegrationCard
              testIdPrefix="gmail"
              title={t("integrations.gmail.title")}
              desc={t("integrations.gmail.desc")}
              status={gmailStatus}
              preview={gmailPreview}
              confirmImport={confirmGmail}
              busy={busyKey === "gmail"}
              t={t}
              lang={lang}
              summaryKeys={gmailSummary}
              importPromptTemplate={t("integrations.gmail.importPrompt")}
              onConnect={() =>
                runBusy("gmail", async () => {
                  const data = await startGmailConnect();
                  if (data?.authorizeUrl) window.location.href = data.authorizeUrl;
                  else toast.error(t("integrations.gmail.connectError"));
                })
              }
              onPreviewImport={() =>
                runBusy("gmail", async () => {
                  const data = await previewGmail();
                  setGmailPreview(data);
                  setConfirmGmail(true);
                })
              }
              onConfirmImport={() =>
                runBusy("gmail", async () => {
                  const data = await syncGmail();
                  setGmailStatus((prev) => ({
                    ...prev,
                    connected: true,
                    account: data.account,
                    lastSync: {
                      created: data.summary.linked,
                      enriched: 0,
                      conflicts: 0,
                      skipped: data.summary.skipped + data.summary.unmatched,
                      total: data.summary.total,
                      finishedAt: data.summary.finishedAt,
                    },
                  }));
                  setConfirmGmail(false);
                  setGmailPreview(null);
                  toast.success(t("integrations.gmail.syncDone"));
                })
              }
              onCancelImport={() => {
                setConfirmGmail(false);
                setGmailPreview(null);
              }}
              onSync={() =>
                runBusy("gmail", async () => {
                  const data = await syncGmail();
                  setGmailStatus((prev) => ({
                    ...prev,
                    connected: true,
                    account: data.account,
                    lastSync: {
                      created: data.summary.linked,
                      enriched: 0,
                      conflicts: 0,
                      skipped: data.summary.skipped + data.summary.unmatched,
                      total: data.summary.total,
                      finishedAt: data.summary.finishedAt,
                    },
                  }));
                  toast.success(t("integrations.gmail.syncDone"));
                })
              }
              onDisconnect={() =>
                runBusy("gmail", async () => {
                  if (!window.confirm(t("integrations.gmail.disconnectConfirm"))) return;
                  await disconnectGmail();
                  setGmailStatus((prev) => ({
                    ...prev,
                    connected: false,
                    account: null,
                    lastSync: null,
                  }));
                  setGmailPreview(null);
                  setConfirmGmail(false);
                  toast.success(t("integrations.gmail.disconnectedToast"));
                })
              }
            />
          </div>
        )}
      </SettingsShell>
    </div>
  );
}
