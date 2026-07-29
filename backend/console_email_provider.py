"""Development console provider — honest preview without claiming delivery."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from pathlib import Path

from email_models import ProviderSendResult

logger = logging.getLogger(__name__)

_PREVIEW_DIR = Path(__file__).parent / "email_previews"
_SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9._-]+")


class ConsoleEmailProvider:
    """Writes HTML previews locally; status is skipped (not sent)."""

    name = "console"

    def _write_preview(self, *, to: str, subject: str, text_body: str, html_body: str) -> Path:
        _PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        safe_subject = _SAFE_NAME_RE.sub("_", subject)[:60]
        base = f"{stamp}_{safe_subject}"
        html_path = _PREVIEW_DIR / f"{base}.html"
        text_path = _PREVIEW_DIR / f"{base}.txt"
        meta_path = _PREVIEW_DIR / f"{base}.meta.txt"

        html_path.write_text(html_body, encoding="utf-8")
        text_path.write_text(text_body, encoding="utf-8")
        meta_path.write_text(
            f"to={to}\nsubject={subject}\nmode=preview_not_sent\n",
            encoding="utf-8",
        )
        return html_path

    def send(
        self,
        *,
        to: str,
        subject: str,
        text_body: str,
        html_body: str,
    ) -> ProviderSendResult:
        path = self._write_preview(
            to=to,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
        logger.info(
            "Email preview written (not sent): %s — subject=%s",
            path.name,
            subject,
        )
        return ProviderSendResult(
            success=False,
            error_code="preview_only",
            error_message=f"Preview written to {path}",
        )


class NoOpEmailProvider:
    """Used when email is disabled or misconfigured in production."""

    name = "none"

    def send(
        self,
        *,
        to: str,
        subject: str,
        text_body: str,
        html_body: str,
    ) -> ProviderSendResult:
        logger.error(
            "Email delivery disabled — message not sent (subject=%s).",
            subject,
        )
        return ProviderSendResult(
            success=False,
            temporary_failure=True,
            error_code="not_configured",
            error_message="Email provider not configured",
        )
