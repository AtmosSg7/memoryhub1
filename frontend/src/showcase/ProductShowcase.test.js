/**
 * @jest-environment jsdom
 */

const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const React = require("react");
const { act } = require("react");
const { createRoot } = require("react-dom/client");
const { QueryClient, QueryClientProvider } = require("@tanstack/react-query");
const { MemoryRouter } = require("react-router-dom");
const { LanguageProvider } = require("@/context/LanguageContext");
const { DEMO_CLIENT_ID, getDemoData } = require("@/showcase/DemoData");
const { createShowcaseApiHandler } = require("@/showcase/showcaseApiMock");
const { shapeShowcaseAnalytics } = require("@/showcase/showcaseAnalyticsPeriod");
const {
  SHOWCASE_ACCOUNT,
  SHOWCASE_IMPORTS_LIMIT,
  SHOWCASE_IMPORTS_REMAINING,
} = require("@/showcase/showcaseAccount");
const {
  isShowcaseExplorationTarget,
  SHOWCASE_ALLOWED_PATH,
} = require("@/showcase/ShowcaseExploreLock");
const { installShowcaseApi } = require("@/lib/api");
const { computeImportUsage } = require("@/utils/importUsage");

jest.mock("@/hooks/useDemoDataStatus", () => ({
  useDemoDataStatus: () => ({ hasDemoData: false, loading: false }),
}));

const { ProductShowcase } = require("@/showcase/ProductShowcase");

async function renderShowcase() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await act(async () => {
    root.render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          LanguageProvider,
          null,
          React.createElement(MemoryRouter, null, React.createElement(ProductShowcase, null))
        )
      )
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return {
    container,
    async cleanup() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("ProductShowcase interactive demo", () => {
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.setItem("mh-lang", "fr");
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    global.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the interactive product window and CTA", async () => {
    const { container, cleanup } = await renderShowcase();
    expect(container.querySelector('[data-testid="product-showcase"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="showcase-window"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="showcase-viewport"]')).toBeTruthy();
    expect(
      container.querySelector('[data-testid="showcase-app"]') ||
        container.querySelector('[data-testid="showcase-app-boot"]')
    ).toBeTruthy();
    const cta = container.querySelector('[data-testid="showcase-cta"]');
    expect(cta).toBeTruthy();
    expect(cta.getAttribute("href")).toBe("/register");
    await cleanup();
  });

  it("serves coherent demo data from the showcase API mock", async () => {
    const handler = createShowcaseApiHandler("fr");
    const dispose = installShowcaseApi(handler);
    try {
      const clients = await handler("/api/clients", { method: "GET" });
      expect(clients.data.items.length).toBeGreaterThanOrEqual(3);
      expect(clients.data.items.some((c) => c.id === DEMO_CLIENT_ID)).toBe(true);

      const detail = await handler(`/api/clients/${DEMO_CLIENT_ID}`, { method: "GET" });
      expect(detail.data.company).toBe("Martin Ébénisterie");

      const emails = await handler(
        `/api/integrations/gmail/clients/${DEMO_CLIENT_ID}/emails?limit=20`,
        { method: "GET" }
      );
      expect(emails.data.items.length).toBeGreaterThan(0);

      const notes = await handler(`/api/notes?clientId=${DEMO_CLIENT_ID}`, { method: "GET" });
      expect(notes.data.items.length).toBeGreaterThan(0);

      const quotes = await handler(`/api/quotes?clientId=${DEMO_CLIENT_ID}`, { method: "GET" });
      expect(quotes.data.items.length).toBeGreaterThan(0);

      const stats = await handler("/api/dashboard/stats", { method: "GET" });
      expect(stats.data.kpis.clientsTotal).toBeGreaterThan(0);

      const analytics = await handler("/api/analytics/overview?period=30d", { method: "GET" });
      expect(analytics.data.empty).toBe(false);
      expect(analytics.data.period.key).toBe("30d");
      expect(analytics.data.financialSeries.length).toBeGreaterThanOrEqual(3);
      expect(analytics.data.commercialSeries.length).toBeGreaterThanOrEqual(3);
      expect(analytics.data.revenueBreakdown.length).toBeGreaterThanOrEqual(3);
      expect(analytics.data.topClients[0].collected).toBeGreaterThan(0);
      expect(analytics.data.financialSeries.some((p) => p.values.collected > 0)).toBe(true);
      Object.values(analytics.data.comparison).forEach((value) => {
        expect(Math.abs(value)).toBeLessThanOrEqual(100);
      });
      Object.values(analytics.data.kpis).forEach((kpi) => {
        if (kpi?.changePercent != null) {
          expect(Math.abs(kpi.changePercent)).toBeLessThanOrEqual(100);
        }
      });

      const analytics7d = await handler("/api/analytics/overview?period=7d", { method: "GET" });
      expect(analytics7d.data.period.key).toBe("7d");
      expect(analytics7d.data.financialSeries.length).toBeLessThan(analytics.data.financialSeries.length);

      const billing = await handler("/api/billing/me", { method: "GET" });
      expect(billing.data.planId).toBe(SHOWCASE_ACCOUNT.planId);
      expect(billing.data.subscriptionStatus).toBe("active");
      expect(billing.data.monthlyAnalysesRemaining).toBe(SHOWCASE_IMPORTS_REMAINING);
      expect(billing.data.monthlyAnalysesAllocated).toBe(SHOWCASE_IMPORTS_LIMIT);
      const usage = computeImportUsage({
        planId: billing.data.planId,
        monthlyRemaining: billing.data.monthlyAnalysesRemaining,
        monthlyAllocated: billing.data.monthlyAnalysesAllocated,
      });
      expect(usage.used).toBe(SHOWCASE_IMPORTS_LIMIT - SHOWCASE_IMPORTS_REMAINING);
      expect(usage.limit).toBe(SHOWCASE_IMPORTS_LIMIT);

      const intelligence = await handler("/api/intelligence/overview", { method: "GET" });
      expect(intelligence.data.actions.length).toBeGreaterThanOrEqual(6);

      const events = await handler("/api/events/recent?limit=10", { method: "GET" });
      expect(events.data.items.length).toBeGreaterThanOrEqual(8);

      const allQuotes = await handler("/api/quotes", { method: "GET" });
      expect(allQuotes.data.items.length).toBeGreaterThanOrEqual(5);
      expect(allQuotes.data.items[0].amountTTC).toBeGreaterThan(10000);

      const allInvoices = await handler("/api/invoices", { method: "GET" });
      expect(allInvoices.data.items.length).toBeGreaterThanOrEqual(5);

      const demo = getDemoData("fr");
      expect(demo.client.id).toBe(DEMO_CLIENT_ID);
      expect(demo.emails.length).toBeGreaterThan(0);
      expect(demo.clients.length).toBeGreaterThanOrEqual(6);
    } finally {
      dispose();
    }
  });

  it("keeps write mutations non-destructive in the demo", async () => {
    const handler = createShowcaseApiHandler("fr");
    const create = await handler("/api/clients", {
      method: "POST",
      body: JSON.stringify({ name: "X" }),
    });
    expect(create.res.ok).toBe(false);
    expect(create.res.status).toBe(400);

    const patch = await handler(`/api/clients/${DEMO_CLIENT_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Hack" }),
    });
    expect(patch.res.ok).toBe(false);
    expect(patch.res.status).toBe(400);

    const favorite = await handler(`/api/clients/${DEMO_CLIENT_ID}/favorite`, {
      method: "POST",
    });
    expect(favorite.res.ok).toBe(false);
    expect(favorite.res.status).toBe(400);
  });

  it("shapes analytics mock data per period", () => {
    const base = getDemoData("fr").analytics;
    const short = shapeShowcaseAnalytics(base, "7d");
    const year = shapeShowcaseAnalytics(base, "year");
    expect(short.period.key).toBe("7d");
    expect(year.period.key).toBe("year");
    expect(short.financialSeries.length).toBeLessThan(year.financialSeries.length);
    expect(short.kpis.collectedRevenue.value).toBeLessThan(year.kpis.collectedRevenue.value);
  });

  it("allows consultation targets and blocks write controls", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <a data-testid="sidebar-nav-dashboard" href="/dashboard">Dashboard</a>
      <a data-testid="sidebar-nav-documents" href="/dashboard/documents">Documents</a>
      <a data-testid="sidebar-nav-analytics" href="/dashboard/analytics">Analyses</a>
      <a data-testid="sidebar-nav-communications" href="/dashboard/communications">Activité</a>
      <a data-testid="sidebar-nav-settings" href="/dashboard/settings">Settings</a>
      <button data-testid="topbar-theme-toggle">Theme</button>
      <button data-testid="topbar-lang-fr">FR</button>
      <button data-testid="dashboard-period-7d">7j</button>
      <button data-testid="dashboard-period-30d">30j</button>
      <button data-testid="client-card-demo-client-martin-ebenisterie">Client</button>
      <button data-testid="client-import-document">Import</button>
      <button data-testid="clients-header-primary">Ajouter</button>
      <button data-testid="client-detail-edit">Modifier</button>
      <button data-testid="client-detail-delete">Supprimer</button>
      <button data-testid="client-create-note">Créer une note</button>
      <button data-testid="row-more-quote-1">...</button>
      <button data-testid="commercial-detail-more-actions">Plus d'actions</button>
      <button data-testid="client-detail-back">Back</button>
      <button data-testid="commercial-documents-import">Importer</button>
      <button data-testid="quote-row-demo-1">View quote</button>
      <div role="dialog" data-testid="quote-detail-modal">
        <button type="button">Modifier</button>
        <button type="button">Fermer</button>
        <div role="menu"><div role="menuitem">Supprimer</div></div>
      </div>
    `;
    document.body.appendChild(root);

    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="sidebar-nav-dashboard"]'))).toBe(true);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="sidebar-nav-documents"]'))).toBe(true);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="sidebar-nav-analytics"]'))).toBe(true);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="sidebar-nav-communications"]'))).toBe(true);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="topbar-theme-toggle"]'))).toBe(true);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="dashboard-period-7d"]'))).toBe(true);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="quote-row-demo-1"]'))).toBe(true);

    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="sidebar-nav-settings"]'))).toBe(false);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="client-import-document"]'))).toBe(false);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="clients-header-primary"]'))).toBe(false);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="client-detail-edit"]'))).toBe(false);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="client-detail-delete"]'))).toBe(false);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="client-create-note"]'))).toBe(false);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="row-more-quote-1"]'))).toBe(false);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="commercial-detail-more-actions"]'))).toBe(false);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="commercial-documents-import"]'))).toBe(false);
    expect(isShowcaseExplorationTarget(root.querySelector('[data-testid="client-detail-back"]'))).toBe(true);
    expect(
      isShowcaseExplorationTarget(
        root.querySelector('[data-testid="client-card-demo-client-martin-ebenisterie"]')
      )
    ).toBe(true);

    const dialog = root.querySelector('[data-testid="quote-detail-modal"]');
    expect(isShowcaseExplorationTarget(dialog.querySelector("button"))).toBe(false);
    expect(
      isShowcaseExplorationTarget(
        Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Fermer")
      )
    ).toBe(true);
    expect(isShowcaseExplorationTarget(dialog.querySelector('[role="menuitem"]'))).toBe(false);

    expect(SHOWCASE_ALLOWED_PATH.test("/dashboard")).toBe(true);
    expect(SHOWCASE_ALLOWED_PATH.test("/dashboard/documents")).toBe(true);
    expect(SHOWCASE_ALLOWED_PATH.test("/dashboard/analytics")).toBe(true);
    expect(SHOWCASE_ALLOWED_PATH.test("/dashboard/communications")).toBe(true);
    expect(SHOWCASE_ALLOWED_PATH.test("/dashboard/settings")).toBe(false);
    expect(SHOWCASE_ALLOWED_PATH.test("/dashboard/billing")).toBe(false);

    root.remove();
  });
});
