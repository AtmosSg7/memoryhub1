import { createContext, useCallback, useContext, useMemo, useState } from "react";

const AddQuoteContext = createContext(null);

export function AddQuoteProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [prefillClient, setPrefillClient] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingOpenQuote, setPendingOpenQuote] = useState(null);

  const openAddQuote = useCallback((client = null) => {
    setEditingQuote(null);
    setPrefillClient(client);
    setIsOpen(true);
  }, []);

  const openEditQuote = useCallback((quote) => {
    setEditingQuote(quote);
    setPrefillClient(null);
    setIsOpen(true);
  }, []);

  const closeAddQuote = useCallback(() => {
    setIsOpen(false);
    setEditingQuote(null);
    setPrefillClient(null);
  }, []);

  const notifyQuotesChanged = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const queueOpenQuote = useCallback((quote) => {
    setPendingOpenQuote(quote);
  }, []);

  const clearPendingOpenQuote = useCallback(() => {
    setPendingOpenQuote(null);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      editingQuote,
      prefillClient,
      refreshKey,
      pendingOpenQuote,
      openAddQuote,
      openEditQuote,
      closeAddQuote,
      notifyQuotesChanged,
      queueOpenQuote,
      clearPendingOpenQuote,
    }),
    [
      isOpen,
      editingQuote,
      prefillClient,
      refreshKey,
      pendingOpenQuote,
      openAddQuote,
      openEditQuote,
      closeAddQuote,
      notifyQuotesChanged,
      queueOpenQuote,
      clearPendingOpenQuote,
    ]
  );

  return <AddQuoteContext.Provider value={value}>{children}</AddQuoteContext.Provider>;
}

export function useAddQuote() {
  const ctx = useContext(AddQuoteContext);
  if (!ctx) throw new Error("useAddQuote must be used within AddQuoteProvider");
  return ctx;
}
