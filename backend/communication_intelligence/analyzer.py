"""LLM / mock analyzers — structured output only, no side effects."""

from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any, Dict, Optional, Tuple

from communication_intelligence.constants import (
    INTENTS,
    URGENCIES,
    ci_max_chars,
    ci_model,
    ci_provider,
    ci_timeout_seconds,
)
from communication_intelligence.hashing import truncate_text
from communication_intelligence.mapping import normalize_intent, normalize_urgency

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Tu es un assistant d'analyse d'e-mails pour artisans français (Basera). "
    "Tu analyses un message entrant et proposes une intention et une urgence. "
    "Tu ne crées jamais de client, devis, facture ni e-mail. "
    "Tu réponds UNIQUEMENT avec un objet JSON valide, sans markdown."
)


def _user_prompt(payload: dict) -> str:
    return f"""Analyse ce message entrant et retourne un JSON avec exactement cette forme :
{{
  "summary": "résumé court en français (1-2 phrases)",
  "intent": one of {list(INTENTS)},
  "urgency": one of {list(URGENCIES)},
  "confidence": 0.0-1.0,
  "entities": {{
    "name": null ou string,
    "company": null ou string,
    "phone": null ou string,
    "email": null ou string,
    "date": null ou string,
    "amount": null ou string,
    "address": null ou string,
    "workType": null ou string,
    "quoteNumber": null ou string,
    "invoiceNumber": null ou string
  }}
}}

Contexte (données minimales) :
{json.dumps(payload, ensure_ascii=False)}
"""


def build_analysis_payload(communication: dict) -> dict:
    meta = communication.get("metadata") or {}
    max_chars = ci_max_chars()
    subject = truncate_text(str(communication.get("subject") or ""), 300)
    preview = truncate_text(str(communication.get("preview") or ""), max_chars)
    return {
        "subject": subject,
        "preview": preview,
        "fromEmail": truncate_text(str(meta.get("fromEmail") or ""), 120),
        "fromName": truncate_text(str(meta.get("fromName") or ""), 120),
        "hasClient": bool(communication.get("clientId")),
        "clientName": truncate_text(str(meta.get("clientName") or ""), 120) or None,
        "attachmentsCount": int(communication.get("attachmentsCount") or 0),
    }


def _normalize_result(raw: dict, *, model: str) -> dict:
    entities_in = raw.get("entities") if isinstance(raw.get("entities"), dict) else {}
    entities = {
        "name": entities_in.get("name"),
        "company": entities_in.get("company"),
        "phone": entities_in.get("phone"),
        "email": entities_in.get("email"),
        "date": entities_in.get("date"),
        "amount": entities_in.get("amount"),
        "address": entities_in.get("address"),
        "workType": entities_in.get("workType"),
        "quoteNumber": entities_in.get("quoteNumber"),
        "invoiceNumber": entities_in.get("invoiceNumber"),
    }
    # Drop empty
    entities = {k: v for k, v in entities.items() if v}

    conf = raw.get("confidence")
    try:
        confidence = float(conf) if conf is not None else 0.5
    except (TypeError, ValueError):
        confidence = 0.5
    confidence = max(0.0, min(1.0, confidence))

    summary = truncate_text(str(raw.get("summary") or ""), 400)
    return {
        "summary": summary or "Message entrant à traiter.",
        "intent": normalize_intent(raw.get("intent")),
        "urgency": normalize_urgency(raw.get("urgency")),
        "confidence": confidence,
        "entities": entities,
        "model": model,
    }


def analyze_with_mock(communication: dict) -> Tuple[dict, Dict[str, Any]]:
    """Deterministic heuristic analyzer for tests / local (no network)."""
    payload = build_analysis_payload(communication)
    text = f"{payload.get('subject') or ''} {payload.get('preview') or ''}".lower()
    intent = "other"
    urgency = "normal"
    if re.search(r"\b(devis|quotation|quote|chiffrage)\b", text):
        intent = "request_quote"
        urgency = "high"
    elif re.search(r"\b(rappel|rappeler|callback|appeler)\b", text):
        intent = "request_callback"
        urgency = "high"
    elif re.search(r"\b(rdv|rendez[- ]?vous|visite)\b", text):
        intent = "appointment_request"
    elif re.search(r"\b(réclamation|reclamation|plainte|mécontent|mecontent)\b", text):
        intent = "complaint"
        urgency = "urgent"
    elif re.search(r"\b(payé|paiement|virement|facture)\b", text):
        intent = "payment_question"
    elif re.search(r"\b(accept[ée]|ok pour le devis|d'accord pour)\b", text):
        intent = "quote_accepted"
        urgency = "high"
    elif re.search(r"\b(refus|refusé|pas intéress)\b", text):
        intent = "quote_rejected"
    elif re.search(r"\?\s*$|\b(question|combien|comment)\b", text):
        intent = "question"

    summary = truncate_text(
        (payload.get("subject") or payload.get("preview") or "Message entrant")[:180],
        180,
    )
    entities = {}
    if payload.get("fromEmail"):
        entities["email"] = payload["fromEmail"]
    if payload.get("fromName"):
        entities["name"] = payload["fromName"]

    result = _normalize_result(
        {
            "summary": summary,
            "intent": intent,
            "urgency": urgency,
            "confidence": 0.55,
            "entities": entities,
        },
        model="mock",
    )
    usage = {
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "duration_ms": 0,
        "model": "mock",
    }
    return result, usage


async def analyze_with_openai(communication: dict) -> Tuple[dict, Dict[str, Any]]:
    from openai import AsyncOpenAI

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("missing_openai_key")

    model = ci_model()
    timeout = ci_timeout_seconds()
    payload = build_analysis_payload(communication)
    client = AsyncOpenAI(api_key=api_key, timeout=timeout)
    started = time.perf_counter()
    response = await client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _user_prompt(payload)},
        ],
        temperature=0.1,
    )
    duration_ms = int((time.perf_counter() - started) * 1000)
    content = (response.choices[0].message.content or "").strip()
    raw = json.loads(content)
    result = _normalize_result(raw, model=model)
    usage_obj = getattr(response, "usage", None)
    usage = {
        "input_tokens": int(getattr(usage_obj, "prompt_tokens", 0) or 0),
        "output_tokens": int(getattr(usage_obj, "completion_tokens", 0) or 0),
        "total_tokens": int(getattr(usage_obj, "total_tokens", 0) or 0),
        "duration_ms": duration_ms,
        "model": model,
    }
    return result, usage


async def run_analyzer(communication: dict) -> Tuple[dict, Dict[str, Any]]:
    provider = ci_provider()
    if provider == "openai":
        return await analyze_with_openai(communication)
    return analyze_with_mock(communication)
