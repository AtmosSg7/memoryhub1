import { useEffect, useState } from "react";
import {
  Building2,
  ExternalLink,
  Mail,
  MailOpen,
  MessageSquare,
} from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { getProspect } from "@/lib/prospectsApi";
import { toastApiError } from "@/utils/apiErrors";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { InlineLoader, PageError } from "@/components/dashboard/PageFeedback";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  formatProspectDate,
  prospectDisplayName,
} from "@/components/prospects/prospectFormat";
import CommunicationIntelligenceCard from "@/components/communications/CommunicationIntelligenceCard";

function CommRow({ comm, lang, t }) {
  const inbound = comm.direction !== "outbound";
  const Icon = inbound ? MailOpen : Mail;
  return (
    <li
      className="rounded-lg border border-dash-border-soft bg-dash-surface-muted/40 px-3 py-2.5 space-y-1"
      data-testid={`prospect-comm-${comm.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-dash-text-muted">
              <Icon className="w-3 h-3" />
              {inbound ? t("prospects.inbound") : t("prospects.outbound")}
            </span>
          </div>
          <p className="text-sm font-medium text-dash-text truncate">
            {comm.subject || t("clientEmails.noSubject")}
          </p>
          {comm.preview ? (
            <p className="text-xs text-dash-text-muted line-clamp-3 mt-0.5">{comm.preview}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right space-y-1">
          <p className="text-[11px] text-dash-text-subtle tabular-nums whitespace-nowrap">
            {formatProspectDate(comm.createdAt, lang)}
          </p>
          {comm.externalUrl ? (
            <a
              href={comm.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-dash-accent hover:underline"
              data-testid={`prospect-comm-gmail-${comm.id}`}
            >
              <ExternalLink className="w-3 h-3" />
              {t("prospects.openGmail")}
            </a>
          ) : null}
        </div>
      </div>
      {inbound ? (
        <CommunicationIntelligenceCard
          communicationId={comm.id}
          compact
          testId={`prospect-intelligence-${comm.id}`}
        />
      ) : null}
    </li>
  );
}

export default function ProspectDetailDrawer({
  open,
  prospectId,
  onClose,
  onAssociate,
  onCreateClient,
  onIgnore,
  onRestore,
  busy = false,
}) {
  const { t, lang } = useDashboardLang();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!open || !prospectId) {
      setDetail(null);
      setError(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProspect(prospectId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load prospect.");
          toastApiError(err, t, "prospects.actionError");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, prospectId, t]);

  const prospect = detail?.prospect;
  const communications = detail?.communications || [];
  const name = prospect ? prospectDisplayName(prospect) : "";
  const isIgnored = prospect?.status === "ignored";
  const isTreated =
    prospect?.status === "associated" || prospect?.status === "converted";

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        className="!w-full !max-w-none sm:!max-w-lg p-0 flex flex-col gap-0 h-[100dvh] sm:h-full"
        data-testid="prospect-detail-drawer"
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-dash-border-soft text-left space-y-1">
          <SheetTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-dash-text pr-8">
            {loading ? t("prospects.loadingDetail") : name || t("prospects.detailTitle")}
          </SheetTitle>
          <SheetDescription className="text-dash-text-muted text-sm">
            {prospect?.email || t("prospects.detailSubtitle")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading ? (
            <InlineLoader label={t("prospects.loadingDetail")} className="py-10" />
          ) : null}
          {error ? <PageError message={error} testId="prospect-detail-error" /> : null}

          {prospect && !loading ? (
            <>
              <section className="space-y-2" data-testid="prospect-identity">
                {prospect.company ? (
                  <p className="text-sm text-dash-text-muted inline-flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {prospect.company}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-md bg-dash-surface-muted px-1.5 py-0.5 text-dash-text-muted">
                    {t(`prospects.status.${prospect.status}`)}
                  </span>
                  <span className="rounded-md bg-dash-surface-muted px-1.5 py-0.5 text-dash-text-muted inline-flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {t("prospects.exchanges").replace(
                      "{count}",
                      String(prospect.communicationsCount ?? 0)
                    ).replace("{plural}", "")}
                  </span>
                  {prospect.source === "gmail" || prospect.source === "email" ? (
                    <span className="rounded-md bg-dash-surface-muted px-1.5 py-0.5 text-dash-text-muted">
                      {t("prospects.sourceGmail")}
                    </span>
                  ) : null}
                  {prospect.noiseClass ? (
                    <span className="rounded-md bg-dash-surface-muted px-1.5 py-0.5 text-dash-text-muted">
                      {t(`prospects.noise.${prospect.noiseClass}`) !==
                      `prospects.noise.${prospect.noiseClass}`
                        ? t(`prospects.noise.${prospect.noiseClass}`)
                        : t("prospects.noise.generic")}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-dash-text-subtle">
                  {t("prospects.firstContact")}: {formatProspectDate(prospect.firstContactAt, lang)}
                  {" · "}
                  {t("prospects.lastContact")}: {formatProspectDate(prospect.lastContactAt, lang)}
                </p>
                {isTreated && prospect.clientId ? (
                  <a
                    href={`/dashboard/clients/${prospect.clientId}`}
                    className="inline-flex text-sm font-medium text-dash-accent hover:underline"
                    data-testid="prospect-linked-client"
                  >
                    {t("prospects.viewClient")}
                  </a>
                ) : null}
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-dash-text-subtle">
                  {t("prospects.history")}
                </h4>
                {communications.length === 0 ? (
                  <p className="text-sm text-dash-text-muted">{t("prospects.historyEmpty")}</p>
                ) : (
                  <ul className="space-y-2">
                    {communications.map((comm) => (
                      <CommRow key={comm.id} comm={comm} lang={lang} t={t} />
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>

        {prospect && !loading ? (
          <div className="border-t border-dash-border-soft px-4 py-3 flex flex-col gap-2 safe-area-pb">
            {!isTreated && !isIgnored ? (
              <>
                <ActionButton
                  variant="primary"
                  className="h-11 w-full text-sm"
                  disabled={busy}
                  onClick={() => onAssociate?.(prospect)}
                  data-testid="prospect-detail-associate"
                >
                  {t("prospects.associate")}
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  className="h-11 w-full text-sm"
                  disabled={busy}
                  onClick={() => onCreateClient?.(prospect)}
                  data-testid="prospect-detail-create"
                >
                  {t("prospects.createClient")}
                </ActionButton>
                <ActionButton
                  variant="ghost"
                  className="h-10 w-full text-sm"
                  disabled={busy}
                  onClick={() => onIgnore?.(prospect)}
                  data-testid="prospect-detail-ignore"
                >
                  {t("prospects.ignore")}
                </ActionButton>
              </>
            ) : null}
            {isIgnored ? (
              <ActionButton
                variant="quick"
                className="h-11 w-full text-sm"
                disabled={busy}
                onClick={() => onRestore?.(prospect)}
                data-testid="prospect-detail-restore"
              >
                {t("prospects.restore")}
              </ActionButton>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
