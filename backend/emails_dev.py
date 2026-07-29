"""Development-only email template preview API."""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from email_constants import ALL_TEMPLATE_KEYS
from email_renderer import render_template
from security_config import IS_PRODUCTION

emails_dev_router = APIRouter(prefix="/dev/emails", tags=["dev-emails"])

_DEMO_CONTEXT = {
    "email_verification": {
        "greeting": "Julie",
        "verify_url": "https://app.memoryhub.fr/verify-email?token=DEMO_TOKEN",
    },
    "password_reset": {
        "greeting": "Julie",
        "reset_url": "https://app.memoryhub.fr/reset-password?token=DEMO_TOKEN",
    },
    "password_changed": {"greeting": "Julie"},
    "welcome": {"greeting": "Julie"},
    "subscription_trial_started": {"greeting": "Julie", "plan_name": "Pro"},
    "subscription_activated": {"greeting": "Julie", "plan_name": "Pro"},
    "subscription_renewed": {"greeting": "Julie", "plan_name": "Pro"},
    "subscription_plan_changed": {"greeting": "Julie", "plan_name": "Business"},
    "subscription_cancellation_scheduled": {
        "greeting": "Julie",
        "plan_name": "Pro",
        "period_end": "31/12/2026",
    },
    "subscription_cancelled": {"greeting": "Julie", "plan_name": "Pro"},
    "subscription_reactivated": {"greeting": "Julie", "plan_name": "Pro"},
    "subscription_payment_failed": {
        "greeting": "Julie",
        "plan_name": "Pro",
        "billing_url": "https://app.memoryhub.fr/dashboard/billing",
    },
    "subscription_expired": {"greeting": "Julie", "plan_name": "Pro"},
    "quote_sent": {
        "greeting": "Jean Dupont",
        "number": "2026-0042",
        "title": "Rénovation cuisine",
        "amount_ttc": 120000,
        "sender_name": "Martin Rénovation",
        "portal_url": "https://app.memoryhub.fr/portal/DEMO",
        "status": "sent",
    },
    "invoice_sent": {
        "greeting": "Jean Dupont",
        "number": "FA-2026-0012",
        "amount_ttc": 120000,
        "amount_due": 60000,
        "sender_name": "Martin Rénovation",
        "portal_url": "https://app.memoryhub.fr/portal/DEMO",
    },
    "portal_access": {
        "greeting": "Jean Dupont",
        "sender_name": "Martin Rénovation",
        "portal_url": "https://app.memoryhub.fr/portal/DEMO",
    },
    "quote_accepted": {
        "greeting": "Martin",
        "client_name": "Jean Dupont",
        "number": "2026-0042",
        "amount_ttc": 120000,
    },
    "payment_recorded": {
        "greeting": "Jean Dupont",
        "number": "FA-2026-0012",
        "amount": 60000,
        "amount_due": 60000,
        "portal_url": "https://app.memoryhub.fr/portal/DEMO",
    },
}


def require_dev_mode() -> None:
    if IS_PRODUCTION:
        raise HTTPException(status_code=404, detail={"message": "Not found."})


@emails_dev_router.get("/preview")
async def preview_email_template(
    template: str = Query(...),
    locale: Literal["fr", "en"] = Query("fr"),
    _: None = Depends(require_dev_mode),
):
    if template not in ALL_TEMPLATE_KEYS:
        raise HTTPException(status_code=400, detail={"message": "Unknown template."})
    context = _DEMO_CONTEXT.get(template, {})
    rendered = render_template(template, locale=locale, context=context)
    return {
        "template": template,
        "locale": locale,
        "subject": rendered.subject,
        "preheader": rendered.preheader,
        "text": rendered.text_body,
        "html": rendered.html_body,
        "demo": True,
    }


@emails_dev_router.get("/templates")
async def list_email_templates(_: None = Depends(require_dev_mode)):
    return {"templates": sorted(ALL_TEMPLATE_KEYS)}
