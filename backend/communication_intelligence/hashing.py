"""Content hashing for idempotent analysis."""

from __future__ import annotations

import hashlib


def build_content_hash(communication: dict, *, version: str) -> str:
    meta = communication.get("metadata") or {}
    parts = [
        version,
        str(communication.get("subject") or ""),
        str(communication.get("preview") or ""),
        str(meta.get("fromEmail") or ""),
        str(communication.get("direction") or ""),
        str(communication.get("clientId") or ""),
    ]
    raw = "\n".join(parts).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def truncate_text(value: str, max_chars: int) -> str:
    text = (value or "").strip()
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1].rstrip() + "…"
