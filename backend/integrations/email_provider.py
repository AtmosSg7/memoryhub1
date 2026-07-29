"""Email inbox provider interface — Gmail / Outlook / mock share this contract."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List

from integrations.models import RemoteEmailMessage


class EmailProvider(ABC):
    provider_key: str

    @abstractmethod
    def build_authorize_url(self, *, state: str, redirect_uri: str) -> str:
        """Return the provider OAuth consent URL."""

    @abstractmethod
    async def exchange_code(self, *, code: str, redirect_uri: str) -> dict:
        """Exchange authorization code for tokens + account profile.

        Expected keys: access_token, refresh_token, expires_in, token_type,
        scope, account_email, account_name, account_id.
        """

    @abstractmethod
    async def refresh_access_token(self, *, refresh_token: str) -> dict:
        """Refresh access token."""

    @abstractmethod
    async def revoke_token(self, *, token: str) -> None:
        """Best-effort revoke of access or refresh token."""

    @abstractmethod
    async def list_messages(
        self,
        *,
        access_token: str,
        max_results: int = 100,
    ) -> List[RemoteEmailMessage]:
        """Fetch recent messages (metadata only, read-only)."""

    @abstractmethod
    async def count_messages(self, *, access_token: str) -> int:
        """Lightweight count for confirmation UI."""
