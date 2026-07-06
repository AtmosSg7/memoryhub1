import { createContext, useCallback, useContext, useMemo, useState } from "react";

const FollowUpContext = createContext(null);

export function FollowUpProvider({ children }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const notifyFollowUpsChanged = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const value = useMemo(
    () => ({ refreshKey, notifyFollowUpsChanged }),
    [refreshKey, notifyFollowUpsChanged],
  );

  return <FollowUpContext.Provider value={value}>{children}</FollowUpContext.Provider>;
}

export function useFollowUpContext() {
  const ctx = useContext(FollowUpContext);
  if (!ctx) throw new Error("useFollowUpContext must be used within FollowUpProvider");
  return ctx;
}
