"""Deterministic intent → suggestion mapping (no LLM).

Suggestions are NOT Action Engine actions until the user accepts.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from action_engine.constants import (
    ACTION_PRIORITY_HIGH,
    ACTION_PRIORITY_NORMAL,
    ACTION_PRIORITY_URGENT,
    ACTION_TYPE_ANSWER_QUESTION,
    ACTION_TYPE_CALL_BACK,
    ACTION_TYPE_CREATE_INVOICE_FROM_QUOTE,
    ACTION_TYPE_FOLLOW_UP_COMMUNICATION,
    ACTION_TYPE_HANDLE_COMPLAINT,
    ACTION_TYPE_PREPARE_QUOTE,
    ACTION_TYPE_REPLY_TO_PROSPECT,
    ACTION_TYPE_REVIEW_DOCUMENT,
    ACTION_TYPE_REVIEW_PAYMENT,
    ACTION_TYPE_SCHEDULE_APPOINTMENT,
)
from communication_intelligence.constants import URGENCIES

_INTENT_MAP: Dict[str, Dict[str, str]] = {
    "request_quote": {
        "type": ACTION_TYPE_PREPARE_QUOTE,
        "title": "Préparer un devis",
        "description": "Le contact semble demander un devis. Préparez une proposition.",
    },
    "request_callback": {
        "type": ACTION_TYPE_CALL_BACK,
        "title": "Rappeler le contact",
        "description": "Une demande de rappel a été détectée.",
    },
    "appointment_request": {
        "type": ACTION_TYPE_SCHEDULE_APPOINTMENT,
        "title": "Planifier un rendez-vous",
        "description": "Le contact souhaite un rendez-vous.",
    },
    "question": {
        "type": ACTION_TYPE_ANSWER_QUESTION,
        "title": "Répondre à la question",
        "description": "Une question nécessite une réponse.",
    },
    "complaint": {
        "type": ACTION_TYPE_HANDLE_COMPLAINT,
        "title": "Traiter la réclamation",
        "description": "Une réclamation ou un mécontentement a été détecté.",
    },
    "payment_question": {
        "type": ACTION_TYPE_REVIEW_PAYMENT,
        "title": "Traiter la question de paiement",
        "description": "Le message concerne un paiement ou une facture.",
    },
    "document_sent": {
        "type": ACTION_TYPE_REVIEW_DOCUMENT,
        "title": "Consulter le document reçu",
        "description": "Un document semble avoir été envoyé.",
    },
    "quote_accepted": {
        "type": ACTION_TYPE_CREATE_INVOICE_FROM_QUOTE,
        "title": "Créer la facture",
        "description": "Le devis semble accepté — créez la facture correspondante.",
    },
    "quote_rejected": {
        "type": ACTION_TYPE_FOLLOW_UP_COMMUNICATION,
        "title": "Relancer après refus de devis",
        "description": "Le devis semble refusé — décidez d’une relance adaptée.",
    },
    "invoice_paid_claim": {
        "type": ACTION_TYPE_REVIEW_PAYMENT,
        "title": "Vérifier le paiement annoncé",
        "description": "Le contact indique avoir payé — vérifiez et mettez à jour.",
    },
    "follow_up": {
        "type": ACTION_TYPE_FOLLOW_UP_COMMUNICATION,
        "title": "Assurer le suivi",
        "description": "Un suivi est attendu sur cet échange.",
    },
    "other": {
        "type": ACTION_TYPE_REPLY_TO_PROSPECT,
        "title": "Lire et répondre",
        "description": "Relisez le message et décidez de la suite.",
    },
}


def normalize_intent(value: Optional[str]) -> str:
    intent = (value or "other").strip().lower()
    return intent if intent in _INTENT_MAP else "other"


def normalize_urgency(value: Optional[str]) -> str:
    urgency = (value or "normal").strip().lower()
    return urgency if urgency in URGENCIES else "normal"


def urgency_to_priority(urgency: str) -> str:
    u = normalize_urgency(urgency)
    if u == "urgent":
        return ACTION_PRIORITY_URGENT
    if u == "high":
        return ACTION_PRIORITY_HIGH
    return ACTION_PRIORITY_NORMAL


def map_intent_to_suggestion(
    intent: Optional[str],
    *,
    summary: Optional[str] = None,
    entities: Optional[dict] = None,
) -> Dict[str, Any]:
    """Pure mapping: intent (+ light context) → suggestion fields."""
    key = normalize_intent(intent)
    base = dict(_INTENT_MAP[key])
    bits = []
    if summary:
        bits.append(str(summary).strip())
    ent = entities or {}
    for label, field in (
        ("Contact", "name"),
        ("Entreprise", "company"),
        ("Tél", "phone"),
        ("Devis", "quoteNumber"),
        ("Facture", "invoiceNumber"),
    ):
        if ent.get(field):
            bits.append(f"{label}: {ent[field]}")
    if bits:
        base["description"] = " — ".join(bits)[:500]
    base["intent"] = key
    return base
