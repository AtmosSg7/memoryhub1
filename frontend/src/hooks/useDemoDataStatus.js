import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

async function fetchDemoStatus() {
  try {
    const { res, data } = await apiFetch("/api/dev/demo-status");
    if (!res.ok) return { hasDemoData: false };
    return { hasDemoData: Boolean(data?.hasDemoData), seedTag: data?.seedTag || null };
  } catch {
    return { hasDemoData: false };
  }
}

/**
 * Local/dev only — the /api/dev/demo-status route is not mounted when deployed.
 */
export function useDemoDataStatus() {
  const query = useQuery({
    queryKey: ["demo-data-status"],
    queryFn: fetchDemoStatus,
    staleTime: 60_000,
    retry: false,
  });

  return {
    hasDemoData: Boolean(query.data?.hasDemoData),
    seedTag: query.data?.seedTag || null,
    loading: query.isLoading,
  };
}
