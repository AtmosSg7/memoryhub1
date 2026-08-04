import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useIsShowcaseDemo } from "@/context/ShowcaseThemeIsolation";

const AddQuoteContext = createContext(null);

export function AddQuoteProvider({ children }) {
  const isShowcase = useIsShowcaseDemo();
  const [isOpen, setIsOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [prefillClient, setPrefillClient] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingOpenQuote, setPendingOpenQuote] = useState(null);

  const openAddQuote = useCallback(
    (client = null) => {
      if (isShowcase) return;
      setEditingQuote(null);
      setPrefillClient(client);
      setIsOpen(true);
    },
    [isShowcase]
  );

  const openEditQuote = useCallback(
    (quote) => {
      if (isShowcase) return;
      setEditingQuote(quote);
      setPrefillClient(null);
      setIsOpen(true);
    },
    [isShowcase]
  );

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
      isOpen: isShowcase ? false : isOpen,
      editingQuote: isShowcase ? null : editingQuote,
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
      isShowcase,
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
