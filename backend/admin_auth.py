"""Admin authentication — FastAPI dependency for protected routes."""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Request

from admin_roles import is_admin_user
from auth import get_current_user
from rate_limit import rate_limit

admin_rate_limit = rate_limit(max_requests=120, window_seconds=3600, key_suffix=":admin")


async def require_admin(
    request: Request,
    current_user: dict = Depends(get_current_user),
    _rate=Depends(admin_rate_limit),
) -> dict:
    if not is_admin_user(current_user):
        raise HTTPException(status_code=403, detail={"message": "Admin access required."})
    return current_user


def client_ip(request: Request) -> Optional[str]:
    if request.client:
        return request.client.host
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return None


def request_id(request: Request) -> Optional[str]:
    return request.headers.get("x-request-id") or getattr(request.state, "request_id", None)
