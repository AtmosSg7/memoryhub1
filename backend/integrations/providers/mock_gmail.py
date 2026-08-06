"""Mock Gmail provider for tests and local dev without credentials."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode

from integrations.constants import PROVIDER_GMAIL
from integrations.email_provider import EmailProvider
from integrations.gmail_errors import GmailHistoryExpiredError
from integrations.models import (
    GmailHistoryResult,
    GmailMailboxProfile,
    RemoteEmailAttachment,
    RemoteEmailMessage,
)

_MOCK_CODES: Dict[str, dict] = {}
_MOCK_MESSAGES: List[RemoteEmailMessage] = []
# (historyId_int, message) — append-only log for incremental sync
_MOCK_HISTORY: List[Tuple[int, RemoteEmailMessage]] = []
_MOCK_HISTORY_ID = 1000
_MOCK_FORCE_HISTORY_EXPIRED = False
_MOCK_ACCOUNT_EMAIL = "artisan@gmail.com"
_MOCK_ACCOUNT_ID = "mock-gmail-user-1"


def reset_mock_gmail() -> None:
    global _MOCK_HISTORY_ID, _MOCK_FORCE_HISTORY_EXPIRED
    _MOCK_CODES.clear()
    _MOCK_MESSAGES.clear()
    _MOCK_HISTORY.clear()
    _MOCK_HISTORY_ID = 1000
    _MOCK_FORCE_HISTORY_EXPIRED = False


def force_mock_history_expired(enabled: bool = True) -> None:
    global _MOCK_FORCE_HISTORY_EXPIRED
    _MOCK_FORCE_HISTORY_EXPIRED = enabled


def current_mock_history_id() -> str:
    return str(_MOCK_HISTORY_ID)


def seed_mock_gmail(messages: Optional[List[RemoteEmailMessage]] = None) -> None:
    global _MOCK_HISTORY_ID
    _MOCK_MESSAGES.clear()
    _MOCK_HISTORY.clear()
    batch = list(messages) if messages else _default_messages()
    _MOCK_MESSAGES.extend(batch)
    for msg in batch:
        _MOCK_HISTORY_ID += 1
        _MOCK_HISTORY.append((_MOCK_HISTORY_ID, msg))


def append_mock_gmail_message(message: RemoteEmailMessage) -> str:
    """Append a message and advance historyId (for incremental sync tests)."""
    global _MOCK_HISTORY_ID
    _MOCK_MESSAGES.append(message)
    _MOCK_HISTORY_ID += 1
    _MOCK_HISTORY.append((_MOCK_HISTORY_ID, message))
    return str(_MOCK_HISTORY_ID)


def register_mock_gmail_auth_code(
    code: str,
    *,
    account_email: str = "artisan@gmail.com",
    account_id: str = "mock-gmail-user-1",
) -> None:
    _MOCK_CODES[code] = {
        "access_token": f"mock-gmail-access-{code}",
        "refresh_token": f"mock-gmail-refresh-{code}",
        "expires_in": 3600,
        "token_type": "Bearer",
        "scope": "https://www.googleapis.com/auth/gmail.readonly",
        "account_email": account_email,
        "account_name": "Artisan Gmail",
        "account_id": account_id,
    }


def _default_messages() -> List[RemoteEmailMessage]:
    return [
        RemoteEmailMessage(
            sourceId="gmail-msg-1",
            threadId="thread-1",
            subject="Devis plomberie cuisine",
            snippet="Bonjour, pourriez-vous me rappeler pour le devis…",
            fromEmail="jean@martin.fr",
            fromName="Jean Martin",
            toEmails=["artisan@gmail.com"],
            direction="inbound",
            sentAt="2026-07-20T09:15:00+00:00",
            webLink="https://mail.google.com/mail/u/0/#inbox/thread-1",
            attachments=[
                RemoteEmailAttachment(filename="photos.zip", mimeType="application/zip", size=2048)
            ],
        ),
        RemoteEmailMessage(
            sourceId="gmail-msg-2",
            threadId="thread-2",
            subject="Confirmation intervention",
            snippet="Voici la confirmation pour mardi matin…",
            fromEmail="artisan@gmail.com",
            fromName="Artisan Gmail",
            toEmails=["sophie@durand.fr"],
            direction="outbound",
            sentAt="2026-07-21T14:00:00+00:00",
            webLink="https://mail.google.com/mail/u/0/#inbox/thread-2",
            attachments=[],
        ),
        RemoteEmailMessage(
            sourceId="gmail-msg-3",
            threadId="thread-3",
            subject="Newsletter fournisseurs",
            snippet="Nos promotions du mois…",
            fromEmail="newsletter@fournisseur.example",
            fromName="Fournisseur",
            toEmails=["artisan@gmail.com"],
            direction="inbound",
            sentAt="2026-07-22T08:00:00+00:00",
            webLink="https://mail.google.com/mail/u/0/#inbox/thread-3",
        ),
    ]


class MockGmailProvider(EmailProvider):
    provider_key = PROVIDER_GMAIL

    def build_authorize_url(self, *, state: str, redirect_uri: str) -> str:
        params = urlencode(
            {
                "client_id": "mock-gmail-client",
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "https://www.googleapis.com/auth/gmail.readonly",
                "state": state,
                "access_type": "offline",
                "prompt": "consent",
            }
        )
        return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"

    async def exchange_code(self, *, code: str, redirect_uri: str) -> dict:
        payload = _MOCK_CODES.get(code)
        if not payload:
            register_mock_gmail_auth_code(code)
            payload = _MOCK_CODES[code]
        if not _MOCK_MESSAGES:
            seed_mock_gmail()
        return dict(payload)

    async def refresh_access_token(self, *, refresh_token: str) -> dict:
        if not refresh_token.startswith("mock-gmail-refresh-"):
            raise ValueError("Invalid mock Gmail refresh token.")
        return {
            "access_token": f"mock-gmail-access-refreshed-{datetime.now(timezone.utc).timestamp()}",
            "expires_in": 3600,
            "token_type": "Bearer",
            "refresh_token": refresh_token,
        }

    async def revoke_token(self, *, token: str) -> None:
        return None

    async def get_mailbox_profile(self, *, access_token: str) -> GmailMailboxProfile:
        if not access_token.startswith("mock-gmail-access-"):
            raise ValueError("Invalid mock Gmail access token.")
        if not _MOCK_MESSAGES:
            seed_mock_gmail()
        return GmailMailboxProfile(
            emailAddress=_MOCK_ACCOUNT_EMAIL,
            historyId=str(_MOCK_HISTORY_ID),
            messagesTotal=len(_MOCK_MESSAGES),
        )

    async def list_history_message_ids(
        self,
        *,
        access_token: str,
        start_history_id: str,
        max_message_ids: int = 200,
    ) -> GmailHistoryResult:
        if not access_token.startswith("mock-gmail-access-"):
            raise ValueError("Invalid mock Gmail access token.")
        if _MOCK_FORCE_HISTORY_EXPIRED:
            raise GmailHistoryExpiredError("Gmail history cursor expired.")
        try:
            start = int(str(start_history_id))
        except (TypeError, ValueError) as exc:
            raise GmailHistoryExpiredError("Gmail history cursor expired.") from exc

        # Cursor from the future or far behind retained history → expired
        if _MOCK_HISTORY and start < (_MOCK_HISTORY[0][0] - 1):
            raise GmailHistoryExpiredError("Gmail history cursor expired.")
        if start > _MOCK_HISTORY_ID:
            raise GmailHistoryExpiredError("Gmail history cursor expired.")

        ids: List[str] = []
        for hid, msg in _MOCK_HISTORY:
            if hid > start and msg.sourceId not in ids:
                ids.append(msg.sourceId)
            if len(ids) >= max_message_ids:
                break
        return GmailHistoryResult(
            messageIds=ids,
            historyId=str(_MOCK_HISTORY_ID),
            pages=1,
        )

    async def fetch_messages_by_ids(
        self,
        *,
        access_token: str,
        message_ids: List[str],
        account_email: Optional[str] = None,
    ) -> List[RemoteEmailMessage]:
        if not access_token.startswith("mock-gmail-access-"):
            raise ValueError("Invalid mock Gmail access token.")
        by_id = {m.sourceId: m for m in _MOCK_MESSAGES}
        return [by_id[mid] for mid in message_ids if mid in by_id]

    async def list_messages(self, *, access_token: str, max_results: int = 100) -> List[RemoteEmailMessage]:
        if not access_token.startswith("mock-gmail-access-"):
            raise ValueError("Invalid mock Gmail access token.")
        if not _MOCK_MESSAGES:
            seed_mock_gmail()
        return list(_MOCK_MESSAGES)[:max_results]

    async def count_messages(self, *, access_token: str) -> int:
        messages = await self.list_messages(access_token=access_token)
        return len(messages)
