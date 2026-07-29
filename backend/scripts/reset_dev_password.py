#!/usr/bin/env python3
"""Reset a user's password in local MongoDB. Refuses to run when ENV=production."""

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env", override=False)

sys.path.insert(0, str(ROOT_DIR))
from auth import hash_password  # noqa: E402


def main() -> int:
    if os.environ.get("ENV", "development").lower() == "production":
        print("ERROR: reset_dev_password.py cannot run when ENV=production.", file=sys.stderr)
        return 1

    parser = argparse.ArgumentParser(
        description="Reset a MemoryHub user password (local dev only)."
    )
    parser.add_argument("email", help="User email (e.g. atmossg7@gmail.com)")
    parser.add_argument(
        "password",
        nargs="?",
        default="devpassword123",
        help="New password (min 8 chars, default: devpassword123)",
    )
    args = parser.parse_args()

    if len(args.password) < 8:
        print("ERROR: Password must be at least 8 characters.", file=sys.stderr)
        return 1

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("ERROR: Set MONGO_URL and DB_NAME in backend/.env", file=sys.stderr)
        return 1

    email = args.email.strip().lower()
    client = MongoClient(mongo_url)
    db = client[db_name]

    user = db.users.find_one({"email": email})
    if not user:
        print(f"ERROR: No user found with email {email}", file=sys.stderr)
        return 1

    now = datetime.now(timezone.utc).isoformat()
    db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "passwordHash": hash_password(args.password),
                "passwordResetToken": None,
                "passwordResetExpires": None,
                "updatedAt": now,
            }
        },
    )

    print(f"Password reset for {email}")
    print(f"New password: {args.password}")
    print("Login: http://localhost:3000/login")
    return 0


if __name__ == "__main__":
    sys.exit(main())
