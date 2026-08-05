/**
 * @jest-environment jsdom
 */

jest.mock("@/lib/billingApi", () => ({
  fetchBillingMe: jest.fn(),
}));

const { fetchBillingMe } = require("@/lib/billingApi");
const { setBillingCache, invalidateBillingCache, useBillingSummary } = require("@/hooks/useBillingSummary");
const { LanguageProvider } = require("@/context/LanguageContext");
const React = require("react");
const { act } = require("react");
const { createRoot } = require("react-dom/client");

async function mountHookConsumer() {
  let latest = null;
  function Probe() {
    latest = useBillingSummary();
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(LanguageProvider, null, React.createElement(Probe)));
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return {
    get latest() {
      return latest;
    },
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("useBillingSummary shared cache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setBillingCache(null);
    global.IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.setItem("mh-lang", "fr");
  });

  it("two consumers share the same view model from one fetch", async () => {
    fetchBillingMe.mockResolvedValue({
      hasSubscription: true,
      planId: "solo",
      subscriptionStatus: "cancelled",
      cancelAtPeriodEnd: false,
      monthlyAnalysesRemaining: 0,
      monthlyAnalysesAllocated: 10,
      actions: {},
    });

    const a = await mountHookConsumer();
    const b = await mountHookConsumer();

    expect(fetchBillingMe).toHaveBeenCalledTimes(1);
    expect(a.latest.view.widgetLabel).toMatch(/Annulé/i);
    expect(b.latest.view.summaryTitle).toMatch(/Annulé/i);
    expect(a.latest.view.widgetLabel).toBe(b.latest.view.summaryTitle);
    expect(a.latest.view.isCurrentOfferPlan("solo")).toBe(false);

    await a.cleanup();
    await b.cleanup();
  });

  it("invalidateBillingCache reloads for mounted listeners", async () => {
    fetchBillingMe.mockResolvedValue({
      hasSubscription: true,
      planId: "team",
      subscriptionStatus: "active",
      actions: {},
    });

    const probe = await mountHookConsumer();
    expect(probe.latest.view.summaryTitle).toMatch(/Business|team/i);

    fetchBillingMe.mockResolvedValue({
      hasSubscription: true,
      planId: "pro",
      subscriptionStatus: "active",
      actions: {},
    });

    await act(async () => {
      invalidateBillingCache();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(probe.latest.view.planId).toBe("pro");
    await probe.cleanup();
  });
});
