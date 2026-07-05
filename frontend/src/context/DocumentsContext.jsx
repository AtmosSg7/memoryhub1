import { createContext, useCallback, useContext, useMemo, useState } from "react";

const DocumentsContext = createContext(null);

export function DocumentsProvider({ children }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const notifyDocumentsChanged = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const value = useMemo(
    () => ({
      refreshKey,
      notifyDocumentsChanged,
    }),
    [refreshKey, notifyDocumentsChanged]
  );

  return (
    <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>
  );
}

export function useDocumentsContext() {
  const ctx = useContext(DocumentsContext);
  if (!ctx) {
    throw new Error("useDocumentsContext must be used within DocumentsProvider");
  }
  return ctx;
}
