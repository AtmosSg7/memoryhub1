"""Email provider protocol and factory."""

from __future__ import annotations

import logging
import os
from typing import Optional, Protocol

from email_constants import (
    EMAIL_PROVIDER_CONSOLE,
    EMAIL_PROVIDER_FAKE,
    EMAIL_PROVIDER_NONE,
    EMAIL_PROVIDER_SMTP,
)
from email_models import ProviderSendResult
from security_config import IS_PRODUCTION

logger = logging.getLogger(__name__)

_override_provider = None


class EmailProvider(Protocol):
    name: str

    def send(
        self,
        *,
        to: str,
        subject: str,
        text_body: str,
        html_body: str,
    ) -> ProviderSendResult: ...


def set_provider_for_tests(provider: EmailProvider) -> None:
    global _override_provider
    _override_provider = provider


def reset_provider_for_tests() -> None:
    global _override_provider
    _override_provider = None


def _resolve_provider_name() -> str:
    explicit = os.environ.get("EMAIL_PROVIDER", "").strip().lower()
    if explicit:
        return explicit
    if IS_PRODUCTION:
        return EMAIL_PROVIDER_SMTP
    return EMAIL_PROVIDER_CONSOLE


def is_smtp_configured() -> bool:
    host = os.environ.get("SMTP_HOST", "").strip()
    from_email = (
        os.environ.get("SMTP_FROM_EMAIL") or os.environ.get("SMTP_FROM") or ""
    ).strip()
    return bool(host and from_email)


def get_email_provider() -> EmailProvider:
    if _override_provider is not None:
        return _override_provider

    name = _resolve_provider_name()

    if name == EMAIL_PROVIDER_FAKE:
        from fake_email_provider import FakeEmailProvider

        return FakeEmailProvider.instance()

    if name == EMAIL_PROVIDER_NONE:
        from console_email_provider import NoOpEmailProvider

        return NoOpEmailProvider()

    if name == EMAIL_PROVIDER_CONSOLE:
        from console_email_provider import ConsoleEmailProvider

        return ConsoleEmailProvider()

    if name == EMAIL_PROVIDER_SMTP:
        if not is_smtp_configured():
            if IS_PRODUCTION:
                logger.error(
                    "EMAIL_PROVIDER=smtp but SMTP_HOST or SMTP_FROM_EMAIL is missing in production."
                )
                from console_email_provider import NoOpEmailProvider

                return NoOpEmailProvider()
            logger.info("SMTP not configured — using console preview provider in development.")
            from console_email_provider import ConsoleEmailProvider

            return ConsoleEmailProvider()
        from smtp_email_provider import SmtpEmailProvider

        return SmtpEmailProvider()

    logger.warning("Unknown EMAIL_PROVIDER=%s — falling back to console.", name)
    from console_email_provider import ConsoleEmailProvider

    return ConsoleEmailProvider()


def provider_display_name(provider: Optional[EmailProvider] = None) -> str:
    p = provider or get_email_provider()
    return getattr(p, "name", "unknown")
