"""At-rest encryption for OAuth tokens (Fernet)."""

from __future__ import annotations

import base64
import hashlib
from functools import lru_cache
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from integrations.config import integrations_token_key


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    raw = integrations_token_key().encode("utf-8")
    # Accept a real Fernet key, otherwise derive a stable url-safe 32-byte key.
    try:
        return Fernet(raw)
    except Exception:
        digest = hashlib.sha256(raw).digest()
        return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value)
    if not text:
        return ""
    return _fernet().encrypt(text.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value)
    if not text:
        return ""
    try:
        return _fernet().decrypt(text.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt integration secret.") from exc


def reset_fernet_for_tests() -> None:
    _fernet.cache_clear()
