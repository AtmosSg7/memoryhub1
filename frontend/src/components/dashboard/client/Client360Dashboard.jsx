import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  FolderClosed,
  Link2,
  Mail,
  MailOpen,
  MessageSquare,
  StickyNote,
  TrendingUp,
} from "lucide-react";
import { getClient360 } from "@/lib/clientsApi";
import StatCard from "@/components/dashboard/StatCard";
import SectionPanel from "@/components/dashboard/client/SectionPanel";
import { PageLoader } from "@/components/dashboard/PageFeedback";
import { formatInvoiceAmount } from "@/utils/invoiceDisplay";
import { getEventPresentation } from "@/utils/eventDisplay";
import { ClientSectionLink } from "@/components/dashboard/client/clientDetailLayout";

function formatDate(value, lang) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function IntegrationPill({ connected, label, email, lastSync, lang, t }) {
  return (
    <div
      className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5"
      data-testid={`client360-integration-${label}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#111827]">{label}</p>
        <span
          className={[
            "text-[11px] rounded-md px-1.5 py-0.5 font-medium",
            connected ? "bg-emerald-50 text-emerald-800" : "bg-[#F3F4F6] text-[#6B7280]",
          ].join(" ")}
        >
          {connected
            ? t("integrations.shared.statusConnected")
            : t("integrations.shared.statusDisconnected")}
        </span>
      </div>
      {email ? <p className="text-xs text-[#6B7280] mt-1 truncate">{email}</p> : null}
      {lastSync ? (
        <p className="text-[11px] text-[#9CA3AF] mt-1">
          {t("integrations.shared.lastSync")}: {formatDate(lastSync, lang)}
        </p>
      ) : null}
    </div>
  );
}

export default function Client360Dashboard({
  clientId,
  client,
  commercialStats,
  lang,
  t,
  onOpenSection,
  initialData = null,
}) {
  const navigate = useNavigate();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      setError(null);
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getClient360(clientId);
        if (mounted) setData(payload);
      } catch (err) {
        if (mounted) setError(err.message || t("client360.loadError"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [clientId, t, initialData]);

  if (loading) return <PageLoader />;
  if (error) {
    return (
      <p className="text-sm text-[#991B1B]" data-testid="client360-error">
        {error}
      </p>
    );
  }
  if (!data) return null;

  const stats = data.stats || {};
  const integrations = data.integrations || {};

  const exchangeCards = [
    {
      key: "exchanges",
      label: t("client360.exchanges"),
      value: stats.exchangesTotal ?? 0,
      icon: MessageSquare,
    },
    {
      key: "received",
      label: t("client360.emailsReceived"),
      value: stats.emailsReceived ?? 0,
      icon: MailOpen,
    },
    {
      key: "sent",
      label: t("client360.emailsSent"),
      value: stats.emailsSent ?? 0,
      icon: Mail,
    },
    {
      key: "revenue",
      label: t("clientDetail.revenue"),
      value: formatInvoiceAmount(commercialStats?.revenue ?? stats.totalRevenue ?? 0, lang),
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-4" data-testid="client360-dashboard">
      {/* Statistics */}
      <SectionPanel title={t("client360.stats")} testId="client360-stats">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {exchangeCards.map((card) => (
            <StatCard
              key={card.key}
              label={card.label}
              value={card.value}
              icon={card.icon}
              secondary
              testId={`client360-stat-${card.key}`}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs text-[#6B7280]">
          <p>
            {t("nav.notes")}: <span className="font-semibold text-[#111827]">{stats.notesCount ?? 0}</span>
          </p>
          <p>
            {t("nav.files")}:{" "}
            <span className="font-semibold text-[#111827]">{stats.documentsCount ?? 0}</span>
          </p>
          <p>
            {t("nav.quotes")}:{" "}
            <span className="font-semibold text-[#111827]">{stats.quotesCount ?? 0}</span>
          </p>
          <p>
            {t("nav.invoices")}:{" "}
            <span className="font-semibold text-[#111827]">{stats.invoicesCount ?? 0}</span>
          </p>
        </div>
        {stats.lastActivityAt ? (
          <p className="text-xs text-[#9CA3AF] mt-3">
            {t("client360.lastActivity")}: {formatDate(stats.lastActivityAt, lang)}
          </p>
        ) : null}
      </SectionPanel>

      {/* Informations (compact identity) */}
      <SectionPanel title={t("client360.info")} testId="client360-info">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-[#9CA3AF]">{t("clientDetail.company")}</dt>
            <dd className="font-medium text-[#111827]">
              {client?.company || client?.name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#9CA3AF]">{t("clientDetail.contact")}</dt>
            <dd className="font-medium text-[#111827]">
              {client?.contactName || client?.name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#9CA3AF]">{t("clientContacts.emails")}</dt>
            <dd className="font-medium text-[#111827] truncate">{client?.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#9CA3AF]">{t("clientContacts.phones")}</dt>
            <dd className="font-medium text-[#111827]">{client?.phone || "—"}</dd>
          </div>
        </dl>
        <ClientSectionLink onClick={() => onOpenSection("contacts")}>
          {t("client360.seeContacts")}
        </ClientSectionLink>
      </SectionPanel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Communications */}
        <SectionPanel title={t("client360.communications")} testId="client360-comms">
          {(data.recentCommunications || []).length === 0 ? (
            <p className="text-sm text-[#6B7280]">{t("client360.noComms")}</p>
          ) : (
            <ul className="space-y-2">
              {data.recentCommunications.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2"
                  data-testid={`client360-comm-${item.id}`}
                >
                  <p className="text-sm font-medium text-[#111827] truncate">
                    {item.subject || t("clientEmails.noSubject")}
                  </p>
                  <p className="text-xs text-[#6B7280] truncate">{item.preview || "—"}</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-1">
                    {formatDate(item.createdAt, lang)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <ClientSectionLink onClick={() => onOpenSection("emails")}>
            {t("client360.seeEmails")}
          </ClientSectionLink>
        </SectionPanel>

        {/* Documents */}
        <SectionPanel title={t("client360.documents")} testId="client360-docs">
          {(data.recentDocuments || []).length === 0 ? (
            <p className="text-sm text-[#6B7280]">{t("client360.noDocs")}</p>
          ) : (
            <ul className="space-y-2">
              {data.recentDocuments.slice(0, 5).map((doc) => (
                <li
                  key={`${doc.kind}-${doc.id}`}
                  className="flex items-center gap-2 text-sm"
                  data-testid={`client360-doc-${doc.id}`}
                >
                  {doc.kind === "file" ? (
                    <FolderClosed className="w-3.5 h-3.5 text-[#6B7280]" />
                  ) : doc.kind === "note" ? (
                    <StickyNote className="w-3.5 h-3.5 text-[#6B7280]" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-[#6B7280]" />
                  )}
                  <span className="truncate font-medium text-[#111827]">
                    {doc.number ? `${doc.number} — ` : ""}
                    {doc.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ClientSectionLink onClick={() => onOpenSection("documents")}>
            {t("client360.seeDocuments")}
          </ClientSectionLink>
        </SectionPanel>
      </div>

      {/* Activity */}
      <SectionPanel title={t("client360.activity")} testId="client360-activity">
        {(data.recentEvents || []).length === 0 ? (
          <p className="text-sm text-[#6B7280]">{t("client360.noActivity")}</p>
        ) : (
          <ul className="space-y-2">
            {data.recentEvents.slice(0, 6).map((event) => {
              const presentation = getEventPresentation(event, lang);
              return (
                <li key={event.id} className="text-sm flex items-start justify-between gap-3">
                  <span className="text-[#111827]">
                    {t(presentation.labelKey) || event.type}
                    {event.metadata?.subject || event.metadata?.excerpt ? (
                      <span className="text-[#6B7280]">
                        {" "}
                        — {event.metadata.subject || event.metadata.excerpt}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[11px] text-[#9CA3AF] whitespace-nowrap">
                    {formatDate(event.createdAt, lang)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <ClientSectionLink onClick={() => onOpenSection("timeline")}>
          {t("clientDetail.seeAllTimeline")}
        </ClientSectionLink>
      </SectionPanel>

      {/* Integrations */}
      <SectionPanel
        title={t("client360.integrations")}
        subtitle={
          stats.lastGoogleSyncAt
            ? `${t("client360.lastGoogleSync")}: ${formatDate(stats.lastGoogleSyncAt, lang)}`
            : undefined
        }
        testId="client360-integrations"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <IntegrationPill
            connected={Boolean(integrations.googleContacts?.connected)}
            label={t("integrations.google.title")}
            email={integrations.googleContacts?.accountEmail}
            lastSync={integrations.googleContacts?.lastSyncedAt}
            lang={lang}
            t={t}
          />
          <IntegrationPill
            connected={Boolean(integrations.gmail?.connected)}
            label={t("integrations.gmail.title")}
            email={integrations.gmail?.accountEmail}
            lastSync={integrations.gmail?.lastSyncedAt}
            lang={lang}
            t={t}
          />
        </div>
        <ClientSectionLink onClick={() => navigate("/dashboard/integrations")}>
          <span className="inline-flex items-center gap-1">
            <Link2 className="w-3.5 h-3.5" />
            {t("client360.manageIntegrations")}
          </span>
        </ClientSectionLink>
      </SectionPanel>
    </div>
  );
}
