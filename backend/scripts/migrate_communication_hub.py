#!/usr/bin/env python3
"""Production-safe Communication Hub V2 backfill.

Idempotent. Does not delete data. Scoped by userId (required).

Usage (from backend/ with venv):

  # One user
  python scripts/migrate_communication_hub.py --user-id USER_UUID --limit 5000

  # All users (batched, still per-user isolation)
  python scripts/migrate_communication_hub.py --all-users --limit 2000

  # Dry-run counts only
  python scripts/migrate_communication_hub.py --user-id USER_UUID --dry-run

Rollback: no destructive writes — remove conversationId/lifecycleStatus fields
only if you explicitly choose to (not provided here). Conversations collection
can be dropped without losing communications messages.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

# Allow `python scripts/...` from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def _run(user_id: str | None, *, all_users: bool, limit: int, dry_run: bool) -> int:
    from motor.motor_asyncio import AsyncIOMotorClient

    mongo_url = os.environ.get("MONGO_URL") or "mongodb://localhost:27017"
    db_name = os.environ.get("DB_NAME") or "memoryhub"
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    from communication_hub.migration import migrate_communications_to_hub

    user_ids: list[str] = []
    if all_users:
        user_ids = [
            doc["id"]
            async for doc in db.users.find({}, {"_id": 0, "id": 1})
            if doc.get("id")
        ]
    elif user_id:
        user_ids = [user_id]
    else:
        print("ERROR: provide --user-id or --all-users", file=sys.stderr)
        return 2

    total_scanned = 0
    total_updated = 0
    total_convs = 0

    for uid in user_ids:
        pending = await db.communications.count_documents(
            {
                "userId": uid,
                "$or": [
                    {"conversationId": {"$exists": False}},
                    {"conversationId": None},
                    {"conversationId": ""},
                    {"lifecycleStatus": {"$exists": False}},
                ],
            }
        )
        print(f"user={uid} pending≈{pending}")
        if dry_run:
            total_scanned += pending
            continue
        result = await migrate_communications_to_hub(db, user_id=uid, limit=limit)
        print(
            f"  scanned={result.scanned} updated={result.communicationsUpdated} "
            f"conversations={result.conversationsUpserted} attachments≈{result.attachmentsUpserted}"
        )
        total_scanned += result.scanned
        total_updated += result.communicationsUpdated
        total_convs += result.conversationsUpserted

    print(
        f"DONE dry_run={dry_run} scanned={total_scanned} "
        f"updated={total_updated} conversations={total_convs}"
    )
    client.close()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate communications into Hub V2")
    parser.add_argument("--user-id", dest="user_id", default=None)
    parser.add_argument("--all-users", action="store_true")
    parser.add_argument("--limit", type=int, default=5000)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    return asyncio.run(
        _run(
            args.user_id,
            all_users=args.all_users,
            limit=args.limit,
            dry_run=args.dry_run,
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())
