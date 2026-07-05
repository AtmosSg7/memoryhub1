import { createContext, useCallback, useContext, useMemo, useState } from "react";



const AddInvoiceContext = createContext(null);



export function AddInvoiceProvider({ children }) {

  const [isOpen, setIsOpen] = useState(false);

  const [editingInvoice, setEditingInvoice] = useState(null);

  const [prefillClient, setPrefillClient] = useState(null);

  const [refreshKey, setRefreshKey] = useState(0);



  const openAddInvoice = useCallback((client = null) => {

    setEditingInvoice(null);

    setPrefillClient(client);

    setIsOpen(true);

  }, []);



  const openEditInvoice = useCallback((invoice) => {

    setEditingInvoice(invoice);

    setPrefillClient(null);

    setIsOpen(true);

  }, []);



  const closeAddInvoice = useCallback(() => {

    setIsOpen(false);

    setEditingInvoice(null);

    setPrefillClient(null);

  }, []);



  const notifyInvoicesChanged = useCallback(() => {

    setRefreshKey((key) => key + 1);

  }, []);



  const value = useMemo(

    () => ({

      isOpen,

      editingInvoice,

      prefillClient,

      refreshKey,

      openAddInvoice,

      openEditInvoice,

      closeAddInvoice,

      notifyInvoicesChanged,

    }),

    [isOpen, editingInvoice, prefillClient, refreshKey, openAddInvoice, openEditInvoice, closeAddInvoice, notifyInvoicesChanged]

  );



  return <AddInvoiceContext.Provider value={value}>{children}</AddInvoiceContext.Provider>;

}



export function useAddInvoice() {

  const ctx = useContext(AddInvoiceContext);

  if (!ctx) throw new Error("useAddInvoice must be used within AddInvoiceProvider");

  return ctx;

}


