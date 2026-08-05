/**
 * @jest-environment jsdom
 */

jest.mock("@/lib/billingApi", () => ({
  fetchBillingMe: jest.fn(),
}));

const { fetchBillingMe } = require("@/lib/billingApi");
const { setBillingCache, invalidateBillingCache } = require("@/hooks/useBillingSummary");

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
