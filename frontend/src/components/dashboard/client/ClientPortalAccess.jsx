import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  disableClientPortal,
  enableClientPortal,
  getClientPortal,
  resolvePortalUrl,
} from "@/lib/portalApi";

export default function ClientPortalAccess({ clientId, t }) {
  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getClientPortal(clientId);
      setPortal(data);
    } catch {
      setPortal(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

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
      toast.error(err.message || t("clientPortal.error"));
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
      toast.error(err.message || t("clientPortal.error"));
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

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E7E9EE] bg-white px-4 py-3 text-sm text-[#6B7280] flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("clientPortal.loading")}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E7E9EE] bg-white p-4 md:p-5" data-testid="client-portal-access">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center shrink-0">
          <Link2 className="w-5 h-5 text-[#0A2540]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-cabinet text-sm font-bold text-[#111827]">{t("clientPortal.title")}</h3>
          <p className="text-xs text-[#6B7280] mt-1">{t("clientPortal.description")}</p>
        </div>
      </div>

      {portal ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-[#E7E9EE] bg-[#FAFAFA] px-3 py-2 text-xs text-[#374151] break-all">
            {portalUrl}
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="primary" onClick={copyLink} className="gap-1.5 h-9 text-sm">
              <Copy className="w-3.5 h-3.5" />
              {t("clientPortal.copy")}
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={() => window.open(portalUrl, "_blank", "noopener,noreferrer")}
              className="gap-1.5 h-9 text-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t("clientPortal.open")}
            </ActionButton>
            <ActionButton variant="ghost" onClick={handleDisable} disabled={busy} className="h-9 text-sm text-[#991B1B]">
              {t("clientPortal.disable")}
            </ActionButton>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <ActionButton variant="primary" onClick={handleEnable} disabled={busy} className="gap-1.5 h-9 text-sm">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            {t("clientPortal.enable")}
          </ActionButton>
        </div>
      )}
    </div>
  );
}
