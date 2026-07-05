import { useCallback, useEffect, useState } from "react";
import { listNotes } from "@/lib/notesApi";
import { useAddNote } from "@/context/AddNoteContext";

export function useClientNotes(clientId, typeFilter = "") {
  const { refreshKey } = useAddNote();
  const [notes, setNotes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!clientId) {
      setNotes([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await listNotes({
        clientId,
        type: typeFilter || undefined,
      });
      setNotes(data.items || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load notes.");
      setNotes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [clientId, typeFilter]);

  useEffect(() => {
    refetch();
  }, [refetch, refreshKey]);

  return { notes, total, loading, error, refetch };
}
