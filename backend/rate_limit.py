import os
import time
from collections import defaultdict
from typing import Callable, DefaultDict, List, Tuple

from fastapi import HTTPException, Request

BucketKey = Tuple[str, str]
_buckets: DefaultDict[BucketKey, List[float]] = defaultdict(list)


def rate_limit(max_requests: int, window_seconds: int, *, key_suffix: str = "") -> Callable:
    """Simple in-memory rate limiter keyed by client IP and route path."""

    if os.environ.get("E2E_DISABLE_RATE_LIMIT", "").lower() in {"1", "true", "yes"}:
        def noop(_request: Request) -> None:
            return None

        return noop

    def dependency(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        path = request.url.path + key_suffix
        key: BucketKey = (ip, path)
        now = time.time()
        window_start = now - window_seconds
        hits = [timestamp for timestamp in _buckets[key] if timestamp > window_start]
        if len(hits) >= max_requests:
            raise HTTPException(
                status_code=429,
                detail={"message": "Too many requests. Please try again later."},
            )
        hits.append(now)
        _buckets[key] = hits

    return dependency
