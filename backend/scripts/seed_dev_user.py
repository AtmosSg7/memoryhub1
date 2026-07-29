#!/usr/bin/env python3
"""Create a local dev admin user if missing. Refuses to run when ENV=production."""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env", override=False)

sys.path.insert(0, str(ROOT_DIR))
from auth import build_user_document  # noqa: E402

DEFAULT_EMAIL = "atmossg7@gmail.com"
DEFAULT_PASSWORD = "devpassword123"


def main() -> int:
    if os.environ.get("ENV", "development").lower() == "production":
        print("ERROR: seed_dev_user.py cannot run when ENV=production.", file=sys.stderr)
        return 1

    email = DEFAULT_EMAIL.strip().lower()
    password = DEFAULT_PASSWORD

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("ERROR: Set MONGO_URL and DB_NAME in backend/.env", file=sys.stderr)
        return 1

    client = MongoClient(mongo_url)
    db = client[db_name]

    if db.users.find_one({"email": email}):
        print(f"User already exists: {email}")
        return 0

    db.users.insert_one(
        build_user_document(
            first_name="Dev",
            last_name="Admin",
            company_name="MemoryHub Dev",
            email=email,
            password=password,
            email_verified=True,
        )
    )
    print(f"Dev user created: {email}")
    print(f"Password: {password}")
    print("Login: http://localhost:3000/login")
    return 0


if __name__ == "__main__":
    sys.exit(main())
