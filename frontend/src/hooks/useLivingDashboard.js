import { useCallback, useEffect, useMemo, useState } from "react";
import { getActionsCount, listActions } from "@/lib/actionsApi";
import { getProspectsCount } from "@/lib/prospectsApi";
import { listRecentEvents } from "@/lib/eventsApi";
import { listImports } from "@/lib/importApi";
import { fetchHubConversations } from "@/lib/hubApi";
import { listCommunications } from "@/lib/communicationsApi";
import { listReminders } from "@/lib/remindersApi";
import { fetchPhoneDashboardStats } from "@/lib/phoneApi";
import { useDashboardHomeData } from "@/hooks/useDashboardHomeData";
import { formatInvoiceAmount } from "@/utils/invoiceDisplay";
import { mapAnalyticsToDashboardHome } from "@/utils/mapAnalyticsOverview";

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * Living company dashboard data — composed from existing APIs only (no new backend).
 */
export function useLivingDashboard({ lang = "fr", period = "30d", enabled = true } = {}) {
  const home = useDashboardHomeData({ lang, period, enabled });
  const [pulse, setPulse] = useState({
    unreadConversations: 0,
    actionsPending: 0,
    prospectsPending: 0,
    importsToday: 0,
    emails7d: 0,
    emails30d: 0,
    docs7d: 0,
    docs30d: 0,
    callsToday: 0,
    callsMissed: 0,
    callsToCallBack: 0,
    callsRecognized: 0,
    callsUnknowns: 0,
    call7: 0,
    call30: 0,
    todayEvents: [],
    reminders: [],
    actions: [],
    loading: true,
  });

  const loadPulse = useCallback(async () => {
    if (!enabled) return;
    try {
      const [
        unreadConv,
        actionsCount,
        prospectsCount,
        imports,
        emailsRecent,
        events,
        reminders,
        actions,
        phoneStats,
      ] = await Promise.all([
        fetchHubConversations({ lifecycleStatus: "to_read", limit: 1 }).catch(() => ({ total: 0 })),
        getActionsCount({ status: "pending" }).catch(() => ({ total: 0 })),
        getProspectsCount({ status: "pending" }).catch(() => ({ total: 0 })),
        listImports({ limit: 50 }).catch(() => ({ items: [] })),
        listCommunications({ category: "email", limit: 50 }).catch(() => ({ items: [], total: 0 })),
        listRecentEvents(40).catch(() => ({ items: [] })),
        listReminders({ limit: 8 }).catch(() => ({ items: [] })),
        listActions({ status: "pending", limit: 8 }).catch(() => ({ items: [] })),
        fetchPhoneDashboardStats().catch(() => null),
      ]);

      const importItems = imports.items || imports || [];
      const eventItems = events.items || events || [];
      const emailItems = emailsRecent.items || [];
      const since7 = daysAgoIso(7);
      const since30 = daysAgoIso(30);

      const emails7d = emailItems.filter((e) => (e.createdAt || "") >= since7).length;
      const emails30d = emailItems.filter((e) => (e.createdAt || "") >= since30).length;
      const docs7d = importItems.filter((i) => (i.createdAt || i.completedAt || "") >= since7).length;
      const docs30d = importItems.filter((i) => (i.createdAt || i.completedAt || "") >= since30).length;

      setPulse({
        unreadConversations: unreadConv.total ?? 0,
        actionsPending: actionsCount.total ?? 0,
        prospectsPending: prospectsCount.total ?? 0,
        importsToday: importItems.filter((i) => isToday(i.createdAt || i.completedAt)).length,
        emails7d,
        emails30d: Math.max(emails30d, emails7d),
        docs7d,
        docs30d: Math.max(docs30d, docs7d),
        callsToday: phoneStats?.today ?? 0,
        callsMissed: phoneStats?.missed ?? 0,
        callsToCallBack: phoneStats?.toCallBack ?? 0,
        callsRecognized: phoneStats?.recognized ?? 0,
        callsUnknowns: phoneStats?.unknowns ?? 0,
        call7: phoneStats?.call7 ?? 0,
        call30: phoneStats?.call30 ?? 0,
        todayEvents: eventItems.filter((e) => isToday(e.createdAt)).slice(0, 12),
        reminders: reminders.items || reminders || [],
        actions: actions.items || actions || [],
        loading: false,
        todayAnchor: startOfTodayIso(),
      });
    } catch {
      setPulse((prev) => ({ ...prev, loading: false }));
    }
  }, [enabled]);

  useEffect(() => {
    loadPulse();
  }, [loadPulse]);

  const livingKpis = useMemo(() => {
    const k = home.kpis;
    return {
      unread: pulse.unreadConversations,
      actions: pulse.actionsPending,
      prospects: pulse.prospectsPending,
      newClients: k?.clients?.newThisMonth ?? 0,
      importsToday: pulse.importsToday,
      collected: k?.revenue?.formatted || formatInvoiceAmount(0, lang),
      collectedRaw: k?.revenue?.value ?? 0,
      pendingPayments: k?.invoices?.pending ?? 0,
      pendingLabel: String(k?.invoices?.pending ?? 0),
    };
  }, [home.kpis, pulse, lang]);

  const money = useMemo(() => {
    const pipeline = home.pipeline?.invoices || {};
    return {
      series: home.series || [],
      collected: home.kpis?.revenue?.value ?? 0,
      paid: pipeline.paid ?? 0,
      pending: pipeline.pending ?? 0,
      overdue: pipeline.overdue ?? 0,
    };
  }, [home]);

  const communicationStats = useMemo(
    () => ({
      email7: pulse.emails7d,
      email30: pulse.emails30d,
      call7: pulse.call7,
      call30: pulse.call30,
      whatsapp7: 0,
      whatsapp30: 0,
      docs7: pulse.docs7d,
      docs30: pulse.docs30d,
    }),
    [pulse],
  );

  const phoneStats = useMemo(
    () => ({
      today: pulse.callsToday,
      missed: pulse.callsMissed,
      toCallBack: pulse.callsToCallBack,
      recognized: pulse.callsRecognized,
      unknowns: pulse.callsUnknowns,
    }),
    [pulse],
  );

  return {
    ...home,
    livingKpis,
    money,
    communicationStats,
    phoneStats,
    todayEvents: pulse.todayEvents,
    reminders: pulse.reminders,
    pulseActions: pulse.actions,
    pulseLoading: pulse.loading,
    refetchAll: () => {
      home.refetch();
      loadPulse();
    },
  };
}

// Re-export helper for tests
export { mapAnalyticsToDashboardHome, isToday };
