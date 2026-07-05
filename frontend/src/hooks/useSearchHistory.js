import { useCallback, useState } from "react";

const STORAGE_KEY = "memoryhub:searchHistory";
const MAX_HISTORY = 10;

function readHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState(readHistory);

  const addSearch = useCallback(
    (query) => {
      const trimmed = (query || "").trim();
      if (trimmed.length < 3) return;
      setHistory((prev) => {
        const next = [
          trimmed,
          ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
        ].slice(0, MAX_HISTORY);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const removeSearch = useCallback(
    (query) => {
      setHistory((prev) => {
        const next = prev.filter((item) => item !== query);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  return { history, addSearch, removeSearch, clearHistory, maxHistory: MAX_HISTORY };
}
