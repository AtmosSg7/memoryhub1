import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import PageHeader from "@/components/dashboard/PageHeader";
import SettingsShell from "@/components/dashboard/SettingsShell";
import { PageLoader } from "@/components/dashboard/PageFeedback";
import AvailableIntegrationCard from "@/components/dashboard/integrations/AvailableIntegrationCard";
import ComingSoonIntegrationCard from "@/components/dashboard/integrations/ComingSoonIntegrationCard";
import PhoneIntegrationCard from "@/components/dashboard/integrations/PhoneIntegrationCard";
import IntegrationsBenefits from "@/components/dashboard/integrations/IntegrationsBenefits";
import { COMING_SOON_INTEGRATIONS } from "@/components/dashboard/integrations/comingSoonIntegrations";
import { GmailLogo, GoogleContactsLogo, PhoneLogo } from "@/components/dashboard/integrations/integrationLogos";
import {
  disconnectGmail,
  disconnectGoogleContacts,
  disconnectPhone,
  fetchGmailStatus,
  fetchGoogleContactsStatus,
  fetchPhoneStatus,
  importGoogleContacts,
  previewGmail,
  previewGoogleContacts,
  previewPhone,
  startGmailConnect,
  startGoogleContactsConnect,
  startPhoneConnect,
  syncGmail,
  syncGoogleContacts,
  syncPhone,
} from "@/lib/integrationsApi";
import { buildGmailSummaryKeys } from "@/utils/gmailIntegrationSummary";

const integrationsGrid =
  "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch";

export default function IntegrationsPage() {
  const { t, lang } = useDashboardLang();
  usePageTitle("page.integrations.title");
  const [searchParams, setSearchParams] = useSearchParams();

  const [contactsStatus, setContactsStatus] = useState(null);
  const [gmailStatus, setGmailStatus] = useState(null);
  const [phoneStatus, setPhoneStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [contactsPreview, setContactsPreview] = useState(null);
  const [gmailPreview, setGmailPreview] = useState(null);
  const [phonePreview, setPhonePreview] = useState(null);
  const [confirmContacts, setConfirmContacts] = useState(false);
  const [confirmGmail, setConfirmGmail] = useState(false);
  const [confirmPhone, setConfirmPhone] = useState(false);

  const reload = useCallback(async () => {
    const [contacts, gmail, phone] = await Promise.all([
      fetchGoogleContactsStatus(),
      fetchGmailStatus(),
      fetchPhoneStatus(),
    ]);
    setContactsStatus(contacts);
    setGmailStatus(gmail);
    setPhoneStatus(phone);
    return { contacts, gmail, phone };
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

  const gmailSummary = buildGmailSummaryKeys(gmailStatus);

  return (
    <div className="space-y-8" data-testid="integrations-page">
      <PageHeader
        title={t("page.integrations.title")}
        subtitle={t("page.integrations.subtitle")}
        testId="integrations-header"
      />

      <SettingsShell activeKey="integrations">
        {loading ? (
          <PageLoader />
        ) : (
          <div className="space-y-10">
            <section data-testid="integrations-section-available">
              <h2 className="font-cabinet text-sm font-semibold uppercase tracking-wider text-dash-text-subtle mb-5">
                {t("integrations.sections.available")}
              </h2>
              <div className={integrationsGrid}>
                <AvailableIntegrationCard
                  testIdPrefix="google-contacts"
                  title={t("integrations.google.title")}
                  desc={t("integrations.google.desc")}
                  Logo={GoogleContactsLogo}
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

                <AvailableIntegrationCard
                  testIdPrefix="gmail"
                  title={t("integrations.gmail.title")}
                  desc={t("integrations.gmail.desc")}
                  Logo={GmailLogo}
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
                      await syncGmail();
                      // Refetch status so counters match DB (linked/ignored/total), not sync deltas.
                      await reload();
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
                      await syncGmail();
                      await reload();
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

                <PhoneIntegrationCard
                  Logo={PhoneLogo}
                  status={phoneStatus}
                  preview={phonePreview}
                  confirmImport={confirmPhone}
                  busy={busyKey === "phone"}
                  t={t}
                  lang={lang}
                  onConnect={() =>
                    runBusy("phone", async () => {
                      try {
                        await startPhoneConnect();
                        await reload();
                        toast.success(t("integrations.phone.connectedToast"));
                      } catch (err) {
                        toast.error(err.message || t("integrations.phone.connectError"));
                      }
                    })
                  }
                  onPreviewImport={() =>
                    runBusy("phone", async () => {
                      const data = await previewPhone();
                      setPhonePreview(data);
                      setConfirmPhone(true);
                    })
                  }
                  onConfirmImport={() =>
                    runBusy("phone", async () => {
                      await syncPhone();
                      await reload();
                      setConfirmPhone(false);
                      setPhonePreview(null);
                      toast.success(t("integrations.phone.syncDone"));
                    })
                  }
                  onCancelImport={() => {
                    setConfirmPhone(false);
                    setPhonePreview(null);
                  }}
                  onSync={() =>
                    runBusy("phone", async () => {
                      await syncPhone();
                      await reload();
                      toast.success(t("integrations.phone.syncDone"));
                    })
                  }
                  onDisconnect={() =>
                    runBusy("phone", async () => {
                      if (!window.confirm(t("integrations.phone.disconnectConfirm"))) return;
                      await disconnectPhone();
                      setPhoneStatus((prev) => ({
                        ...prev,
                        connected: false,
                        account: null,
                        lastSync: null,
                        lastCall: null,
                        syncing: false,
                      }));
                      setPhonePreview(null);
                      setConfirmPhone(false);
                      toast.success(t("integrations.phone.disconnectedToast"));
                    })
                  }
                />
              </div>
            </section>

            <section data-testid="integrations-section-coming-soon">
              <h2 className="font-cabinet text-sm font-semibold uppercase tracking-wider text-dash-text-subtle mb-5">
                {t("integrations.sections.comingSoon")}
              </h2>
              <div className={integrationsGrid}>
                {COMING_SOON_INTEGRATIONS.map((item) => (
                  <ComingSoonIntegrationCard
                    key={item.id}
                    id={item.id}
                    Logo={item.Logo}
                    name={t(item.nameKey)}
                    desc={t(item.descKey)}
                    t={t}
                  />
                ))}
              </div>
            </section>

            <IntegrationsBenefits t={t} />
          </div>
        )}
      </SettingsShell>
    </div>
  );
}
