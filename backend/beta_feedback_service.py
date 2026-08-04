"""Persist short beta feedback without attaching sensitive CRM data."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException

from beta_feedback_models import BetaFeedbackCreate, BetaFeedbackResponse
from email_utils import support_email
from form_abuse import assert_human_submission
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


def _notify_support_of_feedback(doc: dict, *, user_email: Optional[str] = None) -> None:
    """Best-effort notify — persistence already succeeded; never fail the request."""
    try:
        from email_provider import get_email_provider

        to = support_email()
        subject = f"[Basera feedback] {(doc.get('intent') or '')[:80]}"
        lines = [
            f"Feedback id: {doc.get('id')}",
            f"User id: {doc.get('userId')}",
            f"User email: {user_email or '(unknown)'}",
            f"Page: {doc.get('page') or '-'}",
            f"Env: {doc.get('env')}",
            f"Created: {doc.get('createdAt')}",
            "",
            "Intent:",
            doc.get("intent") or "",
            "",
            "Blocker:",
            doc.get("blocker") or "(none)",
            "",
            "Suggestion:",
            doc.get("suggestion") or "(none)",
        ]
        text_body = "\n".join(lines)
        html_body = "<pre style=\"font-family:sans-serif;white-space:pre-wrap\">" + (
            text_body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        ) + "</pre>"
        get_email_provider().send(
            to=to,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
    except Exception:
        log_event(
            "beta_feedback.notify_failed",
            user_id=doc.get("userId"),
            result="error",
        )


async def create_beta_feedback(
    db,
    user_id: str,
    body: BetaFeedbackCreate,
    *,
    user_agent: Optional[str] = None,
    user_email: Optional[str] = None,
) -> BetaFeedbackResponse:
    if not beta_feedback_enabled():
        raise HTTPException(status_code=404, detail={"message": "Not found."})

    assert_human_submission(
        website=body.website,
        form_started_at=body.formStartedAt,
        route="beta.feedback",
    )

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
    _notify_support_of_feedback(doc, user_email=user_email)
    return BetaFeedbackResponse(
        id=doc["id"],
        message="Merci pour votre retour.",
    )
