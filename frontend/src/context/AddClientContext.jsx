import { createContext, useCallback, useContext, useMemo, useState } from "react";

const AddClientContext = createContext(null);

export function AddClientProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastCreatedClient, setLastCreatedClient] = useState(null);
  const [chainAfterCreate, setChainAfterCreate] = useState(null);

  const openAddClient = useCallback((chain = null) => {
    setEditingClient(null);
    setChainAfterCreate(typeof chain === "string" ? chain : null);
    setIsOpen(true);
  }, []);

  const openEditClient = useCallback((client) => {
    setEditingClient(client);
    setChainAfterCreate(null);
    setIsOpen(true);
  }, []);

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
    }),
    [
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
