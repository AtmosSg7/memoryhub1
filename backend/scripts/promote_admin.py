#!/usr/bin/env python3
"""Promote a user to platform admin (requires server/DB access)."""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env", override=False)

from admin_constants import USER_ROLE_ADMIN  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Promote a MemoryHub user to admin.")
    parser.add_argument("email", help="User email to promote")
    parser.add_argument("--dry-run", action="store_true", help="Show action without writing")
    args = parser.parse_args()

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("MONGO_URL and DB_NAME must be set.", file=sys.stderr)
        return 1

    email = args.email.strip().lower()
    client = MongoClient(mongo_url)
    db = client[db_name]
    user = db.users.find_one({"email": email})
    if not user:
        print(f"No user found for {email}", file=sys.stderr)
        return 1

    if user.get("role") == USER_ROLE_ADMIN:
        print(f"{email} is already admin.")
        return 0

    if args.dry_run:
        print(f"Would promote {email} (id={user['id']}) to admin.")
        return 0

    now = datetime.now(timezone.utc).isoformat()
    db.users.update_one(
        {"id": user["id"]},
        {"$set": {"role": USER_ROLE_ADMIN, "updatedAt": now}},
    )
    print(f"Promoted {email} to admin.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
