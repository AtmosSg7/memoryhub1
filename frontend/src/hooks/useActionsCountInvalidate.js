/**
 * Lightweight pub/sub so Action Center badges refresh after prospect convert / CI accept.
 */

const listeners = new Set();

export function invalidateActionsPendingCount() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore listener errors */
    }
  });
}

export function subscribeActionsPendingCount(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
