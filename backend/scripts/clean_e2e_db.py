#!/usr/bin/env python3
"""Drop E2E database collections — never touches production DB_NAME."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env", override=False)

E2E_DB = os.environ.get("E2E_DB_NAME", "memoryhub_e2e")


def main() -> int:
    if os.environ.get("ENV", "development").lower() == "production":
        print("ERROR: clean_e2e_db.py cannot run when ENV=production.", file=sys.stderr)
        return 1

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    client = MongoClient(mongo_url)
    db = client[E2E_DB]
    client.drop_database(E2E_DB)
    print(f"Dropped database: {E2E_DB}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
