#!/usr/bin/env python3
"""Drop E2E database only — never touches the local product DB (memoryhub)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
# Do not let a polluted shell DB_NAME influence this script's target.
load_dotenv(ROOT / ".env", override=False)

from e2e_db_guard import resolve_e2e_db_name  # noqa: E402


def main() -> int:
    if os.environ.get("ENV", "development").lower() == "production":
        print("ERROR: clean_e2e_db.py cannot run when ENV=production.", file=sys.stderr)
        return 1

    e2e_db = resolve_e2e_db_name()
    # Ignore process DB_NAME — clean target is always E2E_DB_NAME / default.
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    client = MongoClient(mongo_url)
    client.drop_database(e2e_db)
    print(f"Dropped database: {e2e_db}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
