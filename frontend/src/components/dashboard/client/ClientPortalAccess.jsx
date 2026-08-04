import { Copy, ExternalLink, Link2, Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { InlineLoader, PageError } from "@/components/dashboard/PageFeedback";
import {
  disableClientPortal,
  enableClientPortal,
  getClientPortal,
  resolvePortalUrl,
  shareClientPortalEmail,
} from "@/lib/portalApi";
import { useCallback, useEffect, useState } from "react";

export default function ClientPortalAccess({ clientId, t, embedded = false }) {
  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getClientPortal(clientId);
      setPortal(data);
    } catch (err) {
      setPortal(null);
      setLoadError(err.message || t("errors.loadClient"));
    } finally {
      setLoading(false);
    }
  }, [clientId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const data = await enableClientPortal(clientId);
      setPortal(data);
      toast.success(t("clientPortal.enabled"));
    } catch (err) {
      toastApiError(err, t, "clientPortal.error");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await disableClientPortal(clientId);
      setPortal(null);
      toast.success(t("clientPortal.disabled"));
    } catch (err) {
      toastApiError(err, t, "clientPortal.error");
    } finally {
      setBusy(false);
    }
  };

  const portalUrl = resolvePortalUrl(portal?.portalUrl);

  const copyLink = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      toast.success(t("clientPortal.copied"));
    } catch {
      toast.error(t("clientPortal.copyError"));
    }
  };

  const shareEmail = async () => {
    setBusy(true);
    try {
      const data = await shareClientPortalEmail(clientId);
      const status = data.emailStatus;
      if (status === "sent") toast.success(t("clientPortal.emailSent"));
      else if (status === "skipped") toast.message(t("clientPortal.emailSkipped"));
      else if (status === "retrying" || status === "pending") toast.message(t("clientPortal.sharingEmail"));
      else toast.error(t("clientPortal.emailFailed"));
    } catch (err) {
      toastApiError(err, t, "clientPortal.error");
    } finally {
      setBusy(false);
    }
  };

  const shellClass = embedded ? "" : "rounded-xl border border-dash-border bg-dash-surface p-4 md:p-5";

  if (loading) {
    return (
      <div className={shellClass} data-testid="client-portal-access">
        <InlineLoader label={t("clientPortal.loading")} className="py-6 justify-start" testId="client-portal-loading" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`${shellClass} space-y-3`} data-testid="client-portal-access">
        <PageError message={loadError} testId="client-portal-load-error" />
        <ActionButton variant="quick" onClick={load} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          {t("common.retry")}
        </ActionButton>
      </div>
    );
  }

  return (
    <div className={shellClass} data-testid="client-portal-access">
      {!embedded ? (
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-dash-accent-soft flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5 text-dash-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-cabinet text-lg font-bold text-dash-text tracking-tight">{t("clientPortal.title")}</h3>
            <p className="text-xs text-dash-text-muted mt-0.5">{t("clientPortal.description")}</p>
          </div>
        </div>
      ) : null}

      {portal ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-dash-border bg-dash-surface-muted px-3 py-2 text-xs text-dash-text-muted break-all" data-testid="client-portal-url">
            {portalUrl}
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="primary" onClick={copyLink} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" />
              {t("clientPortal.copy")}
            </ActionButton>
            <ActionButton variant="quick" onClick={shareEmail} disabled={busy} className="gap-1.5" data-testid="client-portal-share-email">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              {t("clientPortal.shareEmail")}
            </ActionButton>
            <ActionButton
              variant="quick"
              onClick={() => window.open(portalUrl, "_blank", "noopener,noreferrer")}
              className="gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t("clientPortal.open")}
            </ActionButton>
            <ActionButton variant="dangerText" onClick={handleDisable} disabled={busy}>
              {t("clientPortal.disable")}
            </ActionButton>
          </div>
        </div>
      ) : (
        <ActionButton variant="primary" onClick={handleEnable} disabled={busy} className="gap-1.5" data-testid="client-portal-enable">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
          {t("clientPortal.enable")}
        </ActionButton>
      )}
    </div>
  );
}
