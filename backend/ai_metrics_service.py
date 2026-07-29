"""AI engine observability — aggregates for ops and admin dashboards."""

from __future__ import annotations

from typing import Any, Dict, Optional

from admin_constants import COLLECTION_AI_USAGE_EVENTS
from admin_metrics_service import resolve_period


async def get_ai_engine_metrics(
    db,
    *,
    period: Optional[str] = "30d",
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> Dict[str, Any]:
    _, start_iso, end_iso = resolve_period(
        period=period,
        from_date=from_date,
        to_date=to_date,
    )
    match = {"createdAt": {"$gte": start_iso, "$lte": end_iso}}

    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": None,
                "total": {"$sum": 1},
                "successCount": {"$sum": {"$cond": ["$success", 1, 0]}},
                "failureCount": {"$sum": {"$cond": ["$success", 0, 1]}},
                "avgDurationMs": {"$avg": "$durationMs"},
                "avgCredits": {"$avg": "$creditsConsumed"},
                "avgTokens": {"$avg": "$totalTokens"},
                "totalCredits": {"$sum": {"$cond": [{"$ifNull": ["$creditsConsumed", False]}, "$creditsConsumed", 0]}},
                "totalCostUsd": {
                    "$sum": {
                        "$cond": [
                            {"$and": ["$costKnown", {"$ne": ["$estimatedCostUsd", None]}]},
                            "$estimatedCostUsd",
                            0,
                        ]
                    }
                },
            }
        },
    ]

    summary = {
        "periodStart": start_iso,
        "periodEnd": end_iso,
        "totalAnalyses": 0,
        "successCount": 0,
        "failureCount": 0,
        "failureRate": 0.0,
        "avgDurationMs": None,
        "avgCreditsConsumed": None,
        "avgTokens": None,
        "totalCreditsConsumed": 0,
        "totalEstimatedCostUsd": 0.0,
    }

    async for row in db[COLLECTION_AI_USAGE_EVENTS].aggregate(pipeline):
        total = int(row.get("total") or 0)
        failures = int(row.get("failureCount") or 0)
        summary.update(
            {
                "totalAnalyses": total,
                "successCount": int(row.get("successCount") or 0),
                "failureCount": failures,
                "failureRate": round(failures / total, 4) if total else 0.0,
                "avgDurationMs": round(row["avgDurationMs"], 1) if row.get("avgDurationMs") is not None else None,
                "avgCreditsConsumed": round(row["avgCredits"], 2) if row.get("avgCredits") is not None else None,
                "avgTokens": round(row["avgTokens"], 1) if row.get("avgTokens") is not None else None,
                "totalCreditsConsumed": int(row.get("totalCredits") or 0),
                "totalEstimatedCostUsd": round(float(row.get("totalCostUsd") or 0), 4),
            }
        )

    slow_threshold_ms = 30_000
    expensive_threshold_usd = 0.05

    slow_count = await db[COLLECTION_AI_USAGE_EVENTS].count_documents(
        {**match, "durationMs": {"$gte": slow_threshold_ms}}
    )
    expensive_count = await db[COLLECTION_AI_USAGE_EVENTS].count_documents(
        {
            **match,
            "costKnown": True,
            "estimatedCostUsd": {"$gte": expensive_threshold_usd},
        }
    )

    by_action = []
    action_pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": "$actionKey",
                "count": {"$sum": 1},
                "avgDurationMs": {"$avg": "$durationMs"},
                "avgCredits": {"$avg": "$creditsConsumed"},
                "failures": {"$sum": {"$cond": ["$success", 0, 1]}},
            }
        },
        {"$sort": {"count": -1}},
    ]
    async for row in db[COLLECTION_AI_USAGE_EVENTS].aggregate(action_pipeline):
        by_action.append(
            {
                "actionKey": row["_id"],
                "count": int(row.get("count") or 0),
                "avgDurationMs": round(row["avgDurationMs"], 1) if row.get("avgDurationMs") is not None else None,
                "avgCredits": round(row["avgCredits"], 2) if row.get("avgCredits") is not None else None,
                "failures": int(row.get("failures") or 0),
            }
        )

    return {
        **summary,
        "slowAnalysesCount": slow_count,
        "slowThresholdMs": slow_threshold_ms,
        "expensiveAnalysesCount": expensive_count,
        "expensiveThresholdUsd": expensive_threshold_usd,
        "byAction": by_action,
    }
