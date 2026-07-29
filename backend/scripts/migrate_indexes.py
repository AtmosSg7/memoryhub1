#!/usr/bin/env python3
"""Ensure MongoDB indexes idempotently (safe to run before or after deploy)."""

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


async def main() -> int:
    from motor.motor_asyncio import AsyncIOMotorClient
    from server import startup_db_indexes

    mongo_url = os.environ.get("MONGO_URL", "").strip()
    db_name = os.environ.get("DB_NAME", "").strip()
    if not mongo_url or not db_name:
        print("MONGO_URL and DB_NAME are required.", file=sys.stderr)
        return 1

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    try:
        await db.command("ping")
        print(f"Connected to MongoDB database: {db_name}")
        await startup_db_indexes()
        print("Indexes ensured successfully.")
        return 0
    except Exception as exc:
        print(f"Index migration failed: {exc}", file=sys.stderr)
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
