import { createContext, useCallback, useContext, useMemo, useState } from "react";

const AddNoteContext = createContext(null);

export function AddNoteProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [prefillClient, setPrefillClient] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const openAddNote = useCallback((client = null) => {
    setEditingNote(null);
    setPrefillClient(client);
    setIsOpen(true);
  }, []);

  const openEditNote = useCallback((note) => {
    setEditingNote(note);
    setPrefillClient(null);
    setIsOpen(true);
  }, []);

  const closeAddNote = useCallback(() => {
    setIsOpen(false);
    setEditingNote(null);
    setPrefillClient(null);
  }, []);

  const notifyNotesChanged = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      editingNote,
      prefillClient,
      refreshKey,
      openAddNote,
      openEditNote,
      closeAddNote,
      notifyNotesChanged,
    }),
    [
      isOpen,
      editingNote,
      prefillClient,
      refreshKey,
      openAddNote,
      openEditNote,
      closeAddNote,
      notifyNotesChanged,
    ]
  );

  return (
    <AddNoteContext.Provider value={value}>{children}</AddNoteContext.Provider>
  );
}

export function useAddNote() {
  const ctx = useContext(AddNoteContext);
  if (!ctx) {
    throw new Error("useAddNote must be used within AddNoteProvider");
  }
  return ctx;
}
