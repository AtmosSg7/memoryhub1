"""Shared helpers for email validation, privacy, and URLs."""

from __future__ import annotations

import hashlib
import os
import re
from typing import Optional
from urllib.parse import urlparse

from email_constants import MAX_SUBJECT_LENGTH
from email_exceptions import EmailValidationError
from security_config import IS_PRODUCTION

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_HEADER_INJECTION_RE = re.compile(r"[\r\n]")


def normalize_email(value: str) -> str:
    cleaned = (value or "").strip().lower()
    if not cleaned or not _EMAIL_RE.match(cleaned):
        raise EmailValidationError("Invalid recipient email address.")
    if len(cleaned) > 254:
        raise EmailValidationError("Recipient email address is too long.")
    return cleaned


def sanitize_subject(value: str) -> str:
    subject = _HEADER_INJECTION_RE.sub(" ", (value or "").strip())
    if not subject:
        raise EmailValidationError("Email subject is required.")
    if len(subject) > MAX_SUBJECT_LENGTH:
        subject = subject[:MAX_SUBJECT_LENGTH]
    return subject


def hash_recipient(email: str) -> str:
    normalized = normalize_email(email)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


def mask_token(token: str) -> str:
    if not token:
        return "(empty)"
    if len(token) <= 8:
        return "***"
    return f"{token[:4]}…{token[-4:]}"


def frontend_public_url(path: str = "") -> str:
    base = (
        os.environ.get("FRONTEND_PUBLIC_URL")
        or os.environ.get("FRONTEND_URL")
        or "http://localhost:3000"
    ).rstrip("/")
    if not path:
        return base
    if not path.startswith("/"):
        path = f"/{path}"
    url = f"{base}{path}"
    if IS_PRODUCTION and not url.startswith("https://"):
        raise EmailValidationError("Frontend links must use HTTPS in production.")
    return url


def support_email() -> str:
    return (os.environ.get("SUPPORT_EMAIL") or "support@memoryhub.fr").strip()


def is_https_url(url: str) -> bool:
    try:
        return urlparse(url).scheme == "https"
    except Exception:
        return False
