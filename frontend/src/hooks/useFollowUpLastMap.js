import { useCallback, useEffect, useState } from "react";
import { getLastFollowUps } from "@/lib/followUpsApi";
import { useFollowUpContext } from "@/context/FollowUpContext";

export function useFollowUpLastMap(entityType, entities) {
  const { refreshKey } = useFollowUpContext();
  const idsKey = (entities || []).map((item) => item?.id).filter(Boolean).join(",");

  const [items, setItems] = useState({});

  const refetch = useCallback(async () => {
    if (!entityType || !idsKey) {
      setItems((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    const entityIds = idsKey.split(",");
    try {
      const data = await getLastFollowUps({ entityType, entityIds });
      setItems(data.items || {});
    } catch {
      setItems((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    }
  }, [entityType, idsKey]);

  useEffect(() => {
    refetch();
  }, [refetch, refreshKey]);

  return { items, getLast: (entityId) => items[entityId] || null };
}
