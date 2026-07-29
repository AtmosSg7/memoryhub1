#!/usr/bin/env python3
"""Pre-flight database connectivity and index sanity check."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT.parent / "deploy/.env", override=False)
load_dotenv(ROOT / ".env", override=False)

REQUIRED_COLLECTIONS = (
    "users",
    "clients",
    "quotes",
    "invoices",
    "email_events",
    "stripe_events",
    "user_subscriptions",
    "credit_transactions",
)


async def main() -> int:
    from motor.motor_asyncio import AsyncIOMotorClient

    mongo_url = os.environ.get("MONGO_URL", "").strip()
    db_name = os.environ.get("DB_NAME", "").strip()
    if not mongo_url or not db_name:
        print("MONGO_URL and DB_NAME are required.", file=sys.stderr)
        return 1

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    errors: list[str] = []

    try:
        await db.command("ping")
        print(f"OK: MongoDB ping ({db_name})")

        names = await db.list_collection_names()
        for coll in REQUIRED_COLLECTIONS:
            if coll not in names:
                print(f"INFO: collection '{coll}' not present yet (fresh install)")

        for coll_name in ("users", "email_events", "stripe_events"):
            if coll_name not in names:
                continue
            indexes = await db[coll_name].index_information()
            print(f"OK: {coll_name} indexes: {', '.join(indexes.keys())}")

        upload_dir = os.environ.get("LOCAL_UPLOAD_DIR", "./uploads")
        if os.environ.get("STORAGE_BACKEND", "local").lower() == "local":
            path = Path(upload_dir)
            if not path.exists():
                print(f"WARN: upload directory missing, creating {path}")
                path.mkdir(parents=True, exist_ok=True)
            elif not os.access(path, os.W_OK):
                errors.append(f"Upload directory not writable: {path}")

    except Exception as exc:
        errors.append(f"Database check failed: {exc}")
    finally:
        client.close()

    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        return 1

    print("Database check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
