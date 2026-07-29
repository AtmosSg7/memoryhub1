import { useCallback, useEffect, useState } from "react";
import { getLastFollowUps } from "@/lib/followUpsApi";
import { useFollowUpContext } from "@/context/FollowUpContext";

const BATCH_SIZE = 100;

async function fetchFollowUpBatches(entityType, entityIds) {
  const merged = {};
  for (let index = 0; index < entityIds.length; index += BATCH_SIZE) {
    const chunk = entityIds.slice(index, index + BATCH_SIZE);
    const data = await getLastFollowUps({ entityType, entityIds: chunk });
    Object.assign(merged, data.items || {});
  }
  return merged;
}

export function useFollowUpLastMap(entityType, entities, { enabled = true } = {}) {
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
      const data = await fetchFollowUpBatches(entityType, entityIds);
      setItems(data);
    } catch {
      setItems((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    }
  }, [entityType, idsKey]);

  useEffect(() => {
    if (!enabled) return;
    refetch();
  }, [enabled, refetch, refreshKey]);

  return { items, getLast: (entityId) => items[entityId] || null };
}
