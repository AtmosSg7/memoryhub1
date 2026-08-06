"""PhoneSync — sync abstraction over PhoneProvider → import pipeline."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Optional

from phone.models import PhoneSyncSummary, RemoteCall
from phone.provider import PhoneProvider


class PhoneSync(ABC):
    """Orchestrates a provider pull into Communication Center."""

    @abstractmethod
    async def pull_calls(
        self,
        provider: PhoneProvider,
        *,
        access_token: Optional[str] = None,
        max_results: int = 100,
    ) -> List[RemoteCall]:
        ...

    @abstractmethod
    async def sync_user(
        self,
        db,
        user_id: str,
        *,
        provider: PhoneProvider,
        connected_account_id: Optional[str] = None,
        access_token: Optional[str] = None,
        max_results: int = 100,
    ) -> PhoneSyncSummary:
        ...


class DefaultPhoneSync(PhoneSync):
    """Default sync: list remote calls then import via PhoneConversationService."""

    async def pull_calls(
        self,
        provider: PhoneProvider,
        *,
        access_token: Optional[str] = None,
        max_results: int = 100,
    ) -> List[RemoteCall]:
        return await provider.list_calls(access_token=access_token, max_results=max_results)

    async def sync_user(
        self,
        db,
        user_id: str,
        *,
        provider: PhoneProvider,
        connected_account_id: Optional[str] = None,
        access_token: Optional[str] = None,
        max_results: int = 100,
    ) -> PhoneSyncSummary:
        from phone.conversation_service import PhoneConversationService

        remotes = await self.pull_calls(
            provider, access_token=access_token, max_results=max_results
        )
        service = PhoneConversationService(db)
        return await service.ingest_remote_calls(
            user_id,
            remotes,
            connected_account_id=connected_account_id,
            vendor=provider.vendor_id,
        )
