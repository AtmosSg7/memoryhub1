import { createContext, useCallback, useContext, useMemo, useState } from "react";

const AddClientContext = createContext(null);

export function AddClientProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const openAddClient = useCallback(() => {
    setEditingClient(null);
    setIsOpen(true);
  }, []);

  const openEditClient = useCallback((client) => {
    setEditingClient(client);
    setIsOpen(true);
  }, []);

  const closeAddClient = useCallback(() => {
    setIsOpen(false);
    setEditingClient(null);
  }, []);

  const notifyClientsChanged = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      editingClient,
      refreshKey,
      openAddClient,
      openEditClient,
      closeAddClient,
      notifyClientsChanged,
    }),
    [
      isOpen,
      editingClient,
      refreshKey,
      openAddClient,
      openEditClient,
      closeAddClient,
      notifyClientsChanged,
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
