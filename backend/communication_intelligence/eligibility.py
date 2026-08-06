"""Decide whether a communication should be analyzed."""

from __future__ import annotations

from typing import Optional, Tuple


def eligibility_for_analysis(communication: dict) -> Tuple[bool, Optional[str]]:
    """Return (ok, skip_reason). Only inbound, non-ignored, non-noise emails (Gmail first)."""
    if not communication:
        return False, "missing_communication"

    direction = (communication.get("direction") or "").lower()
    if direction != "inbound":
        return False, "outbound_or_internal"

    if communication.get("ignoredAt") or (communication.get("status") or "") == "ignored":
        return False, "ignored"

    ctype = (communication.get("type") or "").lower()
    if ctype not in {"email", "whatsapp", "sms", "phone"}:
        return False, "unsupported_type"

    # Gmail-first mission: only the email channel (WhatsApp/SMS later).
    if ctype != "email":
        return False, "channel_not_enabled"

    meta = communication.get("metadata") or {}
    from_email = meta.get("fromEmail") or meta.get("from_email")
    subject = communication.get("subject") or ""
    try:
        from prospects.identity import classify_email_noise

        noise = classify_email_noise(email=from_email, subject=subject)
    except Exception:
        noise = None
    if noise:
        return False, f"noise_{noise}"

    preview = (communication.get("preview") or "").strip()
    if not preview and not subject.strip():
        return False, "empty_content"

    return True, None
