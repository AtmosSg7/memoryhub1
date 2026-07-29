"""Match remote emails to existing MemoryHub clients."""

from __future__ import annotations

from typing import List, Optional, Set, Tuple

from integrations.matching import normalize_email_loose, normalize_phone_fr, normalize_text
from integrations.models import RemoteEmailMessage

# Confidence levels for suggestions (never auto-link below high without user action).
CONFIDENCE_HIGH = "high"  # exact email or phone
CONFIDENCE_MEDIUM = "medium"  # unique name / company match
CONFIDENCE_LOW = "low"  # domain / weak — never shown as suggestion


def _client_emails(client: dict) -> Set[str]:
    values: Set[str] = set()
    if client.get("email"):
        values.add(normalize_email_loose(client.get("email")))
    for item in client.get("emails") or []:
        if isinstance(item, dict) and item.get("value"):
            values.add(normalize_email_loose(item.get("value")))
    return {v for v in values if v}


def _client_phones(client: dict) -> Set[str]:
    values: Set[str] = set()
    if client.get("phone"):
        values.add(normalize_phone_fr(client.get("phone")))
    for item in client.get("phones") or []:
        if isinstance(item, dict) and item.get("value"):
            values.add(normalize_phone_fr(item.get("value")))
    return {v for v in values if v}


def counterparty_emails(
    message: RemoteEmailMessage,
    *,
    account_email: Optional[str] = None,
) -> Set[str]:
    """Addresses that likely belong to the client (not the artisan mailbox)."""
    account = normalize_email_loose(account_email)
    values: Set[str] = set()
    if message.direction == "outbound":
        for addr in message.toEmails or []:
            values.add(normalize_email_loose(addr))
        for addr in message.ccEmails or []:
            values.add(normalize_email_loose(addr))
    else:
        if message.fromEmail:
            values.add(normalize_email_loose(message.fromEmail))
    if account:
        values.discard(account)
    return {v for v in values if v}


def email_domain(value: Optional[str]) -> str:
    email = normalize_email_loose(value)
    if "@" not in email:
        return ""
    return email.split("@", 1)[1]


def find_client_for_email(
    clients: List[dict],
    message: RemoteEmailMessage,
    *,
    account_email: Optional[str] = None,
) -> Tuple[Optional[dict], str]:
    """Return (client, reason). Priority: email → name+company fallback."""
    counterparts = counterparty_emails(message, account_email=account_email)

    # 1) Email match
    for client in clients:
        client_emails = _client_emails(client)
        if counterparts and client_emails and counterparts.intersection(client_emails):
            return client, "email"

    # 2) Name + company fallback (inbound From display name vs client)
    remote_name = normalize_text(message.fromName)
    if remote_name and message.direction == "inbound":
        for client in clients:
            client_name = normalize_text(client.get("contactName") or client.get("name"))
            client_company = normalize_text(client.get("company"))
            if client_name and client_name == remote_name:
                return client, "name"
            if client_company and client_company == remote_name:
                return client, "name_company"

    return None, ""


def communication_to_remote_message(doc: dict) -> RemoteEmailMessage:
    """Map a Communication Center email row to RemoteEmailMessage for matching."""
    meta = doc.get("metadata") or {}
    to_emails = list(meta.get("toEmails") or [])
    if meta.get("toEmail") and meta["toEmail"] not in to_emails:
        to_emails.insert(0, meta["toEmail"])
    direction = doc.get("direction") if doc.get("direction") in ("inbound", "outbound") else "inbound"
    return RemoteEmailMessage(
        sourceId=str(doc.get("providerId") or doc.get("id") or "unknown"),
        threadId=meta.get("threadId"),
        subject=doc.get("subject"),
        snippet=doc.get("preview"),
        fromEmail=meta.get("fromEmail"),
        fromName=meta.get("fromName"),
        toEmails=to_emails,
        ccEmails=list(meta.get("ccEmails") or []),
        direction=direction,
        sentAt=doc.get("createdAt"),
        webLink=doc.get("externalUrl"),
    )


def suggest_client_for_email(
    clients: List[dict],
    message: RemoteEmailMessage,
    *,
    account_email: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> Tuple[Optional[dict], str, str]:
    """Suggest a client with confidence. Only high/medium are UI-safe.

    Priority: exact email → phone in metadata → unique name → domain (low, not shown).
    Never auto-associate on medium/low — caller must require user confirmation.
    """
    meta = metadata or {}
    counterparts = counterparty_emails(message, account_email=account_email)

    # 1) Exact email
    email_hits: List[dict] = []
    for client in clients:
        client_emails = _client_emails(client)
        if counterparts and client_emails and counterparts.intersection(client_emails):
            email_hits.append(client)
    if len(email_hits) == 1:
        return email_hits[0], "email", CONFIDENCE_HIGH
    if len(email_hits) > 1:
        return None, "email_ambiguous", CONFIDENCE_LOW

    # 2) Phone in metadata (if present)
    phone_raw = meta.get("phone") or meta.get("fromPhone") or meta.get("detectedPhone")
    phone = normalize_phone_fr(phone_raw)
    if phone:
        phone_hits = [c for c in clients if phone in _client_phones(c)]
        if len(phone_hits) == 1:
            return phone_hits[0], "phone", CONFIDENCE_HIGH
        if len(phone_hits) > 1:
            return None, "phone_ambiguous", CONFIDENCE_LOW

    # 3) Unique name / company (inbound display name)
    remote_name = normalize_text(message.fromName)
    if remote_name and message.direction == "inbound":
        name_hits: List[Tuple[dict, str]] = []
        for client in clients:
            client_name = normalize_text(client.get("contactName") or client.get("name"))
            client_company = normalize_text(client.get("company"))
            if client_name and client_name == remote_name:
                name_hits.append((client, "name"))
            elif client_company and client_company == remote_name:
                name_hits.append((client, "name_company"))
        if len(name_hits) == 1:
            return name_hits[0][0], name_hits[0][1], CONFIDENCE_MEDIUM

    # 4) Domain last resort — low confidence, never auto / never show as primary suggestion
    domains = {email_domain(addr) for addr in counterparts}
    domains.discard("")
    free = {
        "gmail.com",
        "googlemail.com",
        "yahoo.fr",
        "yahoo.com",
        "hotmail.com",
        "outlook.com",
        "orange.fr",
        "free.fr",
        "laposte.net",
        "icloud.com",
    }
    company_domains = {d for d in domains if d not in free}
    if len(company_domains) == 1:
        domain = next(iter(company_domains))
        domain_hits: List[dict] = []
        for client in clients:
            for addr in _client_emails(client):
                if email_domain(addr) == domain:
                    domain_hits.append(client)
                    break
            company = normalize_text(client.get("company") or "")
            root = domain.split(".")[0]
            if company and root and root in company and client not in domain_hits:
                domain_hits.append(client)
        if len(domain_hits) == 1:
            return domain_hits[0], "domain", CONFIDENCE_LOW

    return None, "", CONFIDENCE_LOW


def is_suggestion_displayable(confidence: str) -> bool:
    """Only high/medium suggestions are shown in the UI."""
    return confidence in (CONFIDENCE_HIGH, CONFIDENCE_MEDIUM)
