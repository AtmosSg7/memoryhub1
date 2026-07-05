import base64
import hashlib
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from openai import AsyncOpenAI

from analysis.base import AnalysisContext, DocumentAnalyzer
from import_models import AnalysisResultData, DocumentKind, NormalizedCommercialFields, utc_now_iso

logger = logging.getLogger(__name__)

VALID_KINDS = {
    "quote",
    "invoice",
    "purchase_order",
    "delivery_note",
    "receipt",
    "supplier_invoice",
    "contract",
    "other",
}

KIND_ALIASES = {
    "devis": "quote",
    "quote": "quote",
    "facture": "invoice",
    "invoice": "invoice",
    "bon de commande": "purchase_order",
    "purchase_order": "purchase_order",
    "bon de livraison": "delivery_note",
    "delivery_note": "delivery_note",
    "recu": "receipt",
    "reçu": "receipt",
    "receipt": "receipt",
    "facture fournisseur": "supplier_invoice",
    "supplier_invoice": "supplier_invoice",
    "contrat": "contract",
    "contract": "contract",
    "other": "other",
    "autre": "other",
}

CONFIDENCE_FIELDS = (
    "clientName",
    "company",
    "email",
    "phone",
    "externalNumber",
    "documentDate",
    "amountHT",
    "vatRate",
    "amountTTC",
    "title",
)

SYSTEM_PROMPT = (
    "Tu es un assistant d'extraction documentaire pour artisans français. "
    "Tu analyses des devis, factures et documents commerciaux. "
    "Tu réponds UNIQUEMENT avec un objet JSON valide, sans markdown."
)

USER_PROMPT = """Analyse ce document (PDF, image, scan ou photo) et extrais les informations commerciales.

Le client est le destinataire du document (pas l'artisan ou l'entreprise émettrice).
externalNumber est le numéro du devis/facture visible sur le document.

Retourne un JSON avec exactement cette forme :
{
  "detectedKind": "quote|invoice|purchase_order|delivery_note|receipt|supplier_invoice|contract|other",
  "detectedKindConfidence": 0.0,
  "overallConfidence": 0.0,
  "warnings": [],
  "errors": [],
  "confidence": {
    "clientName": 0.0,
    "company": 0.0,
    "email": 0.0,
    "phone": 0.0,
    "externalNumber": 0.0,
    "documentDate": 0.0,
    "amountHT": 0.0,
    "vatRate": 0.0,
    "amountTTC": 0.0,
    "title": 0.0
  },
  "normalized": {
    "clientName": null,
    "company": null,
    "contactName": null,
    "email": null,
    "phone": null,
    "address": null,
    "city": null,
    "externalNumber": null,
    "documentDate": null,
    "title": null,
    "amountHT": null,
    "vatRate": null,
    "amountTTC": null,
    "internalNotes": null
  },
  "lineItems": [],
  "description": null
}

Exemple lineItems :
[
  {
    "label": "Pose carrelage salle de bain",
    "quantity": 12,
    "unitPriceHT": 4500,
    "amountHT": 54000,
    "vatRate": 20,
    "discount": null
  }
]

Règles strictes :
- Montants amountHT, amountTTC et lineItems[].amountHT : entiers en centimes d'euro, jamais en euros.
  Exemple : 2 450,00 € => 245000 (pas 2450 ni 2450.0).
- vatRate en pourcentage entier (ex: 20).
- documentDate en ISO 8601 (YYYY-MM-DD ou date-heure UTC) si détectable.
- Si document vide, flou, illisible ou incomplet : warnings explicites, confiances basses, champs absents à null.
- Ne pas inventer de valeurs absentes du document.
- lineItems : tableau optionnel des prestations/lignes du tableau, chaque objet :
  {
    "label": "description de la ligne",
    "quantity": null,
    "unitPriceHT": null,
    "amountHT": null,
    "vatRate": null,
    "discount": null
  }
  quantity : nombre (ex: 2 ou 2.5). unitPriceHT et amountHT : centimes entiers. vatRate : entier %. discount : texte ou nombre (% ou montant visible).
- description : texte libre si présent (objet global, conditions, notes visibles hors lignes)."""


def _clamp_confidence(value: Any) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, score))


def _normalize_kind(value: Any) -> DocumentKind:
    if not value:
        return "other"
    raw = str(value).strip().lower()
    if raw in VALID_KINDS:
        return raw
    return KIND_ALIASES.get(raw, "other")


def _has_euro_decimal_format(text: str) -> bool:
    normalized = text.replace("\u00a0", " ")
    return bool(re.search(r"\d+[.,]\d{2}\b", normalized))


def _amount_to_cents(amount: float, *, from_euros: bool) -> int:
    cents = int(round(amount * 100)) if from_euros else int(round(amount))
    return max(cents, 0)


def _parse_int_cents(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return max(value, 0)
    if isinstance(value, float):
        if not float(value).is_integer():
            return _amount_to_cents(value, from_euros=True)
        whole = int(round(value))
        if whole >= 10000:
            return max(whole, 0)
        return _amount_to_cents(float(whole), from_euros=True)

    text = str(value).strip()
    if not text:
        return None

    from_euros = _has_euro_decimal_format(text)
    cleaned = (
        text.replace("\u00a0", " ")
        .replace("€", "")
        .replace("EUR", "")
        .replace("eur", "")
        .strip()
    )
    cleaned = re.sub(r"\s+", "", cleaned)
    if cleaned.count(",") == 1 and cleaned.count(".") == 0:
        cleaned = cleaned.replace(",", ".")
    elif cleaned.count(",") == 1 and cleaned.count(".") > 0:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    else:
        cleaned = cleaned.replace(",", "")

    try:
        amount = float(cleaned)
    except ValueError:
        digits = re.sub(r"[^\d]", "", text)
        if not digits:
            return None
        amount = float(digits)
        from_euros = from_euros or amount < 10000

    if from_euros or (amount < 10000 and "." in cleaned):
        return _amount_to_cents(amount, from_euros=True)
    return _amount_to_cents(amount, from_euros=False)


def _parse_vat_rate(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        rate = int(round(float(value)))
        return max(0, min(rate, 100))
    match = re.search(r"(\d+(?:[.,]\d+)?)", str(value))
    if not match:
        return None
    rate = int(round(float(match.group(1).replace(",", "."))))
    return max(0, min(rate, 100))


def _parse_document_date(value: Any) -> Optional[str]:
    if not value or not str(value).strip():
        return None

    text = str(value).strip()
    try:
        normalized = text.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except ValueError:
        pass

    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d.%m.%Y"):
        try:
            dt = datetime.strptime(text[:10], fmt).replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            continue
    return None


def _optional_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _compute_amount_ttc(amount_ht: Optional[int], vat_rate: Optional[int], amount_ttc: Optional[int]) -> Optional[int]:
    if amount_ttc is not None:
        return amount_ttc
    if amount_ht is None:
        return None
    rate = vat_rate if vat_rate is not None else 20
    return (amount_ht * (100 + rate)) // 100


def _parse_quantity(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        qty = float(value)
        return qty if qty > 0 else None
    text = str(value).strip().replace("\u00a0", " ").replace(",", ".")
    match = re.search(r"(\d+(?:\.\d+)?)", text)
    if not match:
        return None
    qty = float(match.group(1))
    return qty if qty > 0 else None


def _parse_discount(value: Any) -> Optional[str]:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        number = float(value)
        if number <= 0:
            return None
        if number <= 100 and isinstance(value, float) and not float(value).is_integer():
            return f"{number:g} %"
        if number <= 100:
            return f"{int(round(number))} %"
        return f"{number / 100:.2f} €"
    text = str(value).strip()
    return text or None


def _normalize_line_item(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None

    label = _optional_str(raw.get("label") or raw.get("description") or raw.get("name"))
    if not label:
        return None

    quantity = _parse_quantity(raw.get("quantity") or raw.get("qty"))
    unit_price_ht = _parse_int_cents(
        raw.get("unitPriceHT") or raw.get("unitPrice") or raw.get("priceHT")
    )
    amount_ht = _parse_int_cents(
        raw.get("amountHT") or raw.get("totalHT") or raw.get("lineTotal") or raw.get("amount")
    )
    vat_rate = _parse_vat_rate(raw.get("vatRate") or raw.get("vat"))
    discount = _parse_discount(raw.get("discount") or raw.get("remise"))

    if amount_ht is None and quantity is not None and unit_price_ht is not None:
        amount_ht = int(round(quantity * unit_price_ht))

    item: Dict[str, Any] = {"label": label}
    if quantity is not None:
        item["quantity"] = quantity
    if unit_price_ht is not None:
        item["unitPriceHT"] = unit_price_ht
    if amount_ht is not None:
        item["amountHT"] = amount_ht
    if vat_rate is not None:
        item["vatRate"] = vat_rate
    if discount is not None:
        item["discount"] = discount
    return item


def _normalize_line_items(raw_items: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw_items, list):
        return []

    normalized: List[Dict[str, Any]] = []
    for raw in raw_items[:50]:
        item = _normalize_line_item(raw if isinstance(raw, dict) else {})
        if item:
            normalized.append(item)
    return normalized


def _format_line_item_note(item: Dict[str, Any]) -> str:
    label = item.get("label") or "Ligne"
    parts = [label]

    quantity = item.get("quantity")
    if quantity is not None:
        qty_text = f"{quantity:g}" if isinstance(quantity, float) else str(quantity)
        parts.append(f"Qté {qty_text}")

    unit_price = item.get("unitPriceHT")
    if unit_price is not None:
        parts.append(f"PU HT {unit_price / 100:.2f} €")

    amount_ht = item.get("amountHT")
    if amount_ht is not None:
        parts.append(f"Total HT {amount_ht / 100:.2f} €")

    vat_rate = item.get("vatRate")
    if vat_rate is not None:
        parts.append(f"TVA {vat_rate} %")

    discount = item.get("discount")
    if discount:
        parts.append(f"Remise {discount}")

    if len(parts) == 1:
        return f"- {label}"
    return f"- {parts[0]} ({', '.join(parts[1:])})"


def _build_internal_notes(
    normalized_notes: Optional[str],
    description: Optional[str],
    line_items: List[Dict[str, Any]],
) -> Optional[str]:
    parts: List[str] = []
    if normalized_notes:
        parts.append(normalized_notes.strip())
    if description:
        parts.append(description.strip())
    if line_items:
        lines = [_format_line_item_note(item) for item in line_items[:20]]
        if lines:
            parts.append("Lignes détectées :\n" + "\n".join(lines))
    if not parts:
        return None
    return "\n\n".join(parts)


def _normalize_fields(raw_fields: Dict[str, Any], detected_kind: DocumentKind) -> NormalizedCommercialFields:
    amount_ht = _parse_int_cents(raw_fields.get("amountHT"))
    vat_rate = _parse_vat_rate(raw_fields.get("vatRate"))
    amount_ttc = _compute_amount_ttc(
        amount_ht,
        vat_rate,
        _parse_int_cents(raw_fields.get("amountTTC")),
    )
    default_status = "draft" if detected_kind == "quote" else "sent"

    return NormalizedCommercialFields(
        clientName=_optional_str(raw_fields.get("clientName")),
        company=_optional_str(raw_fields.get("company")),
        contactName=_optional_str(raw_fields.get("contactName") or raw_fields.get("clientName")),
        email=_optional_str(raw_fields.get("email")),
        phone=_optional_str(raw_fields.get("phone")),
        address=_optional_str(raw_fields.get("address")),
        city=_optional_str(raw_fields.get("city")),
        externalNumber=_optional_str(raw_fields.get("externalNumber") or raw_fields.get("documentNumber")),
        documentDate=_parse_document_date(raw_fields.get("documentDate") or raw_fields.get("date")),
        title=_optional_str(raw_fields.get("title")),
        amountHT=amount_ht,
        vatRate=vat_rate if vat_rate is not None else (20 if amount_ht is not None else None),
        amountTTC=amount_ttc,
        internalNotes=_optional_str(raw_fields.get("internalNotes")),
        status=default_status,
    )


def _normalize_confidence(raw_confidence: Dict[str, Any]) -> Dict[str, float]:
    result = {field: 0.0 for field in CONFIDENCE_FIELDS}
    for field in CONFIDENCE_FIELDS:
        if field in raw_confidence:
            result[field] = _clamp_confidence(raw_confidence.get(field))
    return result


def _infer_overall_confidence(confidence: Dict[str, float], overall: Any) -> float:
    if overall is not None:
        return _clamp_confidence(overall)
    values = [score for score in confidence.values() if score > 0]
    if not values:
        return 0.0
    return round(sum(values) / len(values), 4)


def _build_content_part(content: bytes, context: AnalysisContext) -> dict:
    encoded = base64.b64encode(content).decode("ascii")
    ext = context.extension.lower()

    if ext == "pdf":
        return {
            "type": "file",
            "file": {
                "filename": context.filename,
                "file_data": f"data:application/pdf;base64,{encoded}",
            },
        }

    mime = context.mime_type or "image/jpeg"
    if ext in {"jpg", "jpeg"}:
        mime = "image/jpeg"
    elif ext == "png":
        mime = "image/png"
    elif ext == "webp":
        mime = "image/webp"

    return {
        "type": "image_url",
        "image_url": {
            "url": f"data:{mime};base64,{encoded}",
            "detail": "high",
        },
    }


def _supports_custom_temperature(model: str) -> bool:
    normalized = model.strip().lower()
    if normalized.startswith("gpt-5"):
        return False
    return True


class OpenAIAnalyzer(DocumentAnalyzer):
    def __init__(self) -> None:
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is required when ANALYZER_PROVIDER=openai.")

        self._model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip()
        self._version = os.environ.get("OPENAI_ANALYZER_VERSION", "1.0.0").strip()
        timeout = float(os.environ.get("OPENAI_ANALYZER_TIMEOUT", "120"))
        self._client = AsyncOpenAI(api_key=api_key, timeout=timeout)

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def provider_version(self) -> str:
        return self._version

    async def analyze(self, content: bytes, context: AnalysisContext) -> AnalysisResultData:
        digest = hashlib.sha256(content).hexdigest()
        now = utc_now_iso()
        warnings: List[str] = []
        errors: List[str] = []

        if len(content) < 32:
            warnings.append("Document très petit ou vide — analyse limitée.")

        parsed, call_errors, call_warnings = await self._call_model(content, context)
        warnings.extend(call_warnings)
        errors.extend(call_errors)

        if not parsed:
            return self._build_result_from_parts(
                detected_kind="other",
                detected_kind_confidence=0.0,
                normalized=NormalizedCommercialFields(status="draft"),
                confidence={field: 0.0 for field in CONFIDENCE_FIELDS},
                overall_confidence=0.0,
                raw_payload={"parseFailed": True},
                digest=digest,
                context=context,
                warnings=warnings or ["Impossible d'extraire des données exploitables."],
                errors=errors or ["Analyse IA indisponible."],
                analyzed_at=now,
                line_items=[],
                description=None,
            )

        detected_kind = _normalize_kind(parsed.get("detectedKind"))
        detected_kind_confidence = _clamp_confidence(parsed.get("detectedKindConfidence"))
        raw_fields = parsed.get("normalized") if isinstance(parsed.get("normalized"), dict) else parsed
        if not isinstance(raw_fields, dict):
            raw_fields = {}

        line_items = _normalize_line_items(parsed.get("lineItems"))
        description = _optional_str(parsed.get("description"))

        normalized = _normalize_fields(raw_fields, detected_kind)
        normalized.internalNotes = _build_internal_notes(
            normalized.internalNotes,
            description,
            line_items,
        )

        confidence = _normalize_confidence(
            parsed.get("confidence") if isinstance(parsed.get("confidence"), dict) else {}
        )
        overall_confidence = _infer_overall_confidence(confidence, parsed.get("overallConfidence"))

        model_warnings = parsed.get("warnings")
        if isinstance(model_warnings, list):
            warnings.extend(str(item) for item in model_warnings if item)

        model_errors = parsed.get("errors")
        if isinstance(model_errors, list):
            errors.extend(str(item) for item in model_errors if item)

        if normalized.amountHT is None and not errors:
            warnings.append("Montant HT non détecté — à compléter manuellement.")
            confidence["amountHT"] = min(confidence.get("amountHT", 0.0), 0.2)

        return self._build_result_from_parts(
            detected_kind=detected_kind,
            detected_kind_confidence=detected_kind_confidence,
            normalized=normalized,
            confidence=confidence,
            overall_confidence=overall_confidence,
            raw_payload=parsed,
            digest=digest,
            context=context,
            warnings=warnings,
            errors=errors,
            analyzed_at=now,
            line_items=line_items,
            description=description,
        )

    async def _call_model(
        self,
        content: bytes,
        context: AnalysisContext,
    ) -> Tuple[Optional[Dict[str, Any]], List[str], List[str]]:
        errors: List[str] = []
        warnings: List[str] = []

        try:
            request_kwargs: Dict[str, Any] = {
                "model": self._model,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": USER_PROMPT},
                            _build_content_part(content, context),
                        ],
                    },
                ],
            }
            if _supports_custom_temperature(self._model):
                request_kwargs["temperature"] = 0.1

            response = await self._client.chat.completions.create(**request_kwargs)
        except Exception as exc:
            body = getattr(exc, "body", None)
            if isinstance(body, dict) and isinstance(body.get("error"), dict):
                api_error = body["error"]
                logger.error(
                    "OpenAI API error — type=%s code=%s message=%s param=%s",
                    api_error.get("type"),
                    api_error.get("code"),
                    api_error.get("message"),
                    api_error.get("param"),
                )
            else:
                logger.error("OpenAI API error — body=%s", body if body is not None else exc)
            errors.append(f"OpenAI request failed: {exc}")
            return None, errors, warnings

        message_content = response.choices[0].message.content if response.choices else None
        if not message_content:
            errors.append("OpenAI returned an empty response.")
            return None, errors, warnings

        try:
            parsed = json.loads(message_content)
        except json.JSONDecodeError:
            errors.append("OpenAI returned invalid JSON.")
            warnings.append("Réponse IA illisible — vérifiez le document manuellement.")
            return None, errors, warnings

        if not isinstance(parsed, dict):
            errors.append("OpenAI returned an unexpected payload.")
            return None, errors, warnings

        return parsed, errors, warnings

    def _build_result_from_parts(
        self,
        *,
        detected_kind: DocumentKind,
        detected_kind_confidence: float,
        normalized: NormalizedCommercialFields,
        confidence: Dict[str, float],
        overall_confidence: float,
        raw_payload: Dict[str, Any],
        digest: str,
        context: AnalysisContext,
        warnings: List[str],
        errors: List[str],
        analyzed_at: str,
        line_items: List[Dict[str, Any]],
        description: Optional[str],
    ) -> AnalysisResultData:
        raw_extracted = {
            "provider": self.provider_name,
            "providerVersion": self.provider_version,
            "model": self._model,
            "filename": context.filename,
            "mimeType": context.mime_type,
            "extension": context.extension,
            "contentSha256": digest,
            "detectedKind": detected_kind,
            "lineItems": line_items,
            "description": description,
            "payload": raw_payload,
        }

        return AnalysisResultData(
            rawExtracted=raw_extracted,
            normalized=normalized,
            confidence=confidence,
            overallConfidence=overall_confidence,
            provider=self.provider_name,
            providerVersion=self.provider_version,
            analyzedAt=analyzed_at,
            detectedKind=detected_kind,
            detectedKindConfidence=detected_kind_confidence,
            errors=errors,
            warnings=warnings,
        )
