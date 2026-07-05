import { useCallback, useEffect, useState } from "react";
import { getCatalogStats, listCatalogItems, suggestCatalogItems } from "@/lib/catalogApi";

export function useCatalog(searchQuery = "") {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const trimmed = searchQuery.trim();
      const [catalogData, statsData] = await Promise.all([
        trimmed ? suggestCatalogItems(trimmed) : listCatalogItems(),
        getCatalogStats(),
      ]);
      setItems(catalogData.items || []);
      setTotal(catalogData.total ?? 0);
      setStats(statsData);
    } catch (err) {
      setError(err.message || "Failed to load catalog.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, searchQuery.trim() ? 250 : 0);
    return () => clearTimeout(timer);
  }, [refetch, searchQuery]);

  return { items, total, stats, loading, error, refetch };
}
