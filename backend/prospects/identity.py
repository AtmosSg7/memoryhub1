"""Identity keys and automatic-noise classification for prospects.

Channel-agnostic: today ``email:<normalized>``, later ``phone:`` / ``whatsapp:``.
Grouping never uses name alone. Exact normalized email is the strong key.
"""

from __future__ import annotations

import re
from typing import Optional, Tuple

from integrations.matching import normalize_email_loose, normalize_phone_fr, normalize_text

# Local-parts that indicate machines / broadcast, not a person.
_NOISE_LOCAL_RE = re.compile(
    r"^(?:"
    r"no[-_.]?reply|do[-_.]?not[-_.]?reply|noreply|donotreply|"
    r"mailer[-_.]?daemon|postmaster|bounce|bounces|"
    r"newsletter|news|marketing|promo|promotions|"
    r"notification|notifications|notify|alerts?|"
    r"automated?|auto[-_.]?confirm|auto[-_.]?reply|"
    r"support[-_.]?noreply|info[-_.]?noreply|"
    r"unsubscribe|daemon|robot|bot"
    r")(?:[+._-].*)?$",
    re.IGNORECASE,
)

_NOISE_SUBJECT_RE = re.compile(
    r"(?:^|\b)(?:newsletter|unsubscribe|mailing\s*list|no[- ]?reply)(?:\b|$)",
    re.IGNORECASE,
)

# Domains that are almost never a commercial counterparty for an artisan CRM.
_TECHNICAL_DOMAINS = frozenset(
    {
        "facebookmail.com",
        "facebook.com",
        "linkedin.com",
        "lnkd.in",
        "google.com",
        "accounts.google.com",
        "email.apple.com",
        "itunes.com",
        "amazonses.com",
        "sendgrid.net",
        "mailchimp.com",
        "mandrillapp.com",
        "stripe.com",
        "paypal.com",
        "github.com",
        "noreply.github.com",
    }
)

FREE_MAIL_DOMAINS = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "yahoo.fr",
        "yahoo.com",
        "hotmail.com",
        "outlook.com",
        "orange.fr",
        "free.fr",
        "laposte.net",
        "icloud.com",
        "live.fr",
        "live.com",
        "msn.com",
        "sfr.fr",
        "wanadoo.fr",
    }
)

NoiseClass = Optional[str]  # None | noreply | newsletter | notification | technical


def email_domain(value: Optional[str]) -> str:
    email = normalize_email_loose(value)
    if "@" not in email:
        return ""
    return email.split("@", 1)[1]


def identity_key_for_email(email: Optional[str]) -> Optional[str]:
    normalized = normalize_email_loose(email)
    if not normalized or "@" not in normalized:
        return None
    return f"email:{normalized}"


def identity_key_for_phone(phone: Optional[str]) -> Optional[str]:
    normalized = normalize_phone_fr(phone)
    if not normalized:
        return None
    return f"phone:{normalized}"


def classify_email_noise(
    *,
    email: Optional[str],
    from_name: Optional[str] = None,
    subject: Optional[str] = None,
) -> NoiseClass:
    """Return a noise class, or None if the address looks like a real person/company."""
    normalized = normalize_email_loose(email)
    if not normalized or "@" not in normalized:
        return "technical"

    local, _, domain = normalized.partition("@")
    if _NOISE_LOCAL_RE.match(local or ""):
        if "newsletter" in (local or "").lower() or (subject and "newsletter" in subject.lower()):
            return "newsletter"
        if any(token in (local or "").lower() for token in ("notif", "alert", "notify")):
            return "notification"
        return "noreply"

    if domain in _TECHNICAL_DOMAINS:
        return "technical"

    if subject and _NOISE_SUBJECT_RE.search(subject):
        # Subject hint alone is weak — only classify when local also looks broadcast-ish
        if any(token in local for token in ("news", "info", "contact", "hello", "mail")):
            return "newsletter"

    # Display names like "Mailchimp" with no personal name — leave as candidate;
    # name alone must never drive grouping or auto-create.
    _ = normalize_text(from_name)
    return None


def guess_company_from_email(email: Optional[str]) -> Optional[str]:
    domain = email_domain(email)
    if not domain or domain in FREE_MAIL_DOMAINS:
        return None
    root = domain.split(".")[0]
    if not root or root in ("mail", "email", "smtp", "mx"):
        return None
    return root.replace("-", " ").replace("_", " ").title()


def guess_display_name(*, from_name: Optional[str], email: Optional[str]) -> Optional[str]:
    name = (from_name or "").strip()
    if name:
        return name
    normalized = normalize_email_loose(email)
    if not normalized or "@" not in normalized:
        return None
    local = normalized.split("@", 1)[0]
    return local.replace(".", " ").replace("_", " ").replace("-", " ").title() or None


def parse_identity_key(identity_key: str) -> Tuple[str, str]:
    """Return (channel, value) from ``email:x@y`` / ``phone:06…``."""
    if ":" not in identity_key:
        raise ValueError("invalid_identity_key")
    channel, value = identity_key.split(":", 1)
    if channel not in ("email", "phone", "whatsapp", "sms") or not value:
        raise ValueError("invalid_identity_key")
    return channel, value
