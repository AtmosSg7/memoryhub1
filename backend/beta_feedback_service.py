"""Persist short beta feedback without attaching sensitive CRM data."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException

from beta_feedback_models import BetaFeedbackCreate, BetaFeedbackResponse
from observability import log_event
from security_config import IS_DEPLOYED


def beta_feedback_enabled() -> bool:
    """Soft feature gate: on in non-deployed envs, or when explicitly flagged."""
    flag = os.environ.get("BETA_FEEDBACK_ENABLED", "").strip().lower()
    if flag in {"1", "true", "yes", "on"}:
        return True
    if flag in {"0", "false", "no", "off"}:
        return False
    return not IS_DEPLOYED


def _sanitize_page(page: Optional[str]) -> Optional[str]:
    if not page:
        return None
    cleaned = page.strip()[:200]
    # Keep only app paths — never query payloads that may contain client data.
    if "?" in cleaned:
        cleaned = cleaned.split("?", 1)[0]
    if not cleaned.startswith("/"):
        cleaned = "/" + cleaned
    return cleaned[:200]


async def create_beta_feedback(
    db,
    user_id: str,
    body: BetaFeedbackCreate,
    *,
    user_agent: Optional[str] = None,
) -> BetaFeedbackResponse:
    if not beta_feedback_enabled():
        raise HTTPException(status_code=404, detail={"message": "Not found."})

    since = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    recent = await db.beta_feedback.count_documents(
        {"userId": user_id, "createdAt": {"$gte": since}}
    )
    if recent >= 5:
        raise HTTPException(
            status_code=429,
            detail={"message": "Trop de retours envoyés. Réessayez plus tard."},
        )

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "intent": body.intent.strip()[:500],
        "blocker": (body.blocker or "").strip()[:500],
        "suggestion": (body.suggestion or "").strip()[:1000],
        "page": _sanitize_page(body.page),
        "createdAt": now,
        "env": os.environ.get("ENV", "development"),
        "userAgent": (user_agent or "")[:200] or None,
    }
    await db.beta_feedback.insert_one(doc)
    log_event(
        "beta_feedback.created",
        user_id=user_id,
        result="ok",
        page=doc["page"],
    )
    return BetaFeedbackResponse(
        id=doc["id"],
        message="Merci pour votre retour.",
    )
