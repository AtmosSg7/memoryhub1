"""Mock telephony provider — architecture validation without a carrier."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from phone.constants import PROVIDER_PHONE, VENDOR_MOCK
from phone.models import RemoteCall
from phone.provider import PhoneProvider


class MockPhoneProvider(PhoneProvider):
    vendor_id = VENDOR_MOCK
    display_name = "Mock Phone"

    def is_configured(self) -> bool:
        return True

    def is_ready(self) -> bool:
        return True

    async def connect(self, *, user_id: str, credentials: Optional[dict] = None) -> dict:
        return {
            "access_token": f"mock-phone-token-{user_id}",
            "refresh_token": None,
            "expires_in": 86400 * 365,
            "token_type": "Bearer",
            "account_email": None,
            "account_name": "Ligne Basera (mock)",
            "account_id": f"mock-phone-{user_id}",
            "vendor": VENDOR_MOCK,
        }

    async def list_calls(
        self,
        *,
        access_token: Optional[str] = None,
        max_results: int = 100,
    ) -> List[RemoteCall]:
        now = datetime.now(timezone.utc)
        samples = [
            RemoteCall(
                providerCallId="mock-call-missed-1",
                provider=PROVIDER_PHONE,
                vendor=VENDOR_MOCK,
                phoneNumber="+33612345678",
                counterpartyPhone="+33612345678",
                direction="incoming",
                status="missed",
                startedAt=(now - timedelta(hours=2)).isoformat(),
                endedAt=(now - timedelta(hours=2)).isoformat(),
                duration=0,
                voicemail=False,
            ),
            RemoteCall(
                providerCallId="mock-call-out-1",
                provider=PROVIDER_PHONE,
                vendor=VENDOR_MOCK,
                phoneNumber="0612345678",
                counterpartyPhone="0612345678",
                direction="outgoing",
                status="answered",
                startedAt=(now - timedelta(days=1)).isoformat(),
                endedAt=(now - timedelta(days=1) + timedelta(minutes=4)).isoformat(),
                duration=240,
            ),
            RemoteCall(
                providerCallId="mock-call-vm-1",
                provider=PROVIDER_PHONE,
                vendor=VENDOR_MOCK,
                phoneNumber="07 88 99 00 11",
                counterpartyPhone="0788990011",
                direction="incoming",
                status="voicemail",
                startedAt=(now - timedelta(days=2)).isoformat(),
                endedAt=(now - timedelta(days=2) + timedelta(seconds=45)).isoformat(),
                duration=45,
                voicemail=True,
                recordingUrl="https://example.invalid/voicemail/mock-call-vm-1.mp3",
            ),
        ]
        return samples[: max(0, max_results)]

    async def count_calls(self, *, access_token: Optional[str] = None) -> int:
        return len(await self.list_calls(access_token=access_token, max_results=100))
