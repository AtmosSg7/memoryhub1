"""Match remote contacts to existing MemoryHub clients."""

from __future__ import annotations

import re
import unicodedata
from typing import List, Optional, Tuple

from integrations.models import RemoteContact


def normalize_email_loose(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def normalize_phone_fr(value: Optional[str]) -> str:
    """Normalize FR-style phones to digit form starting with 0 when possible."""
    if not value:
        return ""
    raw = re.sub(r"[^\d+]", "", str(value).strip())
    if raw.startswith("+33"):
        raw = "0" + raw[3:]
    elif raw.startswith("0033"):
        raw = "0" + raw[4:]
    elif raw.startswith("33") and len(re.sub(r"\D", "", raw)) >= 11:
        raw = "0" + raw[2:]
    return re.sub(r"\D", "", raw)


def normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text.strip().lower())


def _client_emails(client: dict) -> List[str]:
    values = []
    if client.get("email"):
        values.append(normalize_email_loose(client.get("email")))
    for item in client.get("emails") or []:
        if isinstance(item, dict) and item.get("value"):
            values.append(normalize_email_loose(item.get("value")))
    return [v for v in values if v]


def _client_phones(client: dict) -> List[str]:
    values = []
    if client.get("phone"):
        values.append(normalize_phone_fr(client.get("phone")))
    for item in client.get("phones") or []:
        if isinstance(item, dict) and item.get("value"):
            values.append(normalize_phone_fr(item.get("value")))
    return [v for v in values if v]


def _remote_emails(contact: RemoteContact) -> List[str]:
    return [normalize_email_loose(e.value) for e in contact.emails if e.value]


def _remote_phones(contact: RemoteContact) -> List[str]:
    return [normalize_phone_fr(p.value) for p in contact.phones if p.value]


def find_matching_client(
    clients: List[dict],
    contact: RemoteContact,
) -> Tuple[Optional[dict], str]:
    """Return (client, reason) or (None, '').

    Priority: email exact → phone exact → name+company fallback.
    """
    remote_emails = set(_remote_emails(contact))
    remote_phones = set(_remote_phones(contact))
    remote_name = normalize_text(contact.displayName)
    remote_company = normalize_text(contact.company)

    # 1) Email
    for client in clients:
        client_emails = set(_client_emails(client))
        if remote_emails and client_emails and remote_emails.intersection(client_emails):
            return client, "email"

    # 2) Phone
    for client in clients:
        client_phones = set(_client_phones(client))
        if not remote_phones or not client_phones:
            continue
        for rp in remote_phones:
            for cp in client_phones:
                if rp == cp or (len(rp) >= 9 and len(cp) >= 9 and (rp.endswith(cp[-9:]) or cp.endswith(rp[-9:]))):
                    return client, "phone"

    # 3) Name + company
    if remote_name and remote_company:
        for client in clients:
            client_name = normalize_text(client.get("contactName") or client.get("name"))
            client_company = normalize_text(client.get("company"))
            if (
                client_name
                and client_company
                and client_name == remote_name
                and client_company == remote_company
            ):
                return client, "name_company"

    return None, ""
