import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ExternalLink,
  Mail,
  MessageCircle,
  Paperclip,
  Phone,
  Reply,
} from "lucide-react";
import {
  fetchClientInbox,
  fetchHubConversation,
  migrateHub,
  updateCommunicationLifecycle,
} from "@/lib/hubApi";
import { PageLoader } from "@/components/dashboard/PageFeedback";
import { ActionButton } from "@/components/dashboard/ActionButton";

const CHANNEL_ICON = {
  email: Mail,
  phone: Phone,
  whatsapp: MessageCircle,
  sms: MessageCircle,
};

const PAGE_SIZE = 30;
const MIGRATE_FLAG = "basera_hub_migrated_v2";

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

function channelLabel(channel, t) {
  const key = `clientInbox.channels.${channel}`;
  const label = t(key);
  return label === key ? channel : label;
}

function lifecycleLabel(status, t) {
  const key = `clientInbox.lifecycle.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

function participantsLabel(participants) {
  const list = Array.isArray(participants) ? participants : [];
  const names = list
    .map((p) => p.displayName || p.email || p.phone)
    .filter(Boolean)
    .slice(0, 3);
  if (!names.length) return "";
  return names.join(", ");
}

function authorLabel(msg) {
  const from = (msg.participants || []).find((p) => p.role === "from");
  if (from?.displayName || from?.email) return from.displayName || from.email;
  const meta = msg.metadata || {};
  return meta.fromName || meta.fromEmail || "—";
}

function primaryAction(conv) {
  const actions = conv?.availableActions || [];
  if (actions.includes("reply")) return "reply";
  if (actions.includes("mark_read")) return "mark_read";
  if (conv?.externalUrl) return "open_gmail";
  if (actions.includes("archive")) return "archive";
  return null;
}

export default function ClientInboxSection({
  clientId,
  t,
  lang,
  initialConversationId = null,
}) {
  const [inbox, setInbox] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(initialConversationId);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [offset, setOffset] = useState(0);

  const load = async ({ reset = true, nextOffset = 0, silent = false } = {}) => {
    if (reset && !silent) {
      setLoading(true);
      setError(null);
    } else if (!reset) {
      setLoadingMore(true);
    }
    try {
      try {
        if (!sessionStorage.getItem(MIGRATE_FLAG)) {
          await migrateHub(500);
          sessionStorage.setItem(MIGRATE_FLAG, "1");
        }
      } catch {
        /* non-blocking */
      }
      const data = await fetchClientInbox(clientId, {
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      if (reset) {
        setInbox(data);
        setOffset(data.channels?.flatMap((c) => c.conversations || []).length || 0);
      } else {
        setInbox((prev) => {
          if (!prev) return data;
          const mergedMap = new Map();
          for (const group of prev.channels || []) {
            for (const conv of group.conversations || []) mergedMap.set(conv.id, conv);
          }
          for (const group of data.channels || []) {
            for (const conv of group.conversations || []) mergedMap.set(conv.id, conv);
          }
          const all = Array.from(mergedMap.values()).sort((a, b) =>
            String(b.lastMessageAt || "").localeCompare(String(a.lastMessageAt || "")),
          );
          const byChannel = {};
          for (const conv of all) {
            const ch = conv.channel || "email";
            if (!byChannel[ch]) byChannel[ch] = [];
            byChannel[ch].push(conv);
          }
          return {
            ...data,
            channels: Object.entries(byChannel).map(([channel, conversations]) => ({
              channel,
              conversations,
              total: conversations.length,
            })),
            totalConversations: data.totalConversations,
            hasMore: data.hasMore,
          };
        });
        setOffset(nextOffset + PAGE_SIZE);
      }
    } catch (err) {
      setError(err.message || t("clientInbox.loadError"));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await load({ reset: true, nextOffset: 0 });
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    if (initialConversationId) setActiveConversationId(initialConversationId);
  }, [initialConversationId]);

  useEffect(() => {
    if (!activeConversationId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    let mounted = true;
    (async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const data = await fetchHubConversation(activeConversationId, { markRead: true });
        if (mounted) {
          setDetail(data);
          // Refresh list badges after mark-read without full-page loader flash
          load({ reset: true, nextOffset: 0, silent: true });
        }
      } catch (err) {
        if (mounted) setDetailError(err.message || t("clientInbox.loadError"));
      } finally {
        if (mounted) setDetailLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, t]);

  const flatConversations = useMemo(() => {
    const list = [];
    for (const group of inbox?.channels || []) {
      for (const conv of group.conversations || []) list.push(conv);
    }
    return list.sort((a, b) =>
      String(b.lastMessageAt || "").localeCompare(String(a.lastMessageAt || "")),
    );
  }, [inbox]);

  const runLifecycle = async (communicationId, lifecycleStatus) => {
    try {
      await updateCommunicationLifecycle(communicationId, lifecycleStatus);
      if (activeConversationId) {
        const data = await fetchHubConversation(activeConversationId, { markRead: false });
        setDetail(data);
      }
      await load({ reset: true, nextOffset: 0 });
    } catch (err) {
      setDetailError(err.message || t("clientInbox.loadError"));
    }
  };

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <p className="text-sm text-[#991B1B]" data-testid="client-inbox-error">
        {error}
      </p>
    );
  }

  if (!flatConversations.length) {
    return (
      <p className="text-sm text-dash-text-muted" data-testid="client-inbox-empty">
        {t("clientInbox.empty")}
      </p>
    );
  }

  const threadPanel = (
    <div
      className="rounded-xl border border-dash-border bg-dash-surface p-4 min-h-[240px] flex flex-col"
      data-testid="client-inbox-thread"
    >
      {!activeConversationId ? (
        <p className="text-sm text-dash-text-muted">{t("clientInbox.selectConversation")}</p>
      ) : detailLoading ? (
        <PageLoader />
      ) : detailError ? (
        <p className="text-sm text-[#991B1B]">{detailError}</p>
      ) : detail ? (
        <>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <button
                type="button"
                className="lg:hidden inline-flex items-center gap-1 text-xs text-dash-text-muted mb-2 min-h-11"
                onClick={() => setActiveConversationId(null)}
                data-testid="client-inbox-back"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("clientInbox.back")}
              </button>
              <h3 className="text-sm font-semibold text-dash-text truncate">
                {detail.conversation.subject || t("clientInbox.noSubject")}
              </h3>
              <p className="text-xs text-dash-text-subtle mt-0.5">
                {channelLabel(detail.conversation.channel, t)} ·{" "}
                {lifecycleLabel(detail.conversation.lifecycleStatus, t)}
                {detail.conversation.clientName
                  ? ` · ${detail.conversation.clientName}`
                  : ""}
              </p>
              {participantsLabel(detail.conversation.participants) ? (
                <p className="text-xs text-dash-text-muted mt-1 truncate">
                  {participantsLabel(detail.conversation.participants)}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {detail.conversation.externalUrl ? (
                <a
                  href={detail.conversation.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-dash-text-muted hover:bg-dash-bg"
                  data-testid="client-inbox-open-external"
                  aria-label={t("clientInbox.openGmail")}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              ) : null}
            </div>
          </div>

          {(detail.conversation.availableActions || []).length ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {(detail.conversation.availableActions || []).includes("archive") ? (
                <ActionButton
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => {
                    const last = detail.messages?.[detail.messages.length - 1];
                    if (last) runLifecycle(last.id, "archived");
                  }}
                  data-testid="client-inbox-archive"
                >
                  <Archive className="w-3.5 h-3.5 mr-1" />
                  {t("clientInbox.actions.archive")}
                </ActionButton>
              ) : null}
              {(detail.conversation.availableActions || []).includes("ignore") ? (
                <ActionButton
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => {
                    const last = detail.messages?.[detail.messages.length - 1];
                    if (last) runLifecycle(last.id, "ignored");
                  }}
                  data-testid="client-inbox-ignore"
                >
                  {t("clientInbox.actions.ignore")}
                </ActionButton>
              ) : null}
              {(detail.conversation.availableActions || []).includes("mark_waiting") ? (
                <ActionButton
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => {
                    const last = detail.messages?.[detail.messages.length - 1];
                    if (last) runLifecycle(last.id, "waiting");
                  }}
                  data-testid="client-inbox-waiting"
                >
                  {t("clientInbox.actions.waiting")}
                </ActionButton>
              ) : null}
              {detail.conversation.externalUrl ? (
                <ActionButton
                  variant="primary"
                  className="min-h-11"
                  onClick={() => window.open(detail.conversation.externalUrl, "_blank")}
                  data-testid="client-inbox-reply"
                >
                  <Reply className="w-3.5 h-3.5 mr-1" />
                  {t("clientInbox.actions.reply")}
                </ActionButton>
              ) : null}
            </div>
          ) : null}

          <ul className="space-y-2 flex-1 max-h-[55vh] lg:max-h-[420px] overflow-y-auto pr-1">
            {(detail.messages || []).map((msg) => (
              <li
                key={msg.id}
                className="rounded-lg bg-dash-bg px-3 py-2"
                data-testid={`client-inbox-msg-${msg.id}`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-dash-text-subtle">
                  <span className="truncate">
                    {msg.direction === "outbound"
                      ? t("clientInbox.outbound")
                      : t("clientInbox.inbound")}{" "}
                    · {authorLabel(msg)}
                  </span>
                  <span className="shrink-0">{formatDate(msg.createdAt, lang)}</span>
                </div>
                {msg.subject ? (
                  <p className="text-sm font-medium text-dash-text mt-1">{msg.subject}</p>
                ) : null}
                <p className="text-xs text-dash-text-muted mt-0.5 whitespace-pre-wrap">
                  {msg.preview || "—"}
                </p>
                <div className="flex items-center justify-between mt-1 gap-2">
                  <span className="text-[11px] text-dash-text-subtle">
                    {lifecycleLabel(msg.lifecycleStatus, t)}
                  </span>
                  {msg.externalUrl ? (
                    <a
                      href={msg.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-dash-primary inline-flex items-center gap-1 min-h-9"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Gmail
                    </a>
                  ) : null}
                </div>
                {(msg.attachments || []).length > 0 ? (
                  <ul className="mt-1.5 space-y-0.5">
                    {msg.attachments.map((att) => (
                      <li
                        key={att.id}
                        className="text-[11px] text-dash-text-subtle inline-flex items-center gap-1"
                      >
                        <Paperclip className="w-3 h-3" />
                        {att.filename || att.kind}
                        {att.size ? ` · ${Math.round(att.size / 1024)} Ko` : ""}
                      </li>
                    ))}
                  </ul>
                ) : msg.attachmentsCount > 0 ? (
                  <p className="text-[11px] text-dash-text-subtle mt-1 inline-flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    {msg.attachmentsCount}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          {(detail.attachments || []).length > 0 ? (
            <div className="mt-3 pt-3 border-t border-dash-border-soft">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-dash-text-subtle mb-1">
                {t("clientInbox.attachments")}
              </p>
              <ul className="space-y-1">
                {detail.attachments.map((att) => (
                  <li key={att.id} className="text-xs text-dash-text-muted flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    {att.filename || att.kind}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-5" data-testid="client-inbox">
      <p className="text-xs text-dash-text-subtle" data-testid="client-inbox-summary">
        {t("clientInbox.summary")
          .replace("{conversations}", String(inbox.totalConversations || 0))
          .replace("{messages}", String(inbox.totalMessages || 0))}
      </p>

      <div
        className={[
          "grid gap-4",
          activeConversationId ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 lg:grid-cols-2",
        ].join(" ")}
      >
        <div
          className={[
            "space-y-3",
            activeConversationId ? "hidden lg:block" : "block",
          ].join(" ")}
        >
          {flatConversations.map((conv) => {
            const Icon = CHANNEL_ICON[conv.channel] || Mail;
            const action = primaryAction(conv);
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => setActiveConversationId(conv.id)}
                className={[
                  "w-full text-left rounded-xl border border-dash-border bg-dash-surface px-3 py-3 transition-colors min-h-[72px]",
                  activeConversationId === conv.id
                    ? "ring-1 ring-dash-border bg-dash-bg"
                    : "hover:bg-dash-bg/70",
                ].join(" ")}
                data-testid={`client-inbox-conv-${conv.id}`}
              >
                <div className="flex items-start gap-2">
                  <Icon className="w-4 h-4 mt-0.5 text-dash-text-muted shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-dash-text line-clamp-1">
                        {conv.subject || t("clientInbox.noSubject")}
                      </p>
                      {conv.unreadCount > 0 ? (
                        <span
                          className="shrink-0 rounded-full bg-dash-primary text-white text-[10px] px-1.5 py-0.5"
                          data-testid={`client-inbox-unread-${conv.id}`}
                        >
                          {conv.unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-dash-text-muted line-clamp-1 mt-0.5">
                      {conv.preview || "—"}
                    </p>
                    {participantsLabel(conv.participants) ? (
                      <p className="text-[11px] text-dash-text-subtle line-clamp-1 mt-0.5">
                        {participantsLabel(conv.participants)}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px] text-dash-text-subtle">
                      <span>{channelLabel(conv.channel, t)}</span>
                      <span>·</span>
                      <span>{lifecycleLabel(conv.lifecycleStatus, t)}</span>
                      <span>·</span>
                      <span>{t(`clientInbox.priority.${conv.priority}`) || conv.priority}</span>
                      <span>·</span>
                      <span>
                        {conv.messageCount} {t("clientInbox.messages")}
                      </span>
                      {conv.attachmentCount > 0 ? (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-0.5">
                            <Paperclip className="w-3 h-3" />
                            {conv.attachmentCount}
                          </span>
                        </>
                      ) : null}
                      <span className="ml-auto">{formatDate(conv.lastMessageAt, lang)}</span>
                    </div>
                    {action ? (
                      <p className="text-[11px] text-dash-primary mt-1">
                        {t(`clientInbox.primary.${action}`)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}

          {inbox?.hasMore ? (
            <ActionButton
              variant="secondary"
              className="w-full min-h-11"
              disabled={loadingMore}
              onClick={() => load({ reset: false, nextOffset: offset })}
              data-testid="client-inbox-load-more"
            >
              {loadingMore ? t("clientInbox.loadingMore") : t("clientInbox.loadMore")}
            </ActionButton>
          ) : null}
        </div>

        <div className={activeConversationId ? "block" : "hidden lg:block"}>{threadPanel}</div>
      </div>
    </div>
  );
}
