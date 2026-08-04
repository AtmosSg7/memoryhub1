import { useEffect, useState } from "react";
import { ExternalLink, Mail, Paperclip } from "lucide-react";
import { fetchClientEmails } from "@/lib/integrationsApi";
import { PageLoader } from "@/components/dashboard/PageFeedback";

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

export default function ClientEmailsSection({ clientId, t, lang }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchClientEmails(clientId);
        if (!mounted) return;
        setItems(data.items || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (mounted) setError(err.message || t("clientEmails.loadError"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [clientId, t]);

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <p className="text-sm text-[#991B1B]" data-testid="client-emails-error">
        {error}
      </p>
    );
  }

  if (!items.length) {
    return (
      <p className="text-sm text-dash-text-muted" data-testid="client-emails-empty">
        {t("clientEmails.empty")}
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="client-emails-list">
      <p className="text-xs text-dash-text-subtle">
        {t("clientEmails.count").replace("{count}", String(total))}
      </p>
      <ul className="space-y-2">
        {items.map((item) => {
          const counterpart =
            item.direction === "outbound"
              ? (item.toEmails || []).join(", ") || item.toEmail
              : item.fromName
                ? `${item.fromName} <${item.fromEmail || ""}>`
                : item.fromEmail;
          return (
            <li
              key={item.id}
              className="rounded-xl border border-dash-border bg-dash-surface px-3 py-3"
              data-testid={`client-email-${item.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-dash-text-muted shrink-0" />
                    <span className="text-sm font-medium text-dash-text truncate">
                      {item.subject || t("clientEmails.noSubject")}
                    </span>
                    <span className="text-[11px] rounded-md bg-dash-surface-muted px-1.5 py-0.5 text-dash-text-muted">
                      {item.direction === "outbound"
                        ? t("clientEmails.sent")
                        : t("clientEmails.received")}
                    </span>
                  </div>
                  <p className="text-xs text-dash-text-muted truncate">
                    {item.direction === "outbound"
                      ? `${t("clientEmails.to")}: ${counterpart || "—"}`
                      : `${t("clientEmails.from")}: ${counterpart || "—"}`}
                  </p>
                  {item.preview ? (
                    <p className="text-sm text-dash-text-muted line-clamp-2">{item.preview}</p>
                  ) : null}
                  {(item.attachmentCount || 0) > 0 ? (
                    <p className="text-xs text-dash-text-muted inline-flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />
                      {t("clientEmails.attachments").replace(
                        "{count}",
                        String(item.attachmentCount),
                      )}
                      {item.attachments?.length
                        ? ` — ${item.attachments
                            .map((a) => a.filename)
                            .filter(Boolean)
                            .slice(0, 3)
                            .join(", ")}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right space-y-2">
                  <p className="text-xs text-dash-text-subtle whitespace-nowrap">
                    {formatDate(item.sentAt, lang)}
                  </p>
                  {item.gmailUrl ? (
                    <a
                      href={item.gmailUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-dash-primary hover:underline"
                      data-testid={`client-email-open-${item.id}`}
                    >
                      <ExternalLink className="w-3 h-3" />
                      {t("clientEmails.openInGmail")}
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
