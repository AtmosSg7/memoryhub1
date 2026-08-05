/**
 * @jest-environment jsdom
 */

const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const React = require("react");
const { act } = require("react");
const { createRoot } = require("react-dom/client");
const { MemoryRouter } = require("react-router-dom");
const { LanguageProvider } = require("@/context/LanguageContext");

const mockFetchBillingMe = jest.fn();
const mockStartCheckout = jest.fn();

jest.mock("@/lib/billingApi", () => ({
  fetchBillingMe: (...args) => mockFetchBillingMe(...args),
  startCheckout: (...args) => mockStartCheckout(...args),
  openBillingPortal: jest.fn(),
  changeBillingPlan: jest.fn(),
}));

jest.mock("@/hooks/useBillingSummary", () => ({
  setBillingCache: jest.fn(),
  invalidateBillingCache: jest.fn(),
}));

jest.mock("@/hooks/useCredits", () => ({
  invalidateCreditsCache: jest.fn(),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "julien@atelier-demo.fr", companyName: "Atelier Moreau", firstName: "Julien" },
  }),
}));

jest.mock("@/hooks/usePageTitle", () => ({
  usePageTitle: () => {},
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), message: jest.fn() },
}));

const { default: BillingPage } = require("@/pages/dashboard/BillingPage");

async function renderBilling() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(LanguageProvider, null, React.createElement(BillingPage, null))
      )
    );
  });
  await act(async () => {
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

describe("BillingPage checkout CTAs", () => {
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.setItem("mh-lang", "fr");
    jest.clearAllMocks();
  });

  it("shows choose buttons for each plan during a local trial", async () => {
    mockFetchBillingMe.mockResolvedValue({
      hasSubscription: true,
      planId: "solo",
      subscriptionStatus: "trial",
      trialEndsAt: "2026-08-18T00:00:00.000Z",
      stripeConfigured: true,
      stripeTestMode: true,
      availablePlans: ["solo", "pro", "team"],
      monthlyAnalysesRemaining: 10,
      monthlyAnalysesAllocated: 10,
      actions: {
        canCheckout: true,
        canManage: false,
        canChangePlan: false,
        canUpgrade: false,
        canDowngrade: false,
        canCancel: false,
      },
    });

    const { container, cleanup } = await renderBilling();

    expect(container.querySelector('[data-testid="billing-checkout-solo"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="billing-checkout-pro"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="billing-checkout-team"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="billing-checkout-solo"]').textContent).toMatch(
      /Choisir Starter/
    );
    expect(container.querySelector('[data-testid="billing-checkout-pro"]').textContent).toMatch(
      /Choisir Pro/
    );
    expect(container.querySelector('[data-testid="billing-checkout-team"]').textContent).toMatch(
      /Choisir Business/
    );

    await cleanup();
  });

  it("starts Stripe Checkout with the internal plan id", async () => {
    mockFetchBillingMe.mockResolvedValue({
      hasSubscription: true,
      planId: "solo",
      subscriptionStatus: "trial",
      stripeConfigured: true,
      availablePlans: ["solo", "pro", "team"],
      monthlyAnalysesRemaining: 10,
      monthlyAnalysesAllocated: 10,
      actions: {
        canCheckout: true,
        canManage: false,
        canChangePlan: false,
      },
    });
    mockStartCheckout.mockResolvedValue({ checkoutUrl: "https://checkout.stripe.test/cs_test" });
    delete window.location;
    window.location = { href: "" };

    const { container, cleanup } = await renderBilling();
    const proBtn = container.querySelector('[data-testid="billing-checkout-pro"]');
    await act(async () => {
      proBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(mockStartCheckout).toHaveBeenCalledWith("pro");
    expect(window.location.href).toBe("https://checkout.stripe.test/cs_test");

    await cleanup();
  });
});
