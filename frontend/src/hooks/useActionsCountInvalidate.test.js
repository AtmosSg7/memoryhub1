import {
  invalidateActionsPendingCount,
  subscribeActionsPendingCount,
} from "./useActionsCountInvalidate";

describe("useActionsCountInvalidate", () => {
  it("notifies subscribers when invalidated", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeActionsPendingCount(listener);
    invalidateActionsPendingCount();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    invalidateActionsPendingCount();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
