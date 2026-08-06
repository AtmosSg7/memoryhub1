"""MongoDB distributed locks with TTL reclaim (multi-instance safe)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def acquire_lock(
    db,
    key: str,
    *,
    owner: str,
    ttl_seconds: int,
) -> bool:
    """Acquire a lock identified by ``key``.

    Uses collection ``distributed_locks``. Expired locks are reclaimable.
    """
    if not key or not owner:
        return False
    ttl = max(1, int(ttl_seconds))
    now = _utc_now()
    expires = now + timedelta(seconds=ttl)
    doc = {
        "_id": key,
        "owner": owner,
        "acquiredAt": now,
        "expiresAt": expires,
    }
    try:
        await db.distributed_locks.insert_one(doc)
        return True
    except DuplicateKeyError:
        pass

    # Reclaim if expired (TTL index may lag; reclaim is authoritative).
    claimed = await db.distributed_locks.find_one_and_update(
        {"_id": key, "expiresAt": {"$lte": now}},
        {"$set": {"owner": owner, "acquiredAt": now, "expiresAt": expires}},
        return_document=ReturnDocument.AFTER,
    )
    return claimed is not None


async def release_lock(db, key: str, *, owner: str) -> bool:
    """Release a lock only if held by ``owner``. Returns True when deleted."""
    if not key or not owner:
        return False
    result = await db.distributed_locks.delete_one({"_id": key, "owner": owner})
    return int(result.deleted_count or 0) > 0


async def get_lock(db, key: str) -> Optional[dict]:
    return await db.distributed_locks.find_one({"_id": key})
