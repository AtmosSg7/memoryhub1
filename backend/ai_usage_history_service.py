"""User-facing AI usage history — no operator metrics (tokens, cost, model)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from admin_constants import COLLECTION_AI_USAGE_EVENTS
from analysis_presentation_service import usage_event_to_analyses_public


async def list_user_ai_usage(
    db,
    user_id: str,
    *,
    limit: int = 50,
    offset: int = 0,
    action_key: Optional[str] = None,
) -> Tuple[List[dict], int]:
    query: Dict[str, Any] = {"userId": user_id}
    if action_key:
        query["actionKey"] = action_key

    total = await db[COLLECTION_AI_USAGE_EVENTS].count_documents(query)
    cursor = (
        db[COLLECTION_AI_USAGE_EVENTS]
        .find(query, {"_id": 0})
        .sort("createdAt", -1)
        .skip(max(0, offset))
        .limit(min(limit, 200))
    )
    items = [usage_event_to_analyses_public(doc).model_dump() async for doc in cursor]
    return items, total
