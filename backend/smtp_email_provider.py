"""SMTP email provider — production-compatible delivery."""

from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage

from email_exceptions import EmailPermanentFailure, EmailTemporaryFailure
from email_models import ProviderSendResult

logger = logging.getLogger(__name__)


class SmtpEmailProvider:
    name = "smtp"

    def _from_address(self) -> str:
        from_email = (
            os.environ.get("SMTP_FROM_EMAIL") or os.environ.get("SMTP_FROM") or ""
        ).strip()
        from_name = os.environ.get("SMTP_FROM_NAME", "Basera").strip()
        if from_name:
            return f"{from_name} <{from_email}>"
        return from_email

    def send(
        self,
        *,
        to: str,
        subject: str,
        text_body: str,
        html_body: str,
    ) -> ProviderSendResult:
        host = os.environ["SMTP_HOST"].strip()
        port = int(os.environ.get("SMTP_PORT", "587"))
        user = os.environ.get("SMTP_USER", "").strip()
        password = os.environ.get("SMTP_PASSWORD", "").strip()
        use_tls = os.environ.get("SMTP_USE_TLS", "1").lower() in {"1", "true", "yes"}
        timeout = float(os.environ.get("SMTP_TIMEOUT_SECONDS", "30"))

        message = EmailMessage()
        message["From"] = self._from_address()
        message["To"] = to
        message["Subject"] = subject
        message.set_content(text_body)
        message.add_alternative(html_body, subtype="html")

        try:
            with smtplib.SMTP(host, port, timeout=timeout) as smtp:
                if use_tls:
                    smtp.starttls()
                if user and password:
                    smtp.login(user, password)
                refused = smtp.send_message(message)
            if refused:
                raise EmailPermanentFailure(
                    "Recipient refused by SMTP server.",
                    code="recipient_refused",
                )
            logger.info("SMTP email sent to recipient hash (subject=%s)", subject)
            return ProviderSendResult(success=True, provider_message_id=None)
        except EmailPermanentFailure as exc:
            logger.warning("SMTP permanent failure for recipient: %s", exc.code)
            return ProviderSendResult(
                success=False,
                temporary_failure=False,
                error_code=exc.code,
                error_message=str(exc),
            )
        except smtplib.SMTPAuthenticationError as exc:
            logger.error("SMTP authentication failed.")
            return ProviderSendResult(
                success=False,
                temporary_failure=False,
                error_code="auth_failed",
                error_message=str(exc),
            )
        except smtplib.SMTPRecipientsRefused as exc:
            logger.warning("SMTP recipients refused.")
            return ProviderSendResult(
                success=False,
                temporary_failure=False,
                error_code="recipient_refused",
                error_message=str(exc),
            )
        except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, TimeoutError, OSError) as exc:
            logger.warning("SMTP temporary failure: %s", type(exc).__name__)
            return ProviderSendResult(
                success=False,
                temporary_failure=True,
                error_code="connection",
                error_message=str(exc),
            )
        except smtplib.SMTPException as exc:
            logger.exception("SMTP error during send.")
            return ProviderSendResult(
                success=False,
                temporary_failure=True,
                error_code="smtp_error",
                error_message=str(exc),
            )
