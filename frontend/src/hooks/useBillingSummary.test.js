/**
 * @jest-environment jsdom
 */

jest.mock("@/lib/billingApi", () => ({
  fetchBillingMe: jest.fn(),
}));

const { fetchBillingMe } = require("@/lib/billingApi");
const {
  resolveSubscriptionPlanLabel,
  setBillingCache,
  invalidateBillingCache,
} = require("@/hooks/useBillingSummary");

function t(key) {
  return key;
}

describe("resolveSubscriptionPlanLabel", () => {
  it("prefers the real plan name when planId is present (including active Stripe)", () => {
    expect(
      resolveSubscriptionPlanLabel(
        { planId: "solo", subscriptionStatus: "active", hasSubscription: true },
        t
      )
    ).toBe("billingPage.plans.solo");
  });

  it("does not show trial when cache is empty", () => {
    expect(resolveSubscriptionPlanLabel(null, t)).toBe("sidebar.subscription.none");
  });

  it("shows trial only when status is trial and planId is missing", () => {
    expect(
      resolveSubscriptionPlanLabel({ subscriptionStatus: "trial", hasSubscription: true }, t)
    ).toBe("sidebar.subscription.trial");
  });

  it("shows plan name during a local trial when planId is set", () => {
    expect(
      resolveSubscriptionPlanLabel(
        { planId: "solo", subscriptionStatus: "trial", hasSubscription: true },
        t
      )
    ).toBe("billingPage.plans.solo");
  });
});

describe("billing shared cache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setBillingCache(null);
  });

  it("invalidateBillingCache reloads when listeners are registered", async () => {
    fetchBillingMe.mockResolvedValue({
      hasSubscription: true,
      planId: "team",
      subscriptionStatus: "active",
    });

    let latest = null;
    const { useBillingSummary } = require("@/hooks/useBillingSummary");
    // Manually attach via hook module internals: call invalidate with a fake listener path
    // by mounting through React like BillingPage tests.
    const React = require("react");
    const { act } = require("react");
    const { createRoot } = require("react-dom/client");

    function Probe() {
      latest = useBillingSummary();
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    global.IS_REACT_ACT_ENVIRONMENT = true;

    await act(async () => {
      root.render(React.createElement(Probe));
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest.planId).toBe("team");

    fetchBillingMe.mockResolvedValue({
      hasSubscription: true,
      planId: "pro",
      subscriptionStatus: "active",
    });

    await act(async () => {
      invalidateBillingCache();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest.planId).toBe("pro");
    expect(fetchBillingMe.mock.calls.length).toBeGreaterThanOrEqual(2);

    await act(async () => root.unmount());
    container.remove();
  });
});
