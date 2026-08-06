/**
 * @jest-environment jsdom
 */

const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const React = require("react");
const { act } = require("react");
const { createRoot } = require("react-dom/client");
const { MemoryRouter, Route, Routes } = require("react-router-dom");
const { LanguageProvider } = require("@/context/LanguageContext");

const mockListProspects = jest.fn();
const mockGetProspectsCount = jest.fn();
const mockGetProspect = jest.fn();
const mockAssociateProspect = jest.fn();
const mockCreateClientFromProspect = jest.fn();
const mockIgnoreProspect = jest.fn();
const mockRestoreProspect = jest.fn();

jest.mock("@/lib/prospectsApi", () => ({
  listProspects: (...args) => mockListProspects(...args),
  getProspectsCount: (...args) => mockGetProspectsCount(...args),
  getProspect: (...args) => mockGetProspect(...args),
  associateProspect: (...args) => mockAssociateProspect(...args),
  createClientFromProspect: (...args) => mockCreateClientFromProspect(...args),
  ignoreProspect: (...args) => mockIgnoreProspect(...args),
  restoreProspect: (...args) => mockRestoreProspect(...args),
}));

jest.mock("@/hooks/useSearch", () => ({
  SEARCH_MIN_CHARS: 2,
  useSearch: () => ({
    data: {
      groups: {
        clients: {
          items: [{ id: "client-1", title: "Client Cible", subtitle: "cible@exemple.fr" }],
        },
      },
    },
    loading: false,
    error: null,
    minChars: 2,
  }),
}));

jest.mock("@/hooks/usePageTitle", () => ({
  usePageTitle: () => {},
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), message: jest.fn() },
}));

const mockInvalidateActions = jest.fn();
jest.mock("@/hooks/useActionsCountInvalidate", () => ({
  invalidateActionsPendingCount: (...args) => mockInvalidateActions(...args),
  subscribeActionsPendingCount: () => () => {},
}));

const { toast } = require("sonner");
const {
  invalidateProspectsPendingCount,
} = require("@/hooks/useProspectsPendingCount");
const { default: ProspectsPage } = require("@/pages/dashboard/ProspectsPage");

const SAMPLE = {
  id: "prospect-1",
  identityKey: "email:inconnu@exemple.fr",
  email: "inconnu@exemple.fr",
  displayName: "Paul Inconnu",
  company: "Exemple SARL",
  firstContactAt: "2026-07-01T10:00:00+00:00",
  lastContactAt: "2026-07-02T10:00:00+00:00",
  communicationsCount: 2,
  inboundCount: 2,
  lastSubject: "Demande de devis",
  lastPreview: "Bonjour, pourriez-vous…",
  source: "gmail",
  status: "pending",
};

function mockPendingList(items = [SAMPLE], total = items.length) {
  mockListProspects.mockResolvedValue({ items, total, offset: 0, limit: 20 });
  mockGetProspectsCount.mockResolvedValue({ total });
}

async function renderPage(initialEntry = "/dashboard/prospects") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [initialEntry] },
        React.createElement(
          LanguageProvider,
          null,
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/dashboard/prospects",
              element: React.createElement(ProspectsPage, null),
            }),
            React.createElement(Route, {
              path: "/dashboard/clients/:id",
              element: React.createElement("div", {
                "data-testid": "client-dest",
              }),
            })
          )
        )
      )
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return {
    container,
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("ProspectsPage", () => {
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.setItem("mh-lang", "fr");
    jest.clearAllMocks();
    invalidateProspectsPendingCount();
    mockPendingList();
    mockGetProspect.mockResolvedValue({
      prospect: SAMPLE,
      communications: [
        {
          id: "comm-1",
          direction: "inbound",
          subject: "Demande de devis",
          preview: "Bonjour",
          createdAt: "2026-07-02T10:00:00+00:00",
          externalUrl: "https://mail.google.com/mail/u/0/#inbox/x",
        },
      ],
      totalCommunications: 1,
    });
    mockAssociateProspect.mockResolvedValue({
      prospectId: SAMPLE.id,
      clientId: "client-1",
      clientName: "Client Cible",
      linkedCommunications: 2,
    });
    mockCreateClientFromProspect.mockResolvedValue({
      prospectId: SAMPLE.id,
      client: { id: "new-client", name: "Paul Inconnu", email: "inconnu@exemple.fr" },
      association: { linkedCommunications: 2 },
    });
    mockIgnoreProspect.mockResolvedValue({
      prospectId: SAMPLE.id,
      ignoredAt: "2026-07-03T10:00:00+00:00",
      status: "ignored",
    });
    mockRestoreProspect.mockResolvedValue({
      prospectId: SAMPLE.id,
      restored: true,
      status: "pending",
    });
  });

  it("lists pending prospects and shows pending badge", async () => {
    const { container, cleanup } = await renderPage();
    expect(container.querySelector('[data-testid="prospects-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="prospect-card-prospect-1"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Paul Inconnu/);
    expect(container.textContent).toMatch(/Demande de devis/);
    expect(container.querySelector('[data-testid="prospects-pending-badge"]')?.textContent).toMatch(
      /1/
    );
    expect(mockListProspects).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", offset: 0 })
    );
    expect(mockGetProspectsCount).toHaveBeenCalledWith({ status: "pending" });
    await cleanup();
  });

  it("shows empty state when no pending prospects", async () => {
    mockPendingList([], 0);
    const { container, cleanup } = await renderPage();
    expect(container.querySelector('[data-testid="prospects-empty"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Aucun client potentiel/);
    await cleanup();
  });

  it("shows error state", async () => {
    mockListProspects.mockRejectedValue(new Error("Failed to load prospects."));
    const { container, cleanup } = await renderPage();
    expect(container.querySelector('[data-testid="prospects-error"]')).toBeTruthy();
    await cleanup();
  });

  it("filters ignored tab", async () => {
    mockListProspects.mockImplementation(async ({ status }) => {
      if (status === "ignored") {
        return {
          items: [{ ...SAMPLE, id: "p-ign", status: "ignored" }],
          total: 1,
          offset: 0,
          limit: 20,
        };
      }
      return { items: [SAMPLE], total: 1, offset: 0, limit: 20 };
    });
    const { container, cleanup } = await renderPage("/dashboard/prospects?tab=ignored");
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockListProspects).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ignored" })
    );
    expect(container.querySelector('[data-testid="prospect-restore-p-ign"]')).toBeTruthy();
    await cleanup();
  });

  it("filters automatic tab", async () => {
    mockListProspects.mockImplementation(async ({ status }) => {
      if (status === "automatic") {
        return {
          items: [
            {
              ...SAMPLE,
              id: "p-auto",
              email: "noreply@x.com",
              status: "automatic",
              noiseClass: "noreply",
            },
          ],
          total: 1,
          offset: 0,
          limit: 20,
        };
      }
      return { items: [], total: 0, offset: 0, limit: 20 };
    });
    const { container, cleanup } = await renderPage("/dashboard/prospects?tab=automatic");
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockListProspects).toHaveBeenCalledWith(
      expect.objectContaining({ status: "automatic", includeAutomatic: true })
    );
    expect(container.querySelector('[data-testid="prospect-card-p-auto"]')).toBeTruthy();
    await cleanup();
  });

  it("paginates with load more", async () => {
    const page1 = Array.from({ length: 20 }, (_, i) => ({
      ...SAMPLE,
      id: `p-${i}`,
      email: `u${i}@ex.fr`,
    }));
    mockListProspects.mockImplementation(async ({ offset }) => {
      if (offset === 0) return { items: page1, total: 25, offset: 0, limit: 20 };
      return {
        items: [{ ...SAMPLE, id: "p-20", email: "u20@ex.fr" }],
        total: 25,
        offset: 20,
        limit: 20,
      };
    });
    mockGetProspectsCount.mockResolvedValue({ total: 25 });
    const { container, cleanup } = await renderPage();
    const loadMore = container.querySelector('[data-testid="prospects-load-more"]');
    expect(loadMore).toBeTruthy();
    await act(async () => {
      loadMore.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockListProspects).toHaveBeenCalledWith(expect.objectContaining({ offset: 20 }));
    expect(container.querySelector('[data-testid="prospect-card-p-20"]')).toBeTruthy();
    await cleanup();
  });

  it("opens detail drawer", async () => {
    const { container, cleanup } = await renderPage();
    const treat = container.querySelector('[data-testid="prospect-treat-prospect-1"]');
    await act(async () => {
      treat.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockGetProspect).toHaveBeenCalledWith("prospect-1");
    const drawer = document.querySelector('[data-testid="prospect-detail-drawer"]');
    expect(drawer).toBeTruthy();
    expect(drawer.textContent).toMatch(/Échanges|Demande de devis|Paul Inconnu/);
    await cleanup();
  });

  it("associates a prospect to a client without double-submit", async () => {
    let resolveAssociate;
    mockAssociateProspect.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAssociate = resolve;
        })
    );
    const { container, cleanup } = await renderPage();
    await act(async () => {
      container
        .querySelector('[data-testid="prospect-treat-prospect-1"]')
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      document
        .querySelector('[data-testid="prospect-detail-associate"]')
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    const option = document.querySelector('[data-testid="associate-client-option-client-1"]');
    expect(option).toBeTruthy();
    await act(async () => {
      option.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    const confirm = document.querySelector('[data-testid="associate-client-confirm"]');
    expect(confirm).toBeTruthy();
    await act(async () => {
      confirm.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      confirm.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      confirm.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(mockAssociateProspect).toHaveBeenCalledTimes(1);
    expect(mockAssociateProspect).toHaveBeenCalledWith("prospect-1", "client-1");
    await act(async () => {
      resolveAssociate({
        prospectId: SAMPLE.id,
        clientId: "client-1",
        clientName: "Client Cible",
        linkedCommunications: 2,
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(toast.success).toHaveBeenCalled();
    await cleanup();
  });

  it("creates a client from prospect, refreshes counters and navigates to fiche", async () => {
    mockCreateClientFromProspect.mockResolvedValue({
      prospectId: "prospect-1",
      client: { id: "client-new-1", email: "inconnu@exemple.fr", name: "Paul Inconnu" },
      association: { linkedCommunications: 2 },
      duplicateClientId: null,
    });
    const { container, cleanup } = await renderPage();
    await act(async () => {
      container
        .querySelector('[data-testid="prospect-treat-prospect-1"]')
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      document
        .querySelector('[data-testid="prospect-detail-create"]')
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    const nameInput = document.querySelector('[data-testid="create-from-email-name"]');
    expect(nameInput).toBeTruthy();
    const form = nameInput.closest("form");
    expect(form).toBeTruthy();
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockCreateClientFromProspect).toHaveBeenCalledWith(
      "prospect-1",
      expect.objectContaining({ email: "inconnu@exemple.fr" })
    );
    expect(mockInvalidateActions).toHaveBeenCalled();
    expect(document.querySelector('[data-testid="client-dest"]')).toBeTruthy();
    await cleanup();
  });

  it("ignores and restores a prospect", async () => {
    mockListProspects.mockImplementation(async ({ status }) => {
      if (status === "ignored") {
        return {
          items: [{ ...SAMPLE, id: "prospect-1", status: "ignored" }],
          total: 1,
          offset: 0,
          limit: 20,
        };
      }
      return { items: [SAMPLE], total: 1, offset: 0, limit: 20 };
    });

    const { container, cleanup } = await renderPage();
    await act(async () => {
      container
        .querySelector('[data-testid="prospect-treat-prospect-1"]')
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      document
        .querySelector('[data-testid="prospect-detail-ignore"]')
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    const confirmIgnore = document.querySelector('[data-testid="prospect-ignore-confirm"]');
    expect(confirmIgnore).toBeTruthy();
    await act(async () => {
      document
        .querySelector('[data-testid="prospect-ignore-confirm-btn"]')
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockIgnoreProspect).toHaveBeenCalledWith("prospect-1");
    await cleanup();

    const { container: ignoredContainer, cleanup: cleanupIgnored } = await renderPage(
      "/dashboard/prospects?tab=ignored"
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const restore = ignoredContainer.querySelector('[data-testid="prospect-restore-prospect-1"]');
    expect(restore).toBeTruthy();
    await act(async () => {
      restore.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockRestoreProspect).toHaveBeenCalledWith("prospect-1");
    await cleanupIgnored();
  });
});
