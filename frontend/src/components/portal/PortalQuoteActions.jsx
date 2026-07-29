import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { ActionButton } from "@/components/dashboard/ActionButton";
import PortalQuoteDecisionModal from "@/components/portal/PortalQuoteDecisionModal";

export default function PortalQuoteActions({
  token,
  quote,
  lang,
  t,
  onUpdated,
  canReject = true,
  className = "",
  layout = "row",
}) {
  const [decision, setDecision] = useState(null);

  if (!quote?.canAccept && !quote?.canReject) return null;

  const showAccept = quote.canAccept;
  const showReject = quote.canReject && canReject;

  const layoutClass =
    layout === "stack"
      ? "flex flex-col gap-2 w-full"
      : "flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2";

  return (
    <>
      <div className={`${layoutClass} ${className}`}>
        {showAccept ? (
          <ActionButton
            variant="success"
            onClick={() => setDecision("accept")}
            className="gap-1.5 h-9 text-sm w-full sm:w-auto"
            data-testid={`portal-accept-quote-${quote.id}`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {t("portal.acceptQuote")}
          </ActionButton>
        ) : null}
        {showReject ? (
          <ActionButton
            variant="secondary"
            onClick={() => setDecision("reject")}
            className="gap-1.5 h-9 text-sm w-full sm:w-auto border-[#FECACA] text-[#991B1B] hover:bg-[#FEF2F2]"
            data-testid={`portal-reject-quote-${quote.id}`}
          >
            <XCircle className="w-4 h-4" />
            {t("portal.rejectQuote")}
          </ActionButton>
        ) : null}
      </div>

      <PortalQuoteDecisionModal
        open={Boolean(decision)}
        onOpenChange={(open) => !open && setDecision(null)}
        action={decision}
        token={token}
        quote={quote}
        lang={lang}
        t={t}
        onCompleted={(updated) => {
          onUpdated?.(updated);
          setDecision(null);
        }}
      />
    </>
  );
}
