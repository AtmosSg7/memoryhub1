import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useIsShowcaseDemo } from "@/context/ShowcaseThemeIsolation";

const AddInvoiceContext = createContext(null);

export function AddInvoiceProvider({ children }) {
  const isShowcase = useIsShowcaseDemo();
  const [isOpen, setIsOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [prefillClient, setPrefillClient] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingOpenInvoice, setPendingOpenInvoice] = useState(null);

  const openAddInvoice = useCallback(
    (client = null) => {
      if (isShowcase) return;
      setEditingInvoice(null);
      setPrefillClient(client);
      setIsOpen(true);
    },
    [isShowcase]
  );

  const openEditInvoice = useCallback(
    (invoice) => {
      if (isShowcase) return;
      setEditingInvoice(invoice);
      setPrefillClient(null);
      setIsOpen(true);
    },
    [isShowcase]
  );

  const closeAddInvoice = useCallback(() => {
    setIsOpen(false);
    setEditingInvoice(null);
    setPrefillClient(null);
  }, []);

  const notifyInvoicesChanged = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const queueOpenInvoice = useCallback((invoice) => {
    setPendingOpenInvoice(invoice);
  }, []);

  const clearPendingOpenInvoice = useCallback(() => {
    setPendingOpenInvoice(null);
  }, []);

  const value = useMemo(
    () => ({
      isOpen: isShowcase ? false : isOpen,
      editingInvoice: isShowcase ? null : editingInvoice,
      prefillClient,
      refreshKey,
      pendingOpenInvoice,
      openAddInvoice,
      openEditInvoice,
      closeAddInvoice,
      notifyInvoicesChanged,
      queueOpenInvoice,
      clearPendingOpenInvoice,
    }),
    [
      isShowcase,
      isOpen,
      editingInvoice,
      prefillClient,
      refreshKey,
      pendingOpenInvoice,
      openAddInvoice,
      openEditInvoice,
      closeAddInvoice,
      notifyInvoicesChanged,
      queueOpenInvoice,
      clearPendingOpenInvoice,
    ]
  );

  return <AddInvoiceContext.Provider value={value}>{children}</AddInvoiceContext.Provider>;
}

export function useAddInvoice() {
  const ctx = useContext(AddInvoiceContext);
  if (!ctx) throw new Error("useAddInvoice must be used within AddInvoiceProvider");
  return ctx;
}
