"""Admin analytics aggregations — MongoDB pipelines only."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from admin_constants import (
    ADMIN_MAX_PERIOD_DAYS,
    COLLECTION_AI_USAGE_EVENTS,
    MRR_ELIGIBLE_STATUSES,
    PLAN_MONTHLY_PRICE_EUR,
)
from credit_constants import COLLECTION_TRANSACTIONS
from email_constants import COLLECTION_EMAIL_EVENTS
from subscription_constants import COLLECTION_SUBSCRIPTIONS

ISO = timezone.utc


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(value: str) -> datetime:
    normalized = value.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ISO)
    return dt.astimezone(ISO)


def resolve_period(
    *,
    period: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> Tuple[str, str, str]:
    """
    Returns (period_key, start_iso, end_iso).
    period: today | 7d | 30d
    """
    now = _utc_now()
    end = now

    if from_date and to_date:
        start = _parse_iso(from_date)
        end = _parse_iso(to_date)
        if end < start:
            raise ValueError("Invalid date range.")
        if (end - start).days > ADMIN_MAX_PERIOD_DAYS:
            raise ValueError("Date range too large.")
        return "custom", start.isoformat(), end.isoformat()

    key = (period or "30d").strip().lower()
    if key == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif key == "7d":
        start = now - timedelta(days=7)
    elif key == "30d":
        start = now - timedelta(days=30)
    else:
        raise ValueError("Invalid period.")

    return key, start.isoformat(), end.isoformat()


async def _count_users_created(db, start_iso: str, end_iso: str) -> int:
    return await db.users.count_documents({"createdAt": {"$gte": start_iso, "$lte": end_iso}})


async def _count_total_users(db) -> int:
    return await db.users.count_documents({})


async def _distinct_active_users(db, start_iso: str, end_iso: str) -> int:
    """Users with at least one business action in period."""
    pipelines = [
        db.events.aggregate(
            [
                {"$match": {"createdAt": {"$gte": start_iso, "$lte": end_iso}}},
                {"$group": {"_id": "$userId"}},
                {"$count": "n"},
            ]
        ),
        db.import_sessions.aggregate(
            [
                {"$match": {"createdAt": {"$gte": start_iso, "$lte": end_iso}}},
                {"$group": {"_id": "$userId"}},
                {"$count": "n"},
            ]
        ),
        db[COLLECTION_TRANSACTIONS].aggregate(
            [
                {
                    "$match": {
                        "createdAt": {"$gte": start_iso, "$lte": end_iso},
                        "type": "debit",
                    }
                },
                {"$group": {"_id": "$userId"}},
                {"$count": "n"},
            ]
        ),
    ]
    user_ids: set[str] = set()
    for coll_name, pipeline in [
        ("events", pipelines[0]),
        ("import_sessions", pipelines[1]),
        ("credit_transactions", pipelines[2]),
    ]:
        async for row in pipeline:
            # Need union approach - use separate queries
            pass

    # Simpler: three distinct queries
    for collection, query in [
        (db.events, {"createdAt": {"$gte": start_iso, "$lte": end_iso}}),
        (db.import_sessions, {"createdAt": {"$gte": start_iso, "$lte": end_iso}}),
        (
            db[COLLECTION_TRANSACTIONS],
            {"createdAt": {"$gte": start_iso, "$lte": end_iso}, "type": "debit"},
        ),
    ]:
        ids = await collection.distinct("userId", query)
        user_ids.update(ids)
    return len(user_ids)


async def _count_activated_users(db) -> int:
    """≥1 client AND (≥1 quote OR invoice OR import)."""
    pipeline = [
        {
            "$lookup": {
                "from": "clients",
                "localField": "id",
                "foreignField": "userId",
                "as": "clients",
            }
        },
        {"$match": {"clients.0": {"$exists": True}}},
        {
            "$lookup": {
                "from": "quotes",
                "localField": "id",
                "foreignField": "userId",
                "as": "quotes",
            }
        },
        {
            "$lookup": {
                "from": "invoices",
                "localField": "id",
                "foreignField": "userId",
                "as": "invoices",
            }
        },
        {
            "$lookup": {
                "from": "import_sessions",
                "localField": "id",
                "foreignField": "userId",
                "as": "imports",
            }
        },
        {
            "$match": {
                "$or": [
                    {"quotes.0": {"$exists": True}},
                    {"invoices.0": {"$exists": True}},
                    {"imports.0": {"$exists": True}},
                ]
            }
        },
        {"$count": "n"},
    ]
    result = await db.users.aggregate(pipeline).to_list(1)
    return result[0]["n"] if result else 0


async def _subscription_breakdown(db) -> dict:
    pipeline = [
        {"$group": {"_id": {"status": "$status", "planId": "$planId"}, "count": {"$sum": 1}}},
    ]
    by_status: Dict[str, int] = {}
    by_plan: Dict[str, int] = {}
    async for row in db[COLLECTION_SUBSCRIPTIONS].aggregate(pipeline):
        status = row["_id"].get("status") or "unknown"
        plan = row["_id"].get("planId") or "unknown"
        by_status[status] = by_status.get(status, 0) + row["count"]
        by_plan[plan] = by_plan.get(plan, 0) + row["count"]
    return {"byStatus": by_status, "byPlan": by_plan}


async def _estimate_mrr(db) -> dict:
    cursor = db[COLLECTION_SUBSCRIPTIONS].find(
        {"status": {"$in": list(MRR_ELIGIBLE_STATUSES)}},
        {"_id": 0, "planId": 1, "status": 1},
    )
    total = 0.0
    counted = 0
    missing_plans: List[str] = []
    async for doc in cursor:
        plan_id = doc.get("planId")
        price = PLAN_MONTHLY_PRICE_EUR.get(plan_id or "")
        if price is None:
            if plan_id and plan_id not in missing_plans:
                missing_plans.append(plan_id)
            continue
        total += price
        counted += 1

    configured = any(v is not None for v in PLAN_MONTHLY_PRICE_EUR.values())
    source = "catalog_estimate" if configured else "not_configured"
    return {
        "amountEur": round(total, 2),
        "currency": "EUR",
        "source": source,
        "subscriptionsCounted": counted,
        "missingPlanPrices": missing_plans,
        "disclaimer": "Estimated from ADMIN_MRR_*_EUR env vars, not Stripe invoices.",
    }


async def _credits_consumed(db, start_iso: str, end_iso: str) -> int:
    pipeline = [
        {
            "$match": {
                "createdAt": {"$gte": start_iso, "$lte": end_iso},
                "type": "debit",
            }
        },
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$costApplied", 0]}}}},
    ]
    result = await db[COLLECTION_TRANSACTIONS].aggregate(pipeline).to_list(1)
    return int(result[0]["total"]) if result else 0


async def _ai_usage_summary(db, start_iso: str, end_iso: str) -> dict:
    match = {"createdAt": {"$gte": start_iso, "$lte": end_iso}}
    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": None,
                "events": {"$sum": 1},
                "success": {"$sum": {"$cond": ["$success", 1, 0]}},
                "failed": {"$sum": {"$cond": ["$success", 0, 1]}},
                "totalTokens": {"$sum": {"$ifNull": ["$totalTokens", 0]}},
                "knownCostUsd": {
                    "$sum": {
                        "$cond": [
                            "$costKnown",
                            {"$ifNull": ["$estimatedCostUsd", 0]},
                            0,
                        ]
                    }
                },
                "unknownCostEvents": {"$sum": {"$cond": ["$costKnown", 0, 1]}},
            }
        },
    ]
    result = await db[COLLECTION_AI_USAGE_EVENTS].aggregate(pipeline).to_list(1)
    if not result:
        return {
            "events": 0,
            "success": 0,
            "failed": 0,
            "totalTokens": 0,
            "estimatedCostUsd": 0.0,
            "unknownCostEvents": 0,
        }
    row = result[0]
    return {
        "events": row["events"],
        "success": row["success"],
        "failed": row["failed"],
        "totalTokens": row["totalTokens"],
        "estimatedCostUsd": round(row.get("knownCostUsd") or 0, 4),
        "unknownCostEvents": row.get("unknownCostEvents", 0),
    }


async def _import_summary(db, start_iso: str, end_iso: str) -> dict:
    match = {"createdAt": {"$gte": start_iso, "$lte": end_iso}}
    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1},
            }
        },
    ]
    counts: Dict[str, int] = {}
    async for row in db.import_sessions.aggregate(pipeline):
        counts[row["_id"] or "unknown"] = row["count"]
    analysis_failed = await db[COLLECTION_AI_USAGE_EVENTS].count_documents(
        {
            "createdAt": {"$gte": start_iso, "$lte": end_iso},
            "actionKey": "IMPORT_DOCUMENT",
            "success": False,
        }
    )
    return {
        "total": sum(counts.values()),
        "byStatus": counts,
        "completed": counts.get("confirmed", 0),
        "failed": counts.get("failed", 0) + analysis_failed,
        "analysisFailed": analysis_failed,
        "pending": counts.get("pending", 0),
    }


async def _email_summary(db, start_iso: str, end_iso: str) -> dict:
    match = {"createdAt": {"$gte": start_iso, "$lte": end_iso}}
    pipeline = [
        {"$match": match},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    counts: Dict[str, int] = {}
    async for row in db[COLLECTION_EMAIL_EVENTS].aggregate(pipeline):
        counts[row["_id"] or "unknown"] = row["count"]
    return {
        "total": sum(counts.values()),
        "byStatus": counts,
        "sent": counts.get("sent", 0),
        "failed": counts.get("failed", 0),
    }


async def _stripe_failures(db, start_iso: str, end_iso: str) -> int:
    return await db.stripe_events.count_documents(
        {
            "status": "failed",
            "createdAt": {"$gte": start_iso, "$lte": end_iso},
        }
    )


async def _churn_count(db, start_iso: str, end_iso: str) -> int:
    return await db.subscription_history.count_documents(
        {
            "event": {"$in": ["cancelled", "expired"]},
            "createdAt": {"$gte": start_iso, "$lte": end_iso},
        }
    )


async def _trial_to_paid_count(db) -> int:
    """Users with trial_started and later activated in subscription_history."""
    pipeline = [
        {"$match": {"event": "trial_started"}},
        {"$group": {"_id": "$userId"}},
        {
            "$lookup": {
                "from": "subscription_history",
                "let": {"uid": "$_id"},
                "pipeline": [
                    {
                        "$match": {
                            "$expr": {
                                "$and": [
                                    {"$eq": ["$userId", "$$uid"]},
                                    {"$in": ["$event", ["activated", "renewed"]]},
                                ]
                            }
                        }
                    },
                    {"$limit": 1},
                ],
                "as": "paid",
            }
        },
        {"$match": {"paid.0": {"$exists": True}}},
        {"$count": "n"},
    ]
    result = await db.subscription_history.aggregate(pipeline).to_list(1)
    return result[0]["n"] if result else 0


async def _users_with_clients(db) -> int:
    return len(await db.clients.distinct("userId"))


async def _users_with_import(db) -> int:
    return len(await db.import_sessions.distinct("userId"))


async def build_overview(db, *, period: str, start_iso: str, end_iso: str) -> dict:
    start_7 = (_utc_now() - timedelta(days=7)).isoformat()
    start_30 = (_utc_now() - timedelta(days=30)).isoformat()
    now_iso = _utc_now().isoformat()

    mrr = await _estimate_mrr(db)
    ai_30 = await _ai_usage_summary(db, start_30, now_iso)
    credits_30 = await _credits_consumed(db, start_30, now_iso)

    gross_margin = None
    if mrr["source"] != "not_configured" and ai_30["estimatedCostUsd"] > 0:
        # Rough EUR margin using USD cost as-is (founder adjusts manually)
        gross_margin = {
            "revenueEur": mrr["amountEur"],
            "aiCostUsd": ai_30["estimatedCostUsd"],
            "disclaimer": "Gross AI margin estimate — excludes infra, SMTP, Stripe fees.",
        }

    return {
        "period": period,
        "startAt": start_iso,
        "endAt": end_iso,
        "users": {
            "total": await _count_total_users(db),
            "newInPeriod": await _count_users_created(db, start_iso, end_iso),
            "newLast7d": await _count_users_created(db, start_7, now_iso),
            "newLast30d": await _count_users_created(db, start_30, now_iso),
            "activeInPeriod": await _distinct_active_users(db, start_iso, end_iso),
            "activeLast7d": await _distinct_active_users(db, start_7, now_iso),
            "activeLast30d": await _distinct_active_users(db, start_30, now_iso),
            "withClients": await _users_with_clients(db),
            "withAiImport": await _users_with_import(db),
            "activated": await _count_activated_users(db),
        },
        "subscriptions": await _subscription_breakdown(db),
        "mrr": mrr,
        "conversion": {
            "trialToPaidTotal": await _trial_to_paid_count(db),
            "churnInPeriod": await _churn_count(db, start_iso, end_iso),
        },
        "credits": {
            "consumedInPeriod": await _credits_consumed(db, start_iso, end_iso),
            "consumedLast30d": credits_30,
        },
        "aiUsage": await _ai_usage_summary(db, start_iso, end_iso),
        "aiUsageLast30d": ai_30,
        "imports": await _import_summary(db, start_iso, end_iso),
        "emails": await _email_summary(db, start_iso, end_iso),
        "stripe": {
            "webhookFailuresInPeriod": await _stripe_failures(db, start_iso, end_iso),
        },
        "grossAiMarginEstimate": gross_margin,
    }


async def build_alerts(db) -> List[dict]:
    """Operational items for admin dashboard."""
    now = _utc_now()
    start_24h = (now - timedelta(hours=24)).isoformat()
    start_7d = (now - timedelta(days=7)).isoformat()
    alerts: List[dict] = []

    stripe_failed = await db.stripe_events.count_documents(
        {"status": "failed", "createdAt": {"$gte": start_24h}}
    )
    if stripe_failed:
        alerts.append(
            {
                "severity": "high",
                "code": "stripe_webhook_failed",
                "message": f"{stripe_failed} Stripe webhook failure(s) in 24h",
                "count": stripe_failed,
            }
        )

    email_failed = await db[COLLECTION_EMAIL_EVENTS].count_documents(
        {"status": "failed", "updatedAt": {"$gte": start_24h}}
    )
    if email_failed:
        alerts.append(
            {
                "severity": "medium",
                "code": "email_failed",
                "message": f"{email_failed} email(s) permanently failed in 24h",
                "count": email_failed,
            }
        )

    import_failed = await db[COLLECTION_AI_USAGE_EVENTS].count_documents(
        {
            "success": False,
            "actionKey": "IMPORT_DOCUMENT",
            "createdAt": {"$gte": start_7d},
        }
    )
    if import_failed:
        alerts.append(
            {
                "severity": "medium",
                "code": "import_failed",
                "message": f"{import_failed} AI import(s) failed in 7d",
                "count": import_failed,
            }
        )

    past_due = await db[COLLECTION_SUBSCRIPTIONS].count_documents({"status": "past_due"})
    if past_due:
        alerts.append(
            {
                "severity": "medium",
                "code": "subscription_past_due",
                "message": f"{past_due} subscription(s) past due",
                "count": past_due,
            }
        )

    ai_unknown = await db[COLLECTION_AI_USAGE_EVENTS].count_documents(
        {"costKnown": False, "createdAt": {"$gte": start_7d}}
    )
    if ai_unknown:
        alerts.append(
            {
                "severity": "low",
                "code": "ai_cost_unknown",
                "message": f"{ai_unknown} AI event(s) without known cost (configure model rates)",
                "count": ai_unknown,
            }
        )

    return alerts


async def check_system_health(db) -> dict:
    mongo_ok = False
    try:
        await db.command("ping")
        mongo_ok = True
    except Exception:
        pass

    email_retrying = await db[COLLECTION_EMAIL_EVENTS].count_documents({"status": "retrying"})

    return {
        "mongo": "ok" if mongo_ok else "down",
        "ready": mongo_ok,
        "emailRetrying": email_retrying,
    }


def _user_list_pipeline(*, match: dict, skip: int, limit: int) -> list:
    return [
        {"$match": match},
        {"$sort": {"createdAt": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {
            "$lookup": {
                "from": COLLECTION_SUBSCRIPTIONS,
                "localField": "id",
                "foreignField": "userId",
                "as": "subscription",
            }
        },
        {
            "$lookup": {
                "from": "user_credit_accounts",
                "localField": "id",
                "foreignField": "userId",
                "as": "creditAccount",
            }
        },
        {
            "$lookup": {
                "from": "clients",
                "let": {"uid": "$id"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$userId", "$$uid"]}}},
                    {"$count": "n"},
                ],
                "as": "clientCounts",
            }
        },
        {
            "$lookup": {
                "from": "import_sessions",
                "let": {"uid": "$id"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$userId", "$$uid"]}}},
                    {"$count": "n"},
                ],
                "as": "importCounts",
            }
        },
        {
            "$lookup": {
                "from": "events",
                "let": {"uid": "$id"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$userId", "$$uid"]}}},
                    {"$sort": {"createdAt": -1}},
                    {"$limit": 1},
                    {"$project": {"createdAt": 1}},
                ],
                "as": "lastEvent",
            }
        },
        {
            "$project": {
                "_id": 0,
                "id": 1,
                "email": 1,
                "firstName": 1,
                "lastName": 1,
                "companyName": 1,
                "emailVerified": 1,
                "createdAt": 1,
                "accountStatus": {"$ifNull": ["$accountStatus", "active"]},
                "planId": {"$arrayElemAt": ["$subscription.planId", 0]},
                "subscriptionStatus": {"$arrayElemAt": ["$subscription.status", 0]},
                "creditsAvailable": {
                    "$add": [
                        {"$ifNull": [{"$arrayElemAt": ["$creditAccount.monthlyCreditsRemaining", 0]}, 0]},
                        {"$ifNull": [{"$arrayElemAt": ["$creditAccount.permanentCreditsRemaining", 0]}, 0]},
                    ]
                },
                "clientsCount": {
                    "$ifNull": [{"$arrayElemAt": ["$clientCounts.n", 0]}, 0]
                },
                "importsCount": {
                    "$ifNull": [{"$arrayElemAt": ["$importCounts.n", 0]}, 0]
                },
                "lastActivityAt": {
                    "$ifNull": [
                        {"$arrayElemAt": ["$lastEvent.createdAt", 0]},
                        "$updatedAt",
                    ]
                },
            }
        },
    ]


async def list_admin_users(
    db,
    *,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    from admin_constants import ADMIN_PAGE_SIZE_MAX

    page = max(1, page)
    page_size = min(max(1, page_size), ADMIN_PAGE_SIZE_MAX)
    skip = (page - 1) * page_size

    match: dict = {}
    if q and q.strip():
        import re

        match["email"] = {"$regex": re.escape(q.strip()), "$options": "i"}

    total = await db.users.count_documents(match)
    pipeline = _user_list_pipeline(match=match, skip=skip, limit=page_size)
    items = [doc async for doc in db.users.aggregate(pipeline)]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return {
        "items": items,
        "page": page,
        "pageSize": page_size,
        "total": total,
        "totalPages": total_pages,
    }


async def get_admin_user_detail(db, user_id: str) -> Optional[dict]:
    user = await db.users.find_one(
        {"id": user_id},
        {
            "_id": 0,
            "passwordHash": 0,
            "emailVerificationToken": 0,
            "passwordResetToken": 0,
            "passwordResetExpires": 0,
        },
    )
    if not user:
        return None

    subscription = await db[COLLECTION_SUBSCRIPTIONS].find_one(
        {"userId": user_id},
        {"_id": 0},
    )
    credit_account = await db.user_credit_accounts.find_one(
        {"userId": user_id},
        {"_id": 0},
    )

    sub_history = (
        await db.subscription_history.find(
            {"userId": user_id},
            {"_id": 0},
        )
        .sort("createdAt", -1)
        .limit(20)
        .to_list(20)
    )

    recent_imports = (
        await db.import_sessions.find(
            {"userId": user_id},
            {
                "_id": 0,
                "id": 1,
                "status": 1,
                "detectedKind": 1,
                "createdAt": 1,
                "updatedAt": 1,
                "file.name": 1,
            },
        )
        .sort("createdAt", -1)
        .limit(10)
        .to_list(10)
    )

    failed_emails = (
        await db[COLLECTION_EMAIL_EVENTS].find(
            {"userId": user_id, "status": "failed"},
            {
                "_id": 0,
                "id": 1,
                "templateKey": 1,
                "recipient": 1,
                "status": 1,
                "createdAt": 1,
                "lastErrorCode": 1,
            },
        )
        .sort("createdAt", -1)
        .limit(10)
        .to_list(10)
    )
    for row in failed_emails:
        row["to"] = row.get("recipient")
        row["lastError"] = row.get("lastErrorCode")

    recent_events = (
        await db.events.find(
            {"userId": user_id},
            {"_id": 0, "id": 1, "type": 1, "createdAt": 1, "clientId": 1},
        )
        .sort("createdAt", -1)
        .limit(15)
        .to_list(15)
    )

    user["accountStatus"] = user.get("accountStatus") or "active"
    return {
        "user": user,
        "subscription": subscription,
        "credits": credit_account,
        "subscriptionHistory": sub_history,
        "recentImports": recent_imports,
        "failedEmails": failed_emails,
        "recentEvents": recent_events,
    }


async def list_subscriptions_admin(
    db,
    *,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    from admin_constants import ADMIN_PAGE_SIZE_MAX

    page = max(1, page)
    page_size = min(max(1, page_size), ADMIN_PAGE_SIZE_MAX)
    skip = (page - 1) * page_size
    match: dict = {}
    if status:
        match["status"] = status

    total = await db[COLLECTION_SUBSCRIPTIONS].count_documents(match)
    items = (
        await db[COLLECTION_SUBSCRIPTIONS].find(
            match,
            {"_id": 0, "id": 1, "userId": 1, "planId": 1, "status": 1, "currentPeriodEnd": 1, "createdAt": 1},
        )
        .sort("createdAt", -1)
        .skip(skip)
        .limit(page_size)
        .to_list(page_size)
    )

    user_ids = [item["userId"] for item in items if item.get("userId")]
    emails: dict = {}
    if user_ids:
        async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "email": 1}):
            emails[u["id"]] = u.get("email")

    for item in items:
        item["userEmail"] = emails.get(item.get("userId"))

    return {
        "items": items,
        "page": page,
        "pageSize": page_size,
        "total": total,
        "totalPages": max(1, (total + page_size - 1) // page_size),
    }


async def list_ai_usage_admin(
    db,
    *,
    start_iso: str,
    end_iso: str,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    from admin_constants import ADMIN_PAGE_SIZE_MAX

    page = max(1, page)
    page_size = min(max(1, page_size), ADMIN_PAGE_SIZE_MAX)
    skip = (page - 1) * page_size
    match = {"createdAt": {"$gte": start_iso, "$lte": end_iso}}

    total = await db[COLLECTION_AI_USAGE_EVENTS].count_documents(match)
    items = (
        await db[COLLECTION_AI_USAGE_EVENTS].find(
            match,
            {
                "_id": 0,
                "id": 1,
                "userId": 1,
                "actionKey": 1,
                "model": 1,
                "totalTokens": 1,
                "estimatedCostUsd": 1,
                "costKnown": 1,
                "success": 1,
                "durationMs": 1,
                "createdAt": 1,
            },
        )
        .sort("createdAt", -1)
        .skip(skip)
        .limit(page_size)
        .to_list(page_size)
    )

    summary = await _ai_usage_summary(db, start_iso, end_iso)
    top_users_pipeline = [
        {"$match": match},
        {"$group": {"_id": "$userId", "events": {"$sum": 1}, "tokens": {"$sum": "$totalTokens"}}},
        {"$sort": {"tokens": -1}},
        {"$limit": 10},
    ]
    top_users = [row async for row in db[COLLECTION_AI_USAGE_EVENTS].aggregate(top_users_pipeline)]

    by_tier_pipeline = [
        {"$match": {**match, "metadata.tierKey": {"$exists": True}}},
        {"$group": {"_id": "$metadata.tierKey", "count": {"$sum": 1}}},
    ]
    by_tier: dict = {}
    async for row in db[COLLECTION_AI_USAGE_EVENTS].aggregate(by_tier_pipeline):
        by_tier[row["_id"] or "unknown"] = row["count"]

    return {
        "summary": summary,
        "items": items,
        "topConsumers": top_users,
        "importsByTier": by_tier,
        "page": page,
        "pageSize": page_size,
        "total": total,
        "totalPages": max(1, (total + page_size - 1) // page_size),
    }


async def list_imports_admin(
    db,
    *,
    start_iso: str,
    end_iso: str,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    from admin_constants import ADMIN_PAGE_SIZE_MAX

    page = max(1, page)
    page_size = min(max(1, page_size), ADMIN_PAGE_SIZE_MAX)
    skip = (page - 1) * page_size
    match: dict = {"createdAt": {"$gte": start_iso, "$lte": end_iso}}
    if status:
        match["status"] = status

    total = await db.import_sessions.count_documents(match)
    items = (
        await db.import_sessions.find(
            match,
            {
                "_id": 0,
                "id": 1,
                "userId": 1,
                "status": 1,
                "detectedKind": 1,
                "createdAt": 1,
                "updatedAt": 1,
                "file.name": 1,
                "file.sizeBytes": 1,
            },
        )
        .sort("createdAt", -1)
        .skip(skip)
        .limit(page_size)
        .to_list(page_size)
    )

    return {
        "summary": await _import_summary(db, start_iso, end_iso),
        "items": items,
        "page": page,
        "pageSize": page_size,
        "total": total,
        "totalPages": max(1, (total + page_size - 1) // page_size),
    }


async def list_emails_admin(
    db,
    *,
    start_iso: str,
    end_iso: str,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    from admin_constants import ADMIN_PAGE_SIZE_MAX

    page = max(1, page)
    page_size = min(max(1, page_size), ADMIN_PAGE_SIZE_MAX)
    skip = (page - 1) * page_size
    match: dict = {"createdAt": {"$gte": start_iso, "$lte": end_iso}}
    if status:
        match["status"] = status

    total = await db[COLLECTION_EMAIL_EVENTS].count_documents(match)
    items = (
        await db[COLLECTION_EMAIL_EVENTS].find(
            match,
            {
                "_id": 0,
                "id": 1,
                "userId": 1,
                "templateKey": 1,
                "recipient": 1,
                "status": 1,
                "attempts": 1,
                "createdAt": 1,
                "lastErrorCode": 1,
            },
        )
        .sort("createdAt", -1)
        .skip(skip)
        .limit(page_size)
        .to_list(page_size)
    )
    for row in items:
        row["to"] = row.get("recipient")
        row["lastError"] = row.get("lastErrorCode")

    return {
        "summary": await _email_summary(db, start_iso, end_iso),
        "items": items,
        "page": page,
        "pageSize": page_size,
        "total": total,
        "totalPages": max(1, (total + page_size - 1) // page_size),
    }


async def list_credits_admin(
    db,
    *,
    start_iso: str,
    end_iso: str,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    from admin_constants import ADMIN_PAGE_SIZE_MAX

    page = max(1, page)
    page_size = min(max(1, page_size), ADMIN_PAGE_SIZE_MAX)
    skip = (page - 1) * page_size
    match = {"createdAt": {"$gte": start_iso, "$lte": end_iso}}

    total = await db[COLLECTION_TRANSACTIONS].count_documents(match)
    items = (
        await db[COLLECTION_TRANSACTIONS].find(
            match,
            {
                "_id": 0,
                "id": 1,
                "userId": 1,
                "type": 1,
                "costApplied": 1,
                "actionKey": 1,
                "source": 1,
                "label": 1,
                "createdAt": 1,
            },
        )
        .sort("createdAt", -1)
        .skip(skip)
        .limit(page_size)
        .to_list(page_size)
    )

    debits_pipeline = [
        {"$match": {**match, "type": "debit"}},
        {"$group": {"_id": "$actionKey", "total": {"$sum": {"$ifNull": ["$costApplied", 0]}}}},
    ]
    by_action: dict = {}
    async for row in db[COLLECTION_TRANSACTIONS].aggregate(debits_pipeline):
        by_action[row["_id"] or "unknown"] = row["total"]

    return {
        "consumedInPeriod": await _credits_consumed(db, start_iso, end_iso),
        "byActionKey": by_action,
        "items": items,
        "page": page,
        "pageSize": page_size,
        "total": total,
        "totalPages": max(1, (total + page_size - 1) // page_size),
    }


async def list_errors_admin(
    db,
    *,
    start_iso: str,
    end_iso: str,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    from admin_constants import ADMIN_PAGE_SIZE_MAX

    page = max(1, page)
    page_size = min(max(1, page_size), ADMIN_PAGE_SIZE_MAX)
    skip = (page - 1) * page_size

    stripe_failed = (
        await db.stripe_events.find(
            {"status": "failed", "createdAt": {"$gte": start_iso, "$lte": end_iso}},
            {"_id": 0, "eventId": 1, "eventType": 1, "status": 1, "createdAt": 1, "error": 1},
        )
        .sort("createdAt", -1)
        .skip(skip)
        .limit(page_size)
        .to_list(page_size)
    )
    for row in stripe_failed:
        row["id"] = row.get("eventId")
        row["lastError"] = row.get("error")

    import_failed_count = await db[COLLECTION_AI_USAGE_EVENTS].count_documents(
        {
            "success": False,
            "actionKey": "IMPORT_DOCUMENT",
            "createdAt": {"$gte": start_iso, "$lte": end_iso},
        }
    )
    email_failed_count = await db[COLLECTION_EMAIL_EVENTS].count_documents(
        {"status": "failed", "updatedAt": {"$gte": start_iso, "$lte": end_iso}}
    )

    return {
        "stripeWebhookFailures": stripe_failed,
        "importFailuresCount": import_failed_count,
        "emailFailuresCount": email_failed_count,
        "page": page,
        "pageSize": page_size,
    }


async def simulate_credit_cost_change(
    db,
    *,
    action_key: str,
    hypothetical_cost: int,
    start_iso: str,
    end_iso: str,
) -> dict:
    match = {
        "createdAt": {"$gte": start_iso, "$lte": end_iso},
        "type": "debit",
        "actionKey": action_key,
    }
    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": None,
                "events": {"$sum": 1},
                "currentTotal": {"$sum": {"$ifNull": ["$costApplied", 0]}},
            }
        },
    ]
    result = await db[COLLECTION_TRANSACTIONS].aggregate(pipeline).to_list(1)
    events = result[0]["events"] if result else 0
    current_total = int(result[0]["currentTotal"]) if result else 0
    hypothetical_total = events * hypothetical_cost

    return {
        "actionKey": action_key,
        "currentTotalDebits": current_total,
        "hypotheticalTotalDebits": hypothetical_total,
        "delta": hypothetical_total - current_total,
        "eventsCounted": events,
        "disclaimer": "Simulation only — not persisted or applied to billing.",
    }
