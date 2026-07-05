import { useEffect, useRef, useState } from "react";
import { searchGlobal } from "@/lib/searchApi";

export const SEARCH_MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

export function useSearch(query, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    const trimmed = (query || "").trim();

    if (!enabled || trimmed.length < SEARCH_MIN_CHARS) {
      setData(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const result = await searchGlobal(trimmed, controller.signal);
        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch (err) {
        if (err.name === "AbortError" || controller.signal.aborted) return;
        setError(err.message || "Search failed.");
        setData(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query, enabled]);

  return { data, loading, error, minChars: SEARCH_MIN_CHARS };
}
