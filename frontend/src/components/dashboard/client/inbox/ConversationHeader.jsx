import { memo } from "react";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Phone,
  Receipt,
  Reply,
  StickyNote,
} from "lucide-react";
import { ActionButton } from "@/components/dashboard/ActionButton";
import ConversationAvatar from "./ConversationAvatar";
import ConversationBadges from "./ConversationBadges";

function ConversationHeader({
  conversation,
  client,
  t,
  onBack,
  onReply,
  onCreateQuote,
  onCreateInvoice,
  onCreateNote,
  showBack = false,
}) {
  const participant = conversation?._participant || {};
  const name =
    participant.name || conversation?.clientName || client?.name || t("clientInbox.noSubject");
  const email = participant.email;
  const company = client?.company || client?.companyName || conversation?.clientName;

  return (
    <header
      className="border-b border-dash-border-soft pb-3 mb-3 safe-area-pt"
      data-testid="conversation-header"
    >
      <div className="flex items-start gap-3">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-lg text-dash-text-muted hover:bg-dash-bg shrink-0"
            data-testid="client-inbox-back"
            aria-label={t("clientInbox.back")}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : null}
        <ConversationAvatar name={name} email={email} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-dash-text truncate">{name}</h3>
          {email ? (
            <p className="text-xs text-dash-text-subtle truncate">{email}</p>
          ) : null}
          {company ? (
            <p className="text-xs text-dash-text-muted truncate mt-0.5">{company}</p>
          ) : null}
          <p className="text-xs text-dash-text-subtle mt-1 line-clamp-1">
            {conversation?.subject || t("clientInbox.noSubject")}
          </p>
          <ConversationBadges
            t={t}
            unreadCount={conversation?.unreadCount || 0}
            priority={conversation?.priority}
            hasAction={conversation?._hasAction}
            hasIntel={conversation?._hasIntel}
            isClient={conversation?._isClient}
            isProspect={conversation?._isProspect}
            lifecycleStatus={conversation?.lifecycleStatus}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <ActionButton
          variant="primary"
          className="min-h-11"
          onClick={onReply}
          disabled={!conversation?.externalUrl}
          data-testid="client-inbox-reply"
        >
          <Reply className="w-3.5 h-3.5 mr-1" />
          {t("clientInbox.actions.reply")}
        </ActionButton>
        {conversation?.externalUrl ? (
          <ActionButton
            variant="secondary"
            className="min-h-11"
            onClick={() => window.open(conversation.externalUrl, "_blank", "noopener,noreferrer")}
            data-testid="client-inbox-open-external"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1" />
            {t("clientInbox.openGmail")}
          </ActionButton>
        ) : null}
        <ActionButton
          variant="secondary"
          className="min-h-11"
          onClick={onCreateQuote}
          data-testid="client-inbox-create-quote"
        >
          <FileText className="w-3.5 h-3.5 mr-1" />
          {t("clientInbox.actions.createQuote")}
        </ActionButton>
        <ActionButton
          variant="secondary"
          className="min-h-11"
          onClick={onCreateInvoice}
          data-testid="client-inbox-create-invoice"
        >
          <Receipt className="w-3.5 h-3.5 mr-1" />
          {t("clientInbox.actions.createInvoice")}
        </ActionButton>
        <ActionButton
          variant="ghost"
          className="min-h-11"
          onClick={onCreateNote}
          data-testid="client-inbox-create-note"
        >
          <StickyNote className="w-3.5 h-3.5 mr-1" />
          {t("clientInbox.actions.createNote")}
        </ActionButton>
        <ActionButton
          variant="ghost"
          className="min-h-11 opacity-60 cursor-not-allowed"
          disabled
          title={t("clientInbox.actions.callSoon")}
          data-testid="client-inbox-call"
        >
          <Phone className="w-3.5 h-3.5 mr-1" />
          {t("clientInbox.actions.call")}
        </ActionButton>
      </div>
    </header>
  );
}

export default memo(ConversationHeader);
