import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchClientInbox,
  fetchHubConversation,
  migrateHub,
} from "@/lib/hubApi";
import { listActions } from "@/lib/actionsApi";
import { getClientTimelineV2 } from "@/lib/clientsApi";
import { getCommunicationIntelligence } from "@/lib/communicationIntelligenceApi";
import { PageLoader } from "@/components/dashboard/PageFeedback";
import { ActionButton } from "@/components/dashboard/ActionButton";
import ConversationListItem from "./inbox/ConversationListItem";
import ConversationHeader from "./inbox/ConversationHeader";
import ConversationThread from "./inbox/ConversationThread";
import {
  enrichConversation,
  indexActionsByConversation,
  indexIntelFromTimeline,
  primaryParticipant,
} from "./inbox/inboxUtils";

const PAGE_SIZE = 30;
const MIGRATE_FLAG = "basera_hub_migrated_v2";

export default function ClientInboxSection({
  clientId,
  client = null,
  t,
  lang,
  initialConversationId = null,
  onCreateQuote,
  onCreateInvoice,
  onCreateNote,
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
  const [pendingActions, setPendingActions] = useState([]);
  const [timelineItems, setTimelineItems] = useState([]);
  const [detailIntel, setDetailIntel] = useState(null);

  const actionIndex = useMemo(
    () => indexActionsByConversation(pendingActions),
    [pendingActions],
  );
  const intelByConv = useMemo(
    () => indexIntelFromTimeline(timelineItems),
    [timelineItems],
  );

  const loadSideData = useCallback(async () => {
    try {
      const [actionsRes, timelineRes] = await Promise.all([
        listActions({ clientId, status: "pending", limit: 50 }).catch(() => ({ items: [] })),
        getClientTimelineV2(clientId, { limit: 80, offset: 0, category: "all" }).catch(
          () => ({ items: [] }),
        ),
      ]);
      const actionItems = Array.isArray(actionsRes)
        ? actionsRes
        : actionsRes.items || [];
      setPendingActions(actionItems);
      setTimelineItems(timelineRes.items || []);
    } catch {
      /* non-blocking enrichment */
    }
  }, [clientId]);

  const load = useCallback(
    async ({ reset = true, nextOffset = 0, silent = false } = {}) => {
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
          setOffset(
            data.channels?.flatMap((c) => c.conversations || []).length || 0,
          );
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
    },
    [clientId, t],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await Promise.all([load({ reset: true, nextOffset: 0 }), loadSideData()]);
    })();
    return () => {
      mounted = false;
    };
  }, [clientId, load, loadSideData]);

  useEffect(() => {
    if (initialConversationId) setActiveConversationId(initialConversationId);
  }, [initialConversationId]);

  useEffect(() => {
    if (!activeConversationId) {
      setDetail(null);
      setDetailError(null);
      setDetailIntel(null);
      return;
    }
    let mounted = true;
    (async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const data = await fetchHubConversation(activeConversationId, { markRead: true });
        if (!mounted) return;
        setDetail(data);
        load({ reset: true, nextOffset: 0, silent: true });

        const latestInbound =
          [...(data.messages || [])]
            .reverse()
            .find((m) => m.direction !== "outbound") || data.messages?.[data.messages.length - 1];
        if (latestInbound?.id) {
          const intel = await getCommunicationIntelligence(latestInbound.id).catch(() => null);
          if (mounted) setDetailIntel(intel);
        } else {
          setDetailIntel(null);
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
  }, [activeConversationId, load, t]);

  const flatConversations = useMemo(() => {
    const list = [];
    for (const group of inbox?.channels || []) {
      for (const conv of group.conversations || []) list.push(conv);
    }
    return list
      .sort((a, b) =>
        String(b.lastMessageAt || "").localeCompare(String(a.lastMessageAt || "")),
      )
      .map((conv) => {
        const enriched = enrichConversation(conv, {
          actionsByConv: actionIndex.byConv,
          actionsByComm: actionIndex.byComm,
          intelByConv,
          client,
        });
        // Fallback action match via communication ids is unavailable in list payload;
        // also mark action if any pending action shares conversation metadata.
        if (!enriched._hasAction && actionIndex.byComm.size) {
          // no message ids on list — keep conversation-level only
        }
        // On client page, always client badge
        return {
          ...enriched,
          _isClient: Boolean(clientId),
          _isProspect: false,
        };
      });
  }, [inbox, actionIndex, intelByConv, client, clientId]);

  const activeEnriched = useMemo(() => {
    const fromList = flatConversations.find((c) => c.id === activeConversationId);
    if (detail?.conversation) {
      const base = enrichConversation(detail.conversation, {
        actionsByConv: actionIndex.byConv,
        actionsByComm: actionIndex.byComm,
        intelByConv,
        client,
      });
      return {
        ...base,
        ...fromList,
        ...detail.conversation,
        _participant: primaryParticipant(
          detail.conversation.participants,
          client?.name || detail.conversation.clientName,
        ),
        _hasAction:
          fromList?._hasAction ||
          base._hasAction ||
          (detail.messages || []).some((m) => actionIndex.byComm.has(m.id)),
        _hasIntel:
          Boolean(
            detailIntel?.suggestedActionTitle ||
              detailIntel?.intent ||
              detailIntel?.summary ||
              detailIntel?.status === "ready",
          ) ||
          fromList?._hasIntel ||
          base._hasIntel,
        _intel: detailIntel || fromList?._intel || base._intel,
        _isClient: true,
        _isProspect: false,
      };
    }
    return fromList || null;
  }, [
    flatConversations,
    activeConversationId,
    detail,
    actionIndex,
    intelByConv,
    client,
    detailIntel,
  ]);

  const handleReply = useCallback(() => {
    const url = detail?.conversation?.externalUrl || activeEnriched?.externalUrl;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, [detail, activeEnriched]);

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
      className={[
        "rounded-xl border border-dash-border bg-dash-surface p-4 min-h-[280px] flex flex-col",
        "lg:max-h-[calc(100vh-12rem)]",
        activeConversationId
          ? "fixed inset-0 z-40 lg:static lg:z-auto rounded-none lg:rounded-xl safe-area-pb safe-area-pt bg-dash-surface"
          : "hidden lg:flex",
      ].join(" ")}
      data-testid="client-inbox-thread"
    >
      {!activeConversationId ? (
        <p className="text-sm text-dash-text-muted m-auto">
          {t("clientInbox.selectConversation")}
        </p>
      ) : detailLoading ? (
        <PageLoader />
      ) : detailError ? (
        <p className="text-sm text-[#991B1B]">{detailError}</p>
      ) : detail && activeEnriched ? (
        <>
          <ConversationHeader
            conversation={activeEnriched}
            client={client}
            t={t}
            showBack
            onBack={() => setActiveConversationId(null)}
            onReply={handleReply}
            onCreateQuote={() => onCreateQuote?.(client)}
            onCreateInvoice={() => onCreateInvoice?.(client)}
            onCreateNote={() => onCreateNote?.(client)}
          />
          <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-1">
            <ConversationThread
              conversation={activeEnriched}
              messages={detail.messages || []}
              attachments={detail.attachments || []}
              timelineItems={timelineItems}
              clientId={clientId}
              t={t}
              lang={lang}
            />
          </div>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4" data-testid="client-inbox">
      <p className="text-xs text-dash-text-subtle" data-testid="client-inbox-summary">
        {t("clientInbox.summary")
          .replace("{conversations}", String(inbox.totalConversations || 0))
          .replace("{messages}", String(inbox.totalMessages || 0))}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className={[
            "space-y-2",
            activeConversationId ? "hidden lg:block" : "block",
          ].join(" ")}
        >
          {flatConversations.map((conv) => (
            <ConversationListItem
              key={conv.id}
              conversation={conv}
              active={activeConversationId === conv.id}
              onSelect={setActiveConversationId}
              t={t}
              lang={lang}
            />
          ))}

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

        {threadPanel}
      </div>
    </div>
  );
}
