import { DEMO_CLIENT_ID, getDemoData } from "@/showcase/DemoData";
import { SHOWCASE_ACCOUNT, SHOWCASE_CREDITS } from "@/showcase/showcaseAccount";
import { shapeShowcaseAnalytics } from "@/showcase/showcaseAnalyticsPeriod";

function ok(data, status = 200) {
  return {
    res: { ok: status >= 200 && status < 300, status, statusText: "OK" },
    data,
  };
}

function notFound(message = "Not found") {
  return ok({ detail: message }, 404);
}

function parsePath(path) {
  const [pathname, search = ""] = String(path || "").split("?");
  return { pathname, searchParams: new URLSearchParams(search) };
}

function buildOnboarding() {
  return {
    maturity: "active",
    showWizard: false,
    showChecklist: false,
    demoAllowed: false,
    firstWins: [],
    wizard: { completed: true, step: null },
    checklist: { dismissed: true, viewedClient360: true },
  };
}

export function getShowcaseDemoUser(lang = "fr") {
  const data = getDemoData(lang);
  return {
    id: "demo-user-julien",
    email: "julien@atelier-demo.fr",
    firstName: data.user.firstName,
    lastName: "Moreau",
    companyName: "Atelier Moreau",
    role: "user",
    emailVerified: true,
  };
}

/**
 * Create an apiFetch handler backed by showcase DemoData.
 */
export function createShowcaseApiHandler(lang = "fr") {
  const data = getDemoData(lang);
  const onboarding = buildOnboarding();
  const user = getShowcaseDemoUser(lang);

  return async function showcaseApiHandler(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const { pathname, searchParams } = parsePath(path);

    // Public demo is read-only: no write mock succeeds.
    if (method !== "GET" && method !== "HEAD") {
      if (pathname === "/api/auth/logout") return ok({ ok: true });
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        return ok(
          {
            detail: "Démo interactive — créez un compte pour enregistrer vos données.",
            demo: true,
            message: "Démo interactive — créez un compte pour enregistrer vos données.",
          },
          400
        );
      }
    }

    if (pathname === "/api/auth/me") return ok(user);

    if (pathname === "/api/dashboard/stats") {
      return ok({
        kpis: {
          clientsTotal: data.kpis.clients.total,
          pendingQuotes: data.kpis.quotes.pending,
          unpaidInvoices: data.kpis.invoices.pending,
          quotesTotal: data.kpis.quotes.total,
          invoicesTotal: data.kpis.invoices.total,
          monthlyRevenue: {
            total: data.kpis.revenue.value,
            count: data.kpis.revenue.helperCount,
          },
        },
        topClients: data.topClients.map((row) => ({
          clientId: row.clientId,
          clientName: row.clientName,
          total: row.collected,
          quoteCount: row.quoteCount,
          invoiceCount: row.invoiceCount,
          lastContactAt: row.lastActivityAt,
        })),
      });
    }

    if (pathname === "/api/analytics/overview" || pathname.startsWith("/api/analytics/overview")) {
      const period = searchParams.get("period") || "30d";
      return ok(shapeShowcaseAnalytics(data.analytics, period));
    }

    if (pathname === "/api/onboarding/state" || pathname === "/api/onboarding/maturity") {
      return ok(onboarding);
    }

    if (pathname === "/api/billing/me") {
      return ok({ ...SHOWCASE_ACCOUNT });
    }

    if (pathname === "/api/credits/balance" || pathname === "/api/credits/me") {
      return ok({ ...SHOWCASE_CREDITS });
    }

    if (pathname === "/api/intelligence/overview" || pathname.startsWith("/api/intelligence/overview")) {
      return ok({
        computedAt: new Date().toISOString(),
        fromCache: false,
        actions: data.actions,
        importantClients: data.topClients.slice(0, 3).map((row) => ({
          clientId: row.clientId,
          clientName: row.clientName,
          reason: "active",
        })),
        recentDocuments: data.documents.slice(0, 6),
        recentNotes: data.notes.slice(0, 5),
        insights: [],
      });
    }

    if (pathname === "/api/reminders" || pathname.startsWith("/api/reminders")) {
      return ok({ items: data.reminders, total: data.reminders.length });
    }
    if (pathname.startsWith("/api/personal-reminders")) {
      return ok({
        items: [
          {
            id: "demo-personal-1",
            message: lang === "en" ? "Bring plan V3 to Dupont site" : "Emporter plans V3 chez Dupont",
            remindAt: new Date(Date.now() + 86400000).toISOString(),
            noteId: "demo-note-dupont",
            clientId: "demo-client-dupont",
            clientName: "Dupont Rénovation",
          },
        ],
        total: 1,
      });
    }
    if (pathname === "/api/imports" || pathname.startsWith("/api/imports")) {
      return ok({ items: [], total: 0, sessions: [] });
    }

    if (pathname === "/api/events/recent" || pathname === "/api/events") {
      const clientId = searchParams.get("clientId");
      const items = clientId
        ? data.timeline.filter((ev) => ev.clientId === clientId)
        : data.timeline;
      return ok({
        items: items.slice(0, 40),
        total: items.length,
      });
    }

    if (pathname === "/api/communications" || pathname.startsWith("/api/communications")) {
      if (pathname.includes("/unlinked")) {
        return ok({ items: [], total: 0, count: 0 });
      }
      const items = data.timeline.map((ev) => ({
        id: ev.id,
        category: ev.type?.includes("email")
          ? "email"
          : ev.type?.includes("follow_up")
            ? "follow_up"
            : ev.type?.includes("invoice")
              ? "invoice"
              : ev.type?.includes("quote")
                ? "quote"
                : "activity",
        channel: ev.type?.includes("email") ? "email" : "app",
        clientId: ev.clientId,
        clientName: ev.clientName,
        title:
          ev.metadata?.subject ||
          ev.metadata?.noteTitle ||
          ev.metadata?.title ||
          ev.metadata?.quoteNumber ||
          ev.metadata?.invoiceNumber ||
          ev.type,
        preview: ev.metadata?.excerpt || ev.metadata?.preview || "",
        amount: ev.metadata?.amountTTC ?? null,
        createdAt: ev.createdAt,
        occurredAt: ev.createdAt,
      }));
      return ok({ items, total: items.length });
    }

    if (pathname === "/api/search" || pathname.startsWith("/api/search")) {
      const q = (searchParams.get("q") || "").toLowerCase();
      if (!q || q.length < 2) return ok({ groups: {}, total: 0 });
      return ok({
        groups: data.searchGroups,
        total: data.searchTotal,
        query: searchParams.get("q"),
      });
    }

    if (pathname === "/api/clients") {
      return ok({ items: data.clients, total: data.clients.length });
    }
    if (pathname === "/api/clients/recent") {
      return ok({ items: data.clients.slice(0, 6), total: data.clients.length });
    }

    const clientMatch = pathname.match(/^\/api\/clients\/([^/]+)(?:\/(.+))?$/);
    if (clientMatch) {
      const clientId = decodeURIComponent(clientMatch[1]);
      const rest = clientMatch[2] || "";
      const client =
        data.clients.find((c) => c.id === clientId) ||
        (clientId === DEMO_CLIENT_ID ? data.client : null);
      if (!client) return notFound("Client not found");

      if (!rest) return ok(client);
      if (rest === "360") {
        return ok(
          data.client360ById?.[clientId] || {
            stats: {
              exchangesTotal: 2,
              totalRevenue: client.totalRevenue || 0,
              notesCount: client.notesCount || 0,
              documentsCount: client.documentsCount || 0,
              lastActivityAt: client.lastActivityAt,
            },
            recentNotes: data.notes.filter((n) => n.clientId === clientId),
            recentDocuments: data.documents.filter((d) => d.clientId === clientId),
            recentCommunications: data.emails
              .filter((e) => e.clientId === clientId)
              .map((item) => ({
                id: item.id,
                subject: item.subject,
                preview: item.preview,
                createdAt: item.createdAt,
              })),
          }
        );
      }
      return ok({ items: [], total: 0 });
    }

    if (pathname === "/api/notes") {
      const clientId = searchParams.get("clientId");
      const items = clientId
        ? data.notes.filter((n) => n.clientId === clientId)
        : data.notes;
      return ok({ items, total: items.length });
    }

    if (pathname === "/api/quotes") {
      const clientId = searchParams.get("clientId");
      const items = clientId
        ? data.quotes.filter((q) => q.clientId === clientId)
        : data.quotes;
      return ok({ items, total: items.length });
    }
    const quoteMatch = pathname.match(/^\/api\/quotes\/([^/]+)$/);
    if (quoteMatch) {
      const quote = data.quotes.find((q) => q.id === quoteMatch[1]);
      return quote ? ok(quote) : notFound();
    }

    if (pathname === "/api/invoices") {
      const clientId = searchParams.get("clientId");
      const items = clientId
        ? data.invoices.filter((q) => q.clientId === clientId)
        : data.invoices;
      return ok({ items, total: items.length });
    }
    const invoiceMatch = pathname.match(/^\/api\/invoices\/([^/]+)$/);
    if (invoiceMatch) {
      const invoice = data.invoices.find((q) => q.id === invoiceMatch[1]);
      return invoice ? ok(invoice) : notFound();
    }

    if (pathname === "/api/documents") {
      const clientId = searchParams.get("clientId");
      const items = clientId
        ? data.files.filter((f) => f.clientId === clientId)
        : data.files;
      return ok({ items, total: items.length });
    }

    if (pathname.startsWith("/api/follow-ups")) {
      return ok({
        items: [
          {
            id: "demo-fu-1",
            clientId: DEMO_CLIENT_ID,
            clientName: "Martin Ébénisterie",
            title: lang === "en" ? "Tuesday call" : "Appel mardi",
            dueAt: new Date(Date.now() + 86400000).toISOString(),
            status: "open",
            createdAt: data.timeline[1]?.createdAt,
          },
        ],
        total: 1,
        lastByEntity: {},
      });
    }

    if (pathname.includes("/emails")) {
      const gmailMatch = pathname.match(/\/clients\/([^/]+)\/emails/);
      const clientId = gmailMatch ? decodeURIComponent(gmailMatch[1]) : searchParams.get("clientId");
      const items = clientId
        ? data.emails.filter((e) => e.clientId === clientId)
        : data.emails;
      return ok({ items, total: items.length });
    }

    if (pathname.startsWith("/api/integrations/")) {
      return ok({
        connected: true,
        email: "julien@atelier-demo.fr",
        lastSync: new Date().toISOString(),
        mockMode: false,
      });
    }

    if (pathname.startsWith("/api/dev/demo-status")) {
      return ok({ hasDemoData: true });
    }

    // Safe empty defaults so real pages don't crash in the demo frame.
    if (pathname.startsWith("/api/")) {
      return ok({ items: [], total: 0 });
    }

    return undefined;
  };
}
