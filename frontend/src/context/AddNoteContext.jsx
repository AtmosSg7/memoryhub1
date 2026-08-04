import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useIsShowcaseDemo } from "@/context/ShowcaseThemeIsolation";

const AddNoteContext = createContext(null);

export function AddNoteProvider({ children }) {
  const isShowcase = useIsShowcaseDemo();
  const [isOpen, setIsOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [prefillClient, setPrefillClient] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const openAddNote = useCallback(
    (client = null) => {
      if (isShowcase) return;
      setEditingNote(null);
      setPrefillClient(client);
      setIsOpen(true);
    },
    [isShowcase]
  );

  const openEditNote = useCallback(
    (note) => {
      if (isShowcase) return;
      setEditingNote(note);
      setPrefillClient(null);
      setIsOpen(true);
    },
    [isShowcase]
  );

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
      isOpen: isShowcase ? false : isOpen,
      editingNote: isShowcase ? null : editingNote,
      prefillClient,
      refreshKey,
      openAddNote,
      openEditNote,
      closeAddNote,
      notifyNotesChanged,
    }),
    [
      isShowcase,
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

  return <AddNoteContext.Provider value={value}>{children}</AddNoteContext.Provider>;
}

export function useAddNote() {
  const ctx = useContext(AddNoteContext);
  if (!ctx) throw new Error("useAddNote must be used within AddNoteProvider");
  return ctx;
}
