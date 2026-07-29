"""In-memory email provider for tests."""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar, List, Optional

from email_models import ProviderSendResult


@dataclass
class CapturedEmail:
    to: str
    subject: str
    text_body: str
    html_body: str


class FakeEmailProvider:
    """Captures outbound messages without network I/O."""

    name = "fake"
    _instance: ClassVar[Optional["FakeEmailProvider"]] = None

    def __init__(self) -> None:
        self.sent: List[CapturedEmail] = []
        self.fail_next = False
        self.temporary_failure = False
        self.permanent_failure = False

    @classmethod
    def instance(cls) -> "FakeEmailProvider":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        cls._instance = None

    def send(
        self,
        *,
        to: str,
        subject: str,
        text_body: str,
        html_body: str,
    ) -> ProviderSendResult:
        if self.permanent_failure:
            return ProviderSendResult(
                success=False,
                temporary_failure=False,
                error_code="permanent_test",
                error_message="Simulated permanent failure",
            )
        if self.fail_next or self.temporary_failure:
            self.fail_next = False
            return ProviderSendResult(
                success=False,
                temporary_failure=True,
                error_code="temporary_test",
                error_message="Simulated temporary failure",
            )
        self.sent.append(
            CapturedEmail(
                to=to,
                subject=subject,
                text_body=text_body,
                html_body=html_body,
            )
        )
        return ProviderSendResult(success=True, provider_message_id="fake-msg-id")
