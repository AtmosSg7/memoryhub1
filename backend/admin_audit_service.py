"""Append-only admin audit log."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from admin_constants import COLLECTION_ADMIN_AUDIT_LOGS


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_metadata(data: Optional[dict]) -> dict:
    if not data:
        return {}
    blocked = {"password", "token", "secret", "apikey", "api_key"}
    clean = {}
    for key, value in data.items():
        lower = key.lower()
        if any(b in lower for b in blocked):
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            clean[key] = value
    return clean


async def log_admin_action(
    db,
    *,
    admin_user_id: str,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    reason: Optional[str] = None,
    metadata: Optional[dict] = None,
    request_id: Optional[str] = None,
    ip: Optional[str] = None,
) -> dict:
    doc = {
        "id": str(uuid.uuid4()),
        "adminUserId": admin_user_id,
        "action": action,
        "targetType": target_type,
        "targetId": target_id,
        "reason": (reason or "").strip() or None,
        "metadata": _clean_metadata(metadata),
        "requestId": request_id,
        "ip": ip,
        "createdAt": _utc_now(),
    }
    await db[COLLECTION_ADMIN_AUDIT_LOGS].insert_one(doc)
    doc.pop("_id", None)
    return doc
