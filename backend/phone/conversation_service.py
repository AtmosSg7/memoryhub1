"""PhoneConversationService — ingest calls into communications → Hub conversations."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from phone.constants import (
    CALL_RESULT_LINKED,
    CALL_RESULT_SKIPPED,
    CALL_RESULT_UNMATCHED,
)
from phone.matcher import PhoneMatcher
from phone.models import PhoneCall, PhoneSyncSummary, RemoteCall
from phone.normalizer import PhoneNormalizer


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class PhoneConversationService:
    """Bridge telephony → Communication Center → Hub (same path as Gmail)."""

    def __init__(
        self,
        db,
        *,
        matcher: Optional[PhoneMatcher] = None,
        normalizer: Optional[PhoneNormalizer] = None,
    ):
        self.db = db
        self.matcher = matcher or PhoneMatcher()
        self.normalizer = normalizer or PhoneNormalizer()

    async def ingest_remote_calls(
        self,
        user_id: str,
        remotes: List[RemoteCall],
        *,
        connected_account_id: Optional[str] = None,
        vendor: str = "mock",
    ) -> PhoneSyncSummary:
        linked = unmatched = skipped = 0
        for remote in remotes or []:
            if not remote.providerCallId:
                skipped += 1
                continue
            outcome = await self.ingest_remote_call(
                user_id,
                remote,
                connected_account_id=connected_account_id,
                vendor=vendor,
            )
            if outcome == CALL_RESULT_LINKED:
                linked += 1
            elif outcome == CALL_RESULT_UNMATCHED:
                unmatched += 1
            else:
                skipped += 1
        return PhoneSyncSummary(
            linked=linked,
            unmatched=unmatched,
            skipped=skipped,
            total=linked + unmatched + skipped,
            finishedAt=_utc_now_iso(),
        )

    async def ingest_remote_call(
        self,
        user_id: str,
        remote: RemoteCall,
        *,
        connected_account_id: Optional[str] = None,
        vendor: str = "mock",
    ) -> str:
        phone = remote.counterpartyPhone or remote.phoneNumber
        client, matched_by = await self.matcher.find_client_for_user(self.db, user_id, phone)
        call = self.normalizer.remote_to_phone_call(
            remote,
            client_id=(client or {}).get("id"),
            matched_by=matched_by or None,
            connected_account_id=connected_account_id,
        )
        if vendor:
            call.vendor = vendor
        await self.persist_call(user_id, call, client_name=(client or {}).get("name"))
        if call.clientId:
            return CALL_RESULT_LINKED
        return CALL_RESULT_UNMATCHED

    async def persist_call(
        self,
        user_id: str,
        call: PhoneCall,
        *,
        client_name: Optional[str] = None,
    ) -> dict:
        from communication_center import upsert_from_phone_call

        return await upsert_from_phone_call(
            self.db,
            user_id=user_id,
            call=call,
            client_name=client_name,
        )
