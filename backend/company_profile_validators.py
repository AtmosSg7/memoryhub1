"""Field validators for company profile — user-friendly French messages."""

from __future__ import annotations

import re
from typing import Optional, Tuple

_SIRET_RE = re.compile(r"^\d{14}$")
_VAT_FR_RE = re.compile(r"^FR[A-HJ-NP-Z0-9]{2}\d{9}$", re.IGNORECASE)
_PHONE_RE = re.compile(r"^\+?[\d\s().-]{8,20}$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_IBAN_RE = re.compile(r"^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$")
_HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _luhn_valid(number: str) -> bool:
    total = 0
    reverse = number[::-1]
    for idx, ch in enumerate(reverse):
        n = int(ch)
        if idx % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def validate_siret(value: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not value or not str(value).strip():
        return None, None
    normalized = re.sub(r"\D", "", str(value))
    if not _SIRET_RE.match(normalized):
        return None, "Le SIRET doit contenir 14 chiffres."
    if not _luhn_valid(normalized[:9]):
        return None, "Le SIRET n'est pas valide (contrôle SIREN)."
    return normalized, None


def validate_vat_number(value: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not value or not str(value).strip():
        return None, None
    normalized = re.sub(r"\s+", "", str(value).upper())
    if not _VAT_FR_RE.match(normalized):
        return None, "Le numéro de TVA doit être au format FR suivi de 11 caractères."
    return normalized, None


def validate_business_email(value: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not value or not str(value).strip():
        return None, None
    normalized = str(value).strip().lower()
    if not _EMAIL_RE.match(normalized):
        return None, "Adresse e-mail invalide."
    return normalized, None


def validate_phone(value: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not value or not str(value).strip():
        return None, None
    normalized = re.sub(r"\s+", " ", str(value).strip())
    digits = re.sub(r"\D", "", normalized)
    if len(digits) < 8 or len(digits) > 15:
        return None, "Numéro de téléphone invalide."
    if not _PHONE_RE.match(normalized):
        return None, "Numéro de téléphone invalide."
    return normalized, None


def _iban_to_numeric(iban: str) -> int:
    rearranged = iban[4:] + iban[:4]
    converted = ""
    for ch in rearranged:
        converted += str(ord(ch) - 55) if ch.isalpha() else ch
    return int(converted)


def validate_iban(value: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not value or not str(value).strip():
        return None, None
    normalized = re.sub(r"\s+", "", str(value).upper())
    if not _IBAN_RE.match(normalized):
        return None, "IBAN invalide."
    if len(normalized) < 15 or len(normalized) > 34:
        return None, "IBAN invalide."
    try:
        if _iban_to_numeric(normalized) % 97 != 1:
            return None, "IBAN invalide (contrôle modulo 97)."
    except ValueError:
        return None, "IBAN invalide."
    return normalized, None


def validate_bic(value: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not value or not str(value).strip():
        return None, None
    normalized = re.sub(r"\s+", "", str(value).upper())
    if not re.match(r"^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$", normalized):
        return None, "Code BIC invalide."
    return normalized, None


def validate_primary_color(value: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not value or not str(value).strip():
        return "#0A2540", None
    normalized = str(value).strip()
    if not _HEX_COLOR_RE.match(normalized):
        return None, "La couleur doit être au format #RRGGBB."
    return normalized.upper(), None
