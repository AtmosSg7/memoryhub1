"""Signed OAuth state helpers."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any, Dict, Optional
from urllib.parse import quote, unquote

from integrations.config import integrations_token_key
from integrations.constants import OAUTH_STATE_TTL_SECONDS


def _sign(payload_b64: str) -> str:
    secret = integrations_token_key().encode("utf-8")
    return hmac.new(secret, payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()


def create_oauth_state(user_id: str, *, provider: str, extra: Optional[Dict[str, Any]] = None) -> str:
    body = {
        "uid": user_id,
        "provider": provider,
        "ts": int(time.time()),
        "extra": extra or {},
    }
    raw = json.dumps(body, separators=(",", ":"), sort_keys=True)
    # url-safe transport without padding issues
    import base64

    payload_b64 = base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8").rstrip("=")
    signature = _sign(payload_b64)
    return quote(f"{payload_b64}.{signature}", safe="")


def verify_oauth_state(
    state: str,
    *,
    user_id: Optional[str] = None,
    provider: Optional[str] = None,
) -> dict:
    if not state:
        raise ValueError("Missing OAuth state.")
    decoded = unquote(state)
    try:
        payload_b64, signature = decoded.rsplit(".", 1)
    except ValueError as exc:
        raise ValueError("Malformed OAuth state.") from exc

    expected = _sign(payload_b64)
    if not hmac.compare_digest(expected, signature):
        raise ValueError("Invalid OAuth state signature.")

    import base64

    padding = "=" * (-len(payload_b64) % 4)
    raw = base64.urlsafe_b64decode(payload_b64 + padding).decode("utf-8")
    body = json.loads(raw)
    ts = int(body.get("ts") or 0)
    if abs(int(time.time()) - ts) > OAUTH_STATE_TTL_SECONDS:
        raise ValueError("Expired OAuth state.")
    if user_id and body.get("uid") != user_id:
        raise ValueError("OAuth state user mismatch.")
    if provider and body.get("provider") != provider:
        raise ValueError("OAuth state provider mismatch.")
    return body
