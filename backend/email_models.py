"""Data models for transactional email dispatch."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Literal, Optional

from email_templates import EmailLang

EmailDeliveryStatus = Literal["pending", "sent", "failed", "retrying", "skipped"]


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    preheader: str
    text_body: str
    html_body: str


@dataclass
class ProviderSendResult:
    success: bool
    provider_message_id: Optional[str] = None
    temporary_failure: bool = False
    error_code: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class EmailDispatchRequest:
    template_key: str
    to: str
    locale: EmailLang
    context: Dict[str, Any] = field(default_factory=dict)
    user_id: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    idempotency_key: Optional[str] = None


@dataclass
class EmailDispatchResult:
    event_id: str
    status: EmailDeliveryStatus
    delivered: bool
    message: str = ""
    provider: Optional[str] = None
    attempts: int = 1

    @property
    def email_sent(self) -> bool:
        return self.status == "sent"

    @property
    def email_queued(self) -> bool:
        return self.status in ("pending", "retrying")

    @property
    def email_skipped(self) -> bool:
        return self.status == "skipped"

    @property
    def email_failed(self) -> bool:
        return self.status == "failed"
