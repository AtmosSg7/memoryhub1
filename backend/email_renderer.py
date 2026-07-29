"""Renders bilingual HTML + text emails from template keys and context."""

from __future__ import annotations

import html
import re
from typing import Any, Dict, Optional, Tuple

from email_constants import ALL_TEMPLATE_KEYS
from email_exceptions import EmailValidationError
from email_layout import information_card, render_email_layout
from email_models import RenderedEmail
from email_templates import (
    EmailLang,
    EmailMessage,
    build_email_verification_email,
    build_invoice_follow_up_email,
    build_invoice_send_email,
    build_password_changed_email,
    build_password_reset_email,
    build_payment_recorded_email,
    build_portal_access_email,
    build_quote_accepted_email,
    build_quote_follow_up_email,
    build_quote_rejected_email,
    build_quote_send_email,
    build_subscription_activated_email,
    build_subscription_cancellation_scheduled_email,
    build_subscription_cancelled_email,
    build_subscription_expired_email,
    build_subscription_payment_failed_email,
    build_subscription_plan_changed_email,
    build_subscription_reactivated_email,
    build_subscription_renewed_email,
    build_subscription_trial_started_email,
    build_welcome_email,
    format_amount,
)
from email_utils import sanitize_subject

_URL_RE = re.compile(r"^https?://", re.I)


def _lang(value: str) -> EmailLang:
    return "en" if value == "en" else "fr"


def _paragraphs_from_body(body: str) -> str:
    blocks = body.strip().split("\n\n")
    parts = []
    for block in blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue
        if len(lines) == 1 and _URL_RE.match(lines[0]):
            url = html.escape(lines[0], quote=True)
            parts.append(
                f'<p style="margin:0 0 12px;word-break:break-all;">'
                f'<a href="{url}" style="color:#4F46E5;">{url}</a></p>'
            )
            continue
        inner = "<br/>".join(html.escape(line) for line in lines)
        parts.append(
            '<p style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'
            "'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#52535E;"
            f'line-height:1.6;">{inner}</p>'
        )
    return "".join(parts)


def _extract_primary_url(body: str) -> Optional[str]:
    for line in body.splitlines():
        clean = line.strip()
        if _URL_RE.match(clean):
            return clean
    return None


def _cta_labels(lang: EmailLang) -> Dict[str, str]:
    if lang == "en":
        return {
            "verify": "Confirm my email",
            "reset": "Reset my password",
            "portal": "Access my portal",
            "quote": "View quote",
            "invoice": "View invoice",
            "billing": "Manage billing",
        }
    return {
        "verify": "Confirmer mon e-mail",
        "reset": "Réinitialiser mon mot de passe",
        "portal": "Accéder à mon espace",
        "quote": "Voir le devis",
        "invoice": "Voir la facture",
        "billing": "Gérer la facturation",
    }


def _build_plain_message(template_key: str, lang: EmailLang, ctx: Dict[str, Any]) -> Tuple[EmailMessage, Optional[str], Optional[str], Optional[str]]:
    """Returns (message, cta_url, cta_kind, security_text)."""
    labels = _cta_labels(lang)

    if template_key == "email_verification":
        msg = build_email_verification_email(
            lang=lang,
            greeting=ctx["greeting"],
            verify_url=ctx["verify_url"],
        )
        return msg, ctx["verify_url"], "verify", None

    if template_key == "password_reset":
        msg = build_password_reset_email(
            lang=lang,
            greeting=ctx["greeting"],
            reset_url=ctx["reset_url"],
        )
        return msg, ctx["reset_url"], "reset", None

    if template_key == "password_changed":
        return build_password_changed_email(lang=lang, greeting=ctx["greeting"]), None, None, None

    if template_key == "welcome":
        return build_welcome_email(lang=lang, greeting=ctx["greeting"]), None, None, None

    if template_key == "subscription_trial_started":
        return (
            build_subscription_trial_started_email(
                lang=lang,
                greeting=ctx["greeting"],
                plan_name=ctx["plan_name"],
            ),
            None,
            None,
            None,
        )

    if template_key == "subscription_activated":
        return (
            build_subscription_activated_email(
                lang=lang,
                greeting=ctx["greeting"],
                plan_name=ctx["plan_name"],
            ),
            None,
            None,
            None,
        )

    if template_key == "subscription_renewed":
        return (
            build_subscription_renewed_email(
                lang=lang,
                greeting=ctx["greeting"],
                plan_name=ctx["plan_name"],
            ),
            None,
            None,
            None,
        )

    if template_key == "subscription_plan_changed":
        return (
            build_subscription_plan_changed_email(
                lang=lang,
                greeting=ctx["greeting"],
                plan_name=ctx["plan_name"],
            ),
            None,
            None,
            None,
        )

    if template_key == "subscription_cancellation_scheduled":
        return (
            build_subscription_cancellation_scheduled_email(
                lang=lang,
                greeting=ctx["greeting"],
                plan_name=ctx["plan_name"],
                period_end=ctx["period_end"],
            ),
            None,
            None,
            None,
        )

    if template_key == "subscription_cancelled":
        return (
            build_subscription_cancelled_email(
                lang=lang,
                greeting=ctx["greeting"],
                plan_name=ctx["plan_name"],
            ),
            None,
            None,
            None,
        )

    if template_key == "subscription_reactivated":
        return (
            build_subscription_reactivated_email(
                lang=lang,
                greeting=ctx["greeting"],
                plan_name=ctx["plan_name"],
            ),
            None,
            None,
            None,
        )

    if template_key == "subscription_payment_failed":
        return (
            build_subscription_payment_failed_email(
                lang=lang,
                greeting=ctx["greeting"],
                plan_name=ctx["plan_name"],
                billing_url=ctx["billing_url"],
            ),
            ctx["billing_url"],
            "billing",
            None,
        )

    if template_key == "subscription_expired":
        return (
            build_subscription_expired_email(
                lang=lang,
                greeting=ctx["greeting"],
                plan_name=ctx["plan_name"],
            ),
            None,
            None,
            None,
        )

    if template_key == "quote_sent":
        msg = build_quote_send_email(
            lang=lang,
            greeting=ctx["greeting"],
            number=ctx["number"],
            title=ctx.get("title") or "",
            amount_ttc=int(ctx.get("amount_ttc") or 0),
            sender_name=ctx["sender_name"],
            portal_url=ctx.get("portal_url"),
        )
        portal_url = ctx.get("portal_url")
        return msg, portal_url, "quote" if portal_url else None, None

    if template_key == "invoice_sent":
        msg = build_invoice_send_email(
            lang=lang,
            greeting=ctx["greeting"],
            number=ctx["number"],
            amount_ttc=int(ctx.get("amount_ttc") or 0),
            sender_name=ctx["sender_name"],
            portal_url=ctx.get("portal_url"),
        )
        portal_url = ctx.get("portal_url")
        return msg, portal_url, "invoice" if portal_url else None, None

    if template_key == "portal_access":
        msg = build_portal_access_email(
            lang=lang,
            greeting=ctx["greeting"],
            sender_name=ctx["sender_name"],
            portal_url=ctx["portal_url"],
        )
        security = (
            "This link is private — do not share it with others."
            if lang == "en"
            else "Ce lien est personnel — ne le partagez pas."
        )
        return msg, ctx["portal_url"], "portal", security

    if template_key == "quote_accepted":
        return (
            build_quote_accepted_email(
                lang=lang,
                greeting=ctx["greeting"],
                client_name=ctx["client_name"],
                number=ctx["number"],
                amount_ttc=int(ctx.get("amount_ttc") or 0),
            ),
            None,
            None,
            None,
        )

    if template_key == "quote_rejected":
        return (
            build_quote_rejected_email(
                lang=lang,
                greeting=ctx["greeting"],
                client_name=ctx["client_name"],
                number=ctx["number"],
                amount_ttc=int(ctx.get("amount_ttc") or 0),
            ),
            None,
            None,
            None,
        )

    if template_key == "quote_follow_up":
        msg = build_quote_follow_up_email(
            lang=lang,
            greeting=ctx["greeting"],
            number=ctx["number"],
            title=ctx.get("title") or "",
            amount_ttc=int(ctx.get("amount_ttc") or 0),
            sender_name=ctx["sender_name"],
            portal_url=ctx.get("portal_url"),
        )
        portal_url = ctx.get("portal_url")
        return msg, portal_url, "quote" if portal_url else None, None

    if template_key == "invoice_follow_up":
        return (
            build_invoice_follow_up_email(
                lang=lang,
                greeting=ctx["greeting"],
                number=ctx["number"],
                amount_ttc=int(ctx.get("amount_ttc") or 0),
                amount_due=int(ctx.get("amount_due") or 0),
                sender_name=ctx["sender_name"],
            ),
            None,
            None,
            None,
        )

    if template_key == "payment_recorded":
        msg = build_payment_recorded_email(
            lang=lang,
            greeting=ctx["greeting"],
            number=ctx["number"],
            amount=int(ctx.get("amount") or 0),
            amount_due=int(ctx.get("amount_due") or 0),
            portal_url=ctx.get("portal_url"),
        )
        portal_url = ctx.get("portal_url")
        return msg, portal_url, "invoice" if portal_url else None, None

    raise EmailValidationError(f"Unknown email template: {template_key}")


def _document_card_html(template_key: str, lang: EmailLang, ctx: Dict[str, Any]) -> str:
    if template_key == "quote_sent":
        lines = [
            f"{'Quote' if lang == 'en' else 'Devis'}: {ctx['number']}",
            f"{'Amount' if lang == 'en' else 'Montant'}: {format_amount(int(ctx.get('amount_ttc') or 0), lang)}",
        ]
        if ctx.get("status"):
            lines.append(f"{'Status' if lang == 'en' else 'Statut'}: {ctx['status']}")
        return information_card(lines)
    if template_key == "invoice_sent":
        lines = [
            f"{'Invoice' if lang == 'en' else 'Facture'}: {ctx['number']}",
            f"{'Amount' if lang == 'en' else 'Montant'}: {format_amount(int(ctx.get('amount_ttc') or 0), lang)}",
        ]
        if ctx.get("amount_due") is not None:
            label = "Balance due" if lang == "en" else "Reste à régler"
            lines.append(f"{label}: {format_amount(int(ctx['amount_due']), lang)}")
        return information_card(lines)
    return ""


def render_template(template_key: str, *, locale: str, context: Dict[str, Any]) -> RenderedEmail:
    if template_key not in ALL_TEMPLATE_KEYS:
        raise EmailValidationError(f"Unknown email template: {template_key}")

    lang = _lang(locale)
    message, cta_url, cta_kind, security_text = _build_plain_message(template_key, lang, context)
    subject = sanitize_subject(message.subject)

    body_html = _paragraphs_from_body(message.body)
    doc_card = _document_card_html(template_key, lang, context)
    if doc_card:
        body_html = doc_card + body_html

    labels = _cta_labels(lang)
    cta_label = labels.get(cta_kind) if cta_kind else None
    if not cta_url:
        cta_url = _extract_primary_url(message.body)
        if cta_url and not cta_label:
            cta_label = labels.get("verify") or labels.get("reset")

    title = message.preheader or subject
    html_body = render_email_layout(
        locale=lang,
        title=title,
        preheader=message.preheader,
        body_html=body_html,
        cta_label=cta_label,
        cta_url=cta_url,
        fallback_url=cta_url,
        security_text=security_text,
    )

    return RenderedEmail(
        subject=subject,
        preheader=message.preheader,
        text_body=message.body,
        html_body=html_body,
    )
