"""PhoneMatcher — attach calls to clients via normalized phone numbers."""

from __future__ import annotations

from typing import List, Optional, Tuple

from phone.normalizer import PhoneNormalizer


class PhoneMatcher:
    """Match a normalized phone against client phone fields."""

    def __init__(self, normalizer: Optional[PhoneNormalizer] = None):
        self.normalizer = normalizer or PhoneNormalizer()

    def client_phones(self, client: dict) -> List[str]:
        values: List[str] = []
        if client.get("phone"):
            values.append(self.normalizer.normalize_phone(client.get("phone")))
        for item in client.get("phones") or []:
            if isinstance(item, dict) and item.get("value"):
                values.append(self.normalizer.normalize_phone(item.get("value")))
            elif isinstance(item, str):
                values.append(self.normalizer.normalize_phone(item))
        return [v for v in values if v]

    @staticmethod
    def phones_match(a: str, b: str) -> bool:
        """Strong match only: exact normalized digits (no name, no fuzzy suffix)."""
        if not a or not b:
            return False
        return a == b

    def find_client(
        self,
        clients: List[dict],
        phone: Optional[str],
    ) -> Tuple[Optional[dict], str]:
        target = self.normalizer.normalize_phone(phone)
        if not target:
            return None, ""
        for client in clients:
            for cp in self.client_phones(client):
                if self.phones_match(target, cp):
                    return client, "phone"
        return None, ""

    async def find_client_for_user(
        self,
        db,
        user_id: str,
        phone: Optional[str],
    ) -> Tuple[Optional[dict], str]:
        cursor = db.clients.find({"userId": user_id}, {"_id": 0})
        clients = await cursor.to_list(length=5000)
        return self.find_client(clients, phone)
