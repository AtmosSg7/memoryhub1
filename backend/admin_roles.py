"""Server-side admin role resolution — no FastAPI dependencies."""

from __future__ import annotations

import os

from admin_constants import USER_ROLE_ADMIN


def _admin_emails() -> set[str]:
    raw = os.environ.get("ADMIN_EMAILS", "").strip()
    if not raw:
        return set()
    return {email.strip().lower() for email in raw.split(",") if email.strip()}


def is_admin_user(user: dict) -> bool:
    """True when user has admin role or email is in ADMIN_EMAILS."""
    if not user:
        return False
    if user.get("role") == USER_ROLE_ADMIN:
        return True
    email = (user.get("email") or "").strip().lower()
    return bool(email and email in _admin_emails())
