import { useCallback, useEffect, useState } from "react";
import { listDuePersonalReminders } from "@/lib/personalRemindersApi";
import { useAddNote } from "@/context/AddNoteContext";

export function usePersonalRemindersDue(limit = 20) {
  const { refreshKey } = useAddNote();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDuePersonalReminders({ limit });
      setItems(data.items || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load personal reminders.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refetch();
  }, [refetch, refreshKey]);

  return { items, total, loading, error, refetch };
}
