"""Short-lived in-memory analytics cache with per-user invalidation."""

from __future__ import annotations

import os
import threading
import time
from typing import Any, Dict, Optional, Tuple

# Default 45s — short enough that paid invoices refresh quickly after mutations.
CACHE_TTL_SECONDS = max(5, int(os.environ.get("ANALYTICS_CACHE_TTL_SECONDS", "45")))

_lock = threading.Lock()
_store: Dict[str, Tuple[float, Any]] = {}


def _key(user_id: str, *parts: str) -> str:
    return "|".join([user_id, *parts])


def get_cached(user_id: str, *parts: str) -> Optional[Any]:
    key = _key(user_id, *parts)
    now = time.monotonic()
    with _lock:
        entry = _store.get(key)
        if not entry:
            return None
        expires_at, payload = entry
        if expires_at < now:
            _store.pop(key, None)
            return None
        return payload


def set_cached(user_id: str, payload: Any, *parts: str) -> None:
    key = _key(user_id, *parts)
    with _lock:
        _store[key] = (time.monotonic() + CACHE_TTL_SECONDS, payload)


def invalidate_user(user_id: Optional[str]) -> None:
    if not user_id:
        return
    prefix = f"{user_id}|"
    with _lock:
        for key in [k for k in _store if k.startswith(prefix)]:
            _store.pop(key, None)


def clear_all_for_tests() -> None:
    with _lock:
        _store.clear()
