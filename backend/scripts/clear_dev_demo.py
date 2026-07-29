#!/usr/bin/env python3
"""Delete MemoryHub demo seed data from MongoDB for local dev.

Removes every document tagged with ``devSeedTag`` in {"demo_v1", "demo_v2"}
(the tags used by ``seed_dev_demo.py`` across its versions) for the target
dev user, plus any client portals tied to the deleted clients.

Idempotent: running this on an already-clean database deletes nothing and
prints a "nothing to clear" message. Refuses to run when ENV=production.

Usage:
    cd backend
    python3 scripts/clear_dev_demo.py
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env", override=False)

sys.path.insert(0, str(ROOT_DIR))

DEFAULT_EMAIL = "atmossg7@gmail.com"

# All devSeedTag values ever used by seed_dev_demo.py — cleared together so
# stale data from an older seed version doesn't linger after an upgrade.
DEMO_TAGS = ["demo_v1", "demo_v2"]

# Collections whose documents may carry devSeedTag directly.
TAGGED_COLLECTIONS = [
    "clients",
    "quotes",
    "invoices",
    "notes",
    "documents",
    "communications",
    "events",
    "follow_ups",
]


async def _find_user(db, email: str):
    return await db.users.find_one({"email": email.strip().lower()})


async def _delete_tagged(db, collection_name: str, user_id: str) -> int:
    result = await db[collection_name].delete_many(
        {"userId": user_id, "devSeedTag": {"$in": DEMO_TAGS}}
    )
    return result.deleted_count


async def _clear_demo(db, user_id: str) -> dict:
    # Capture seeded client ids before deleting clients, so we can also
    # clean up their portals (client_portals isn't always devSeedTag-tagged).
    seeded_client_ids = [
        doc["id"]
        async for doc in db.clients.find(
            {"userId": user_id, "devSeedTag": {"$in": DEMO_TAGS}},
            {"_id": 0, "id": 1},
        )
    ]

    counts: dict = {}
    for collection_name in TAGGED_COLLECTIONS:
        counts[collection_name] = await _delete_tagged(db, collection_name, user_id)

    portal_query = {"userId": user_id, "devSeedTag": {"$in": DEMO_TAGS}}
    if seeded_client_ids:
        portal_query = {
            "userId": user_id,
            "$or": [
                {"devSeedTag": {"$in": DEMO_TAGS}},
                {"clientId": {"$in": seeded_client_ids}},
            ],
        }
    portal_result = await db.client_portals.delete_many(portal_query)
    counts["client_portals"] = portal_result.deleted_count

    return counts


async def _async_main() -> int:
    if os.environ.get("ENV", "development").lower() == "production":
        print("ERROR: clear_dev_demo.py cannot run when ENV=production.", file=sys.stderr)
        return 1

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("ERROR: Set MONGO_URL and DB_NAME in backend/.env", file=sys.stderr)
        return 1

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    user = await _find_user(db, DEFAULT_EMAIL)
    if not user:
        print(f"No user {DEFAULT_EMAIL} found. Nothing to clear.")
        return 0

    user_id = user["id"]
    counts = await _clear_demo(db, user_id)

    total = sum(counts.values())
    if total == 0:
        print("No demo data found (already clean).")
        return 0

    print("Demo data cleared:")
    for name, count in counts.items():
        if count:
            print(f"  {name}: {count}")
    print(f"Total documents deleted: {total}")
    return 0


def main() -> int:
    return asyncio.run(_async_main())


if __name__ == "__main__":
    sys.exit(main())
