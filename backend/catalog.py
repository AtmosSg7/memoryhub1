import re
from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from auth import get_current_user, get_db
from catalog_indexer import ensure_catalog_backfilled, normalize_catalog_description
from catalog_models import CatalogItemPublic, CatalogListResponse, CatalogStatsResponse

catalog_router = APIRouter(prefix="/catalog", tags=["catalog"])

CATALOG_PROJECTION = {"_id": 0, "userId": 0, "normalizedKey": 0, "unitPriceHTSum": 0, "vatRateCounts": 0}
DEFAULT_LIST_LIMIT = 100
MAX_LIST_LIMIT = 200
DEFAULT_SUGGEST_LIMIT = 10
MAX_SUGGEST_LIMIT = 25
TOP_MOST_USED = 5


def _user_filter(user_id: str) -> dict:
    return {"userId": user_id}


def catalog_item_public(doc: dict) -> CatalogItemPublic:
    return CatalogItemPublic(
        id=doc["id"],
        description=doc["description"],
        usageCount=doc.get("usageCount", 0),
        lastUsedAt=doc.get("lastUsedAt") or doc.get("updatedAt") or doc.get("createdAt", ""),
        unitPriceHTMin=doc.get("unitPriceHTMin", 0),
        unitPriceHTMax=doc.get("unitPriceHTMax", 0),
        unitPriceHTAvg=doc.get("unitPriceHTAvg", 0),
        defaultVatRate=doc.get("defaultVatRate", 20),
        source=doc.get("source", "learned"),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    )


@catalog_router.get("", response_model=CatalogListResponse)
async def list_catalog_items(
    limit: int = Query(DEFAULT_LIST_LIMIT, ge=1, le=MAX_LIST_LIMIT),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    query = _user_filter(current_user["id"])
    await ensure_catalog_backfilled(db, current_user["id"])
    total = await db.catalog_items.count_documents(query)
    cursor = db.catalog_items.find(query, CATALOG_PROJECTION).sort("lastUsedAt", -1).limit(limit)
    items = [catalog_item_public(doc) async for doc in cursor]
    return CatalogListResponse(items=items, total=total)


@catalog_router.get("/suggest", response_model=CatalogListResponse)
async def suggest_catalog_items(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(DEFAULT_SUGGEST_LIMIT, ge=1, le=MAX_SUGGEST_LIMIT),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    normalized = normalize_catalog_description(q)
    tokens = [token for token in normalized.split(" ") if token]
    if not tokens:
        return CatalogListResponse(items=[], total=0)

    await ensure_catalog_backfilled(db, current_user["id"])
    regex_parts = [re.escape(token) for token in tokens]
    pattern = ".*".join(regex_parts)
    query = {
        **_user_filter(current_user["id"]),
        "normalizedKey": {"$regex": pattern, "$options": "i"},
    }
    total = await db.catalog_items.count_documents(query)
    cursor = db.catalog_items.find(query, CATALOG_PROJECTION).sort(
        [("usageCount", -1), ("lastUsedAt", -1)]
    ).limit(limit)
    items = [catalog_item_public(doc) async for doc in cursor]
    return CatalogListResponse(items=items, total=total)


@catalog_router.get("/stats", response_model=CatalogStatsResponse)
async def catalog_stats(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    query = _user_filter(current_user["id"])
    await ensure_catalog_backfilled(db, current_user["id"])
    total_items = await db.catalog_items.count_documents(query)

    pipeline = [
        {"$match": query},
        {
            "$group": {
                "_id": None,
                "totalUsages": {"$sum": "$usageCount"},
            }
        },
    ]
    aggregate = [doc async for doc in db.catalog_items.aggregate(pipeline)]
    total_usages = int(aggregate[0]["totalUsages"]) if aggregate else 0
    average_usage = round(total_usages / total_items, 2) if total_items else 0.0

    most_used_docs: List[dict] = []
    cursor = db.catalog_items.find(query, CATALOG_PROJECTION).sort(
        [("usageCount", -1), ("lastUsedAt", -1)]
    ).limit(TOP_MOST_USED)
    async for doc in cursor:
        most_used_docs.append(doc)

    return CatalogStatsResponse(
        totalItems=total_items,
        totalUsages=total_usages,
        averageUsagePerItem=average_usage,
        mostUsed=[catalog_item_public(doc) for doc in most_used_docs],
    )
