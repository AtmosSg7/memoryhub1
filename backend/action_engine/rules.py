"""Declarative, channel-agnostic action rules.

Each rule receives a fact dict and returns zero or more proposed actions
(dicts ready for persistence). Rules must not import Gmail providers.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional

from action_engine.config import rule_enabled
from action_engine.constants import (
    ACTION_PRIORITY_HIGH,
    ACTION_PRIORITY_NORMAL,
    ACTION_PRIORITY_URGENT,
    ACTION_SOURCE_COMMUNICATION,
    ACTION_SOURCE_INVOICE,
    ACTION_SOURCE_QUOTE,
    ACTION_TYPE_CALL_BACK,
    ACTION_TYPE_CREATE_INVOICE_FROM_QUOTE,
    ACTION_TYPE_FOLLOW_UP_OVERDUE_INVOICE,
    ACTION_TYPE_READ_CLIENT_REPLY,
    ACTION_TYPE_REPLY_TO_PROSPECT,
    MESSAGING_COMMUNICATION_TYPES,
)

RuleFn = Callable[[Dict[str, Any]], List[Dict[str, Any]]]


def _proposal(
    *,
    action_type: str,
    idempotency_key: str,
    title: str,
    description: str,
    priority: str,
    source: str,
    user_id: str,
    client_id: Optional[str] = None,
    communication_id: Optional[str] = None,
    event_id: Optional[str] = None,
    due_at: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> Dict[str, Any]:
    return {
        "type": action_type,
        "idempotencyKey": idempotency_key,
        "title": title,
        "description": description,
        "priority": priority,
        "source": source,
        "userId": user_id,
        "clientId": client_id,
        "communicationId": communication_id,
        "eventId": event_id,
        "dueAt": due_at,
        "metadata": metadata or {},
    }


def _is_noise_communication(comm: dict) -> bool:
    """Email-oriented noise filter. Non-email channels are never classified as noise here."""
    if (comm.get("type") or "") != "email":
        return False
    try:
        from prospects.identity import classify_email_noise

        meta = comm.get("metadata") or {}
        return (
            classify_email_noise(
                email=meta.get("fromEmail"),
                from_name=meta.get("fromName"),
                subject=comm.get("subject"),
            )
            is not None
        )
    except Exception:
        return False


def rule_reply_to_prospect(fact: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Unknown counterparty inbound message → reply to prospect."""
    if not rule_enabled(ACTION_TYPE_REPLY_TO_PROSPECT):
        return []
    if fact.get("prospectIgnored"):
        return []
    comm = fact.get("communication") or {}
    if not comm:
        return []
    if comm.get("type") not in MESSAGING_COMMUNICATION_TYPES:
        return []
    if (comm.get("direction") or "") != "inbound":
        return []
    if comm.get("clientId"):
        return []
    if comm.get("ignoredAt"):
        return []
    if (comm.get("status") or "") == "ignored":
        return []
    if _is_noise_communication(comm):
        return []

    subject = (comm.get("subject") or "").strip()
    title = "Répondre au prospect"
    if subject:
        title = f"Répondre au prospect — {subject[:80]}"
    conv_id = (comm.get("conversationId") or "").strip()
    key_suffix = f"conv:{conv_id}" if conv_id else comm["id"]
    return [
        _proposal(
            action_type=ACTION_TYPE_REPLY_TO_PROSPECT,
            idempotency_key=f"{ACTION_TYPE_REPLY_TO_PROSPECT}:{key_suffix}",
            title=title,
            description="Nouveau message d'un contact inconnu à traiter.",
            priority=ACTION_PRIORITY_HIGH,
            source=ACTION_SOURCE_COMMUNICATION,
            user_id=comm["userId"],
            communication_id=comm["id"],
            metadata={
                "channel": comm.get("type"),
                "provider": comm.get("provider"),
                "fromEmail": (comm.get("metadata") or {}).get("fromEmail"),
                "conversationId": conv_id or None,
            },
        )
    ]


def rule_read_client_reply(fact: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Inbound message from a known client → read the reply."""
    if not rule_enabled(ACTION_TYPE_READ_CLIENT_REPLY):
        return []
    comm = fact.get("communication") or {}
    if not comm:
        return []
    if comm.get("type") not in MESSAGING_COMMUNICATION_TYPES:
        return []
    if (comm.get("direction") or "") != "inbound":
        return []
    client_id = comm.get("clientId")
    if not client_id:
        return []
    if comm.get("ignoredAt"):
        return []

    subject = (comm.get("subject") or "").strip()
    client_name = (comm.get("metadata") or {}).get("clientName") or "client"
    title = f"Lire la réponse de {client_name}"
    if subject:
        title = f"Lire la réponse — {subject[:80]}"
    conv_id = (comm.get("conversationId") or "").strip()
    key_suffix = f"conv:{conv_id}" if conv_id else comm["id"]
    return [
        _proposal(
            action_type=ACTION_TYPE_READ_CLIENT_REPLY,
            idempotency_key=f"{ACTION_TYPE_READ_CLIENT_REPLY}:{key_suffix}",
            title=title,
            description="Nouveau message d'un client existant.",
            priority=ACTION_PRIORITY_NORMAL,
            source=ACTION_SOURCE_COMMUNICATION,
            user_id=comm["userId"],
            client_id=client_id,
            communication_id=comm["id"],
            metadata={
                "channel": comm.get("type"),
                "provider": comm.get("provider"),
                "clientName": client_name,
                "conversationId": conv_id or None,
            },
        )
    ]


def rule_call_back(fact: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Missed / voicemail → call_back. Spam/blocked → never. Idempotent per conversation."""
    if not rule_enabled(ACTION_TYPE_CALL_BACK):
        return []
    comm = fact.get("communication") or {}
    if not comm:
        return []
    if (comm.get("type") or "") != "phone":
        return []
    meta = comm.get("metadata") or {}
    status = (meta.get("status") or "").lower()
    if status in {"spam", "blocked"}:
        return []
    if (comm.get("status") or "") == "ignored" or comm.get("ignoredAt"):
        return []

    missed = bool(meta.get("missed") or meta.get("missedCall") or fact.get("missedCall"))
    voicemail = bool(meta.get("voicemail") or status == "voicemail")
    if not missed and not voicemail:
        return []

    client_id = comm.get("clientId")
    client_name = (
        meta.get("clientName")
        or meta.get("counterpartyName")
        or meta.get("fromName")
        or meta.get("phoneNumber")
        or "contact"
    )
    conv_id = (comm.get("conversationId") or "").strip()
    phone_key = (meta.get("normalizedPhone") or "").strip()
    if conv_id:
        key_suffix = f"conv:{conv_id}"
    elif phone_key:
        key_suffix = f"phone:{phone_key}"
    else:
        key_suffix = comm["id"]
    description = (
        "Messagerie vocale à rappeler." if voicemail and not missed else "Appel manqué à rappeler."
    )
    return [
        _proposal(
            action_type=ACTION_TYPE_CALL_BACK,
            idempotency_key=f"{ACTION_TYPE_CALL_BACK}:{key_suffix}",
            title=f"Rappeler {client_name}",
            description=description,
            priority=ACTION_PRIORITY_HIGH,
            source=ACTION_SOURCE_COMMUNICATION,
            user_id=comm["userId"],
            client_id=client_id,
            communication_id=comm["id"],
            metadata={
                "channel": "phone",
                "missed": missed,
                "voicemail": voicemail,
                "normalizedPhone": phone_key or None,
                "conversationId": conv_id or None,
            },
        )
    ]


def rule_follow_up_overdue_invoice(fact: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Overdue invoice → follow up."""
    if not rule_enabled(ACTION_TYPE_FOLLOW_UP_OVERDUE_INVOICE):
        return []
    invoice = fact.get("invoice") or {}
    if not invoice:
        return []
    if (invoice.get("status") or "") != "overdue":
        return []
    if invoice.get("isArchived"):
        return []

    number = invoice.get("number") or ""
    client_name = invoice.get("clientName") or "client"
    title = f"Relancer la facture {number}".strip() if number else "Relancer la facture en retard"
    return [
        _proposal(
            action_type=ACTION_TYPE_FOLLOW_UP_OVERDUE_INVOICE,
            idempotency_key=f"{ACTION_TYPE_FOLLOW_UP_OVERDUE_INVOICE}:{invoice['id']}",
            title=title,
            description=f"Facture en retard — {client_name}.",
            priority=ACTION_PRIORITY_URGENT,
            source=ACTION_SOURCE_INVOICE,
            user_id=invoice["userId"],
            client_id=invoice.get("clientId"),
            event_id=fact.get("eventId"),
            metadata={
                "invoiceId": invoice["id"],
                "invoiceNumber": number,
                "clientName": client_name,
                "amountTTC": invoice.get("amountTTC"),
            },
        )
    ]


def rule_create_invoice_from_quote(fact: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Accepted quote without invoice → create invoice."""
    if not rule_enabled(ACTION_TYPE_CREATE_INVOICE_FROM_QUOTE):
        return []
    quote = fact.get("quote") or {}
    if not quote:
        return []
    if (quote.get("status") or "") != "accepted":
        return []
    if quote.get("invoiceId"):
        return []
    if quote.get("isArchived"):
        return []

    number = quote.get("number") or ""
    client_name = quote.get("clientName") or "client"
    title = f"Créer la facture — devis {number}".strip() if number else "Créer la facture"
    return [
        _proposal(
            action_type=ACTION_TYPE_CREATE_INVOICE_FROM_QUOTE,
            idempotency_key=f"{ACTION_TYPE_CREATE_INVOICE_FROM_QUOTE}:{quote['id']}",
            title=title,
            description=f"Devis accepté par {client_name} — facturer.",
            priority=ACTION_PRIORITY_HIGH,
            source=ACTION_SOURCE_QUOTE,
            user_id=quote["userId"],
            client_id=quote.get("clientId"),
            event_id=fact.get("eventId"),
            metadata={
                "quoteId": quote["id"],
                "quoteNumber": number,
                "clientName": client_name,
                "amountTTC": quote.get("amountTTC"),
            },
        )
    ]


# Ordered rule registry — order only affects evaluation sequence, not uniqueness.
RULES: List[RuleFn] = [
    rule_reply_to_prospect,
    rule_read_client_reply,
    rule_call_back,
    rule_follow_up_overdue_invoice,
    rule_create_invoice_from_quote,
]


def propose_actions(fact: Dict[str, Any]) -> List[Dict[str, Any]]:
    proposals: List[Dict[str, Any]] = []
    for rule in RULES:
        try:
            proposals.extend(rule(fact) or [])
        except Exception:
            # A single broken rule must never block others.
            continue
    return proposals
