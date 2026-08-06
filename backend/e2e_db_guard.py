"""Guards that E2E clean/seed never touch the local/dev product database."""

from __future__ import annotations

import os
import sys

# Local product DB and Mongo internals — never drop/seed these via E2E scripts.
FORBIDDEN_DB_NAMES = frozenset(
    {
        "memoryhub",
        "admin",
        "local",
        "config",
    }
)


def resolve_e2e_db_name(explicit: str | None = None) -> str:
    name = (explicit or os.environ.get("E2E_DB_NAME") or "memoryhub_e2e").strip()
    if not name:
        print("ERROR: E2E_DB_NAME is empty.", file=sys.stderr)
        raise SystemExit(2)
    if name in FORBIDDEN_DB_NAMES:
        print(
            f"ERROR: Refusing E2E database name {name!r} — this is a protected local/system DB.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    # Allow memoryhub_e2e and memoryhub_e2e_* only (never memoryhub, never pytest product DBs).
    if name != "memoryhub_e2e" and not name.startswith("memoryhub_e2e_"):
        print(
            f"ERROR: Refusing E2E database name {name!r}. "
            "Allowed: memoryhub_e2e or memoryhub_e2e_*.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return name
