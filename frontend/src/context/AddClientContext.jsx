import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useIsShowcaseDemo } from "@/context/ShowcaseThemeIsolation";

const AddClientContext = createContext(null);

export function AddClientProvider({ children }) {
  const isShowcase = useIsShowcaseDemo();
  const [isOpen, setIsOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastCreatedClient, setLastCreatedClient] = useState(null);
  const [chainAfterCreate, setChainAfterCreate] = useState(null);

  const openAddClient = useCallback(
    (chain = null) => {
      if (isShowcase) return;
      setEditingClient(null);
      setChainAfterCreate(typeof chain === "string" ? chain : null);
      setIsOpen(true);
    },
    [isShowcase]
  );

  const openEditClient = useCallback(
    (client) => {
      if (isShowcase) return;
      setEditingClient(client);
      setChainAfterCreate(null);
      setIsOpen(true);
    },
    [isShowcase]
  );

  const closeAddClient = useCallback(() => {
    setIsOpen(false);
    setEditingClient(null);
    setChainAfterCreate(null);
  }, []);

  const notifyClientsChanged = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const registerCreatedClient = useCallback((client) => {
    setLastCreatedClient(client);
  }, []);

  const clearLastCreatedClient = useCallback(() => {
    setLastCreatedClient(null);
  }, []);

  const value = useMemo(
    () => ({
      isOpen: isShowcase ? false : isOpen,
      editingClient: isShowcase ? null : editingClient,
      refreshKey,
      lastCreatedClient,
      chainAfterCreate,
      openAddClient,
      openEditClient,
      closeAddClient,
      notifyClientsChanged,
      registerCreatedClient,
      clearLastCreatedClient,
    }),
    [
      isShowcase,
      isOpen,
      editingClient,
      refreshKey,
      lastCreatedClient,
      chainAfterCreate,
      openAddClient,
      openEditClient,
      closeAddClient,
      notifyClientsChanged,
      registerCreatedClient,
      clearLastCreatedClient,
    ]
  );

  return (
    <AddClientContext.Provider value={value}>{children}</AddClientContext.Provider>
  );
}

export function useAddClient() {
  const ctx = useContext(AddClientContext);
  if (!ctx) {
    throw new Error("useAddClient must be used within AddClientProvider");
  }
  return ctx;
}
