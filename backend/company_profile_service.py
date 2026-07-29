"""Company profile — single source of truth for seller/issuer identity."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException, UploadFile

from company_profile_models import CompanyProfilePublic, CompanyProfileUpdate
from company_profile_validators import (
    validate_bic,
    validate_business_email,
    validate_iban,
    validate_phone,
    validate_primary_color,
    validate_siret,
    validate_vat_number,
)
from email_templates import resolve_sender_name

DEFAULT_PROFILE = {
    "country": "FR",
    "paymentDelayDays": 30,
    "defaultVatRate": 20,
    "currency": "EUR",
    "quotePrefix": "DEV",
    "invoicePrefix": "FAC",
    "primaryColor": "#0A2540",
}

USER_PROFILE_PROJECTION = {
    "_id": 0,
    "passwordHash": 0,
    "emailVerificationToken": 0,
    "passwordResetToken": 0,
    "passwordResetExpires": 0,
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sanitize_prefix(value: Optional[str], fallback: str) -> str:
    if not value or not str(value).strip():
        return fallback
    cleaned = re.sub(r"[^A-Za-z0-9]", "", str(value).strip().upper())
    return cleaned[:10] or fallback


def _resolve_default_vat_rate(value: Optional[Any]) -> int:
    if value is None:
        return 20
    return max(0, min(int(value), 100))


def migrate_profile_from_user(user: dict) -> dict:
    existing = user.get("companyProfile")
    if isinstance(existing, dict) and existing.get("legalName"):
        merged = {**DEFAULT_PROFILE, **existing}
        merged["legalName"] = (merged.get("legalName") or user.get("companyName") or "").strip()
        return merged

    return {
        **DEFAULT_PROFILE,
        "legalName": (user.get("companyName") or "").strip(),
        "email": user.get("email"),
        "updatedAt": user.get("updatedAt"),
    }


def profile_public(raw: dict) -> CompanyProfilePublic:
    data = {**DEFAULT_PROFILE, **(raw or {})}
    return CompanyProfilePublic(
        legalName=data.get("legalName") or "",
        tradeName=data.get("tradeName"),
        siret=data.get("siret"),
        vatNumber=data.get("vatNumber"),
        address=data.get("address"),
        postalCode=data.get("postalCode"),
        city=data.get("city"),
        country=data.get("country") or "FR",
        phone=data.get("phone"),
        email=data.get("email"),
        website=data.get("website"),
        iban=data.get("iban"),
        bic=data.get("bic"),
        bankName=data.get("bankName"),
        paymentTerms=data.get("paymentTerms"),
        paymentDelayDays=int(data.get("paymentDelayDays") or 30),
        latePenaltyRate=data.get("latePenaltyRate"),
        flatRecoveryIndemnity=data.get("flatRecoveryIndemnity"),
        defaultVatRate=_resolve_default_vat_rate(data.get("defaultVatRate")),
        currency=(data.get("currency") or "EUR").upper(),
        quotePrefix=_sanitize_prefix(data.get("quotePrefix"), "DEV"),
        invoicePrefix=_sanitize_prefix(data.get("invoicePrefix"), "FAC"),
        logoStorageKey=data.get("logoStorageKey"),
        pdfLogoStorageKey=data.get("pdfLogoStorageKey"),
        primaryColor=data.get("primaryColor") or "#0A2540",
        emailSignature=data.get("emailSignature"),
        updatedAt=data.get("updatedAt"),
    )


async def get_user_with_profile(db, user_id: str) -> dict:
    user = await db.users.find_one({"id": user_id}, USER_PROFILE_PROJECTION)
    if not user:
        raise HTTPException(status_code=404, detail={"message": "User not found."})
    user["companyProfile"] = migrate_profile_from_user(user)
    return user


async def get_company_profile(db, user_id: str) -> CompanyProfilePublic:
    user = await get_user_with_profile(db, user_id)
    return profile_public(user["companyProfile"])


def get_seller_dict(user: dict, profile: Optional[dict] = None) -> Dict[str, Any]:
    """Normalized seller payload for PDF, validation, PDP, Factur-X."""
    prof = profile or migrate_profile_from_user(user)
    display_name = (prof.get("tradeName") or prof.get("legalName") or user.get("companyName") or "").strip()
    return {
        "companyName": display_name,
        "legalName": (prof.get("legalName") or user.get("companyName") or "").strip(),
        "tradeName": prof.get("tradeName"),
        "siret": prof.get("siret"),
        "vatNumber": prof.get("vatNumber"),
        "address": prof.get("address"),
        "postalCode": prof.get("postalCode"),
        "city": prof.get("city"),
        "country": prof.get("country") or "FR",
        "phone": prof.get("phone"),
        "email": prof.get("email") or user.get("email"),
        "website": prof.get("website"),
        "iban": prof.get("iban"),
        "bic": prof.get("bic"),
        "bankName": prof.get("bankName"),
        "paymentTerms": prof.get("paymentTerms"),
        "paymentDelayDays": int(prof.get("paymentDelayDays") or 30),
        "latePenaltyRate": prof.get("latePenaltyRate"),
        "flatRecoveryIndemnity": prof.get("flatRecoveryIndemnity"),
        "defaultVatRate": _resolve_default_vat_rate(prof.get("defaultVatRate")),
        "currency": (prof.get("currency") or "EUR").upper(),
        "quotePrefix": _sanitize_prefix(prof.get("quotePrefix"), "DEV"),
        "invoicePrefix": _sanitize_prefix(prof.get("invoicePrefix"), "FAC"),
        "primaryColor": prof.get("primaryColor") or "#0A2540",
        "emailSignature": prof.get("emailSignature"),
        "logoStorageKey": prof.get("logoStorageKey"),
        "pdfLogoStorageKey": prof.get("pdfLogoStorageKey") or prof.get("logoStorageKey"),
        "firstName": user.get("firstName"),
        "lastName": user.get("lastName"),
        "contactName": " ".join(
            part for part in [user.get("firstName"), user.get("lastName")] if part
        ).strip(),
    }


def resolve_sender_display(user: dict, profile: Optional[dict] = None, *, lang: str = "fr") -> str:
    prof = profile or migrate_profile_from_user(user)
    company = (prof.get("tradeName") or prof.get("legalName") or user.get("companyName") or "").strip()
    if prof.get("emailSignature"):
        return prof["emailSignature"].strip()
    return resolve_sender_name(
        company,
        lang if lang in ("fr", "en") else "fr",
        first_name=user.get("firstName") or "",
        last_name=user.get("lastName") or "",
    )


def _validation_error(field: str, message: str) -> HTTPException:
    return HTTPException(status_code=422, detail={"message": message, "field": field})


async def update_company_profile(db, user_id: str, body: CompanyProfileUpdate) -> CompanyProfilePublic:
    user = await get_user_with_profile(db, user_id)
    current = dict(user["companyProfile"])
    updates = body.model_dump(exclude_unset=True)

    validators = {
        "siret": validate_siret,
        "vatNumber": validate_vat_number,
        "email": validate_business_email,
        "phone": validate_phone,
        "iban": validate_iban,
        "bic": validate_bic,
        "primaryColor": validate_primary_color,
    }

    for field, validator in validators.items():
        if field not in updates:
            continue
        normalized, error = validator(updates.get(field))
        if error:
            raise _validation_error(field, error)
        updates[field] = normalized

    if "legalName" in updates:
        updates["legalName"] = (updates["legalName"] or "").strip()
        if not updates["legalName"]:
            raise _validation_error("legalName", "Le nom de l'entreprise est requis.")

    if "quotePrefix" in updates:
        updates["quotePrefix"] = _sanitize_prefix(updates.get("quotePrefix"), current.get("quotePrefix", "DEV"))
    if "invoicePrefix" in updates:
        updates["invoicePrefix"] = _sanitize_prefix(
            updates.get("invoicePrefix"), current.get("invoicePrefix", "FAC")
        )
    if "currency" in updates and updates["currency"]:
        updates["currency"] = str(updates["currency"]).upper()

    merged = {**current, **updates, "updatedAt": _utc_now_iso()}
    sync_company_name = merged.get("legalName") or user.get("companyName")

    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "companyProfile": merged,
                "companyName": sync_company_name,
                "updatedAt": _utc_now_iso(),
            }
        },
    )
    return profile_public(merged)


async def get_document_prefixes(db, user_id: str) -> Dict[str, str]:
    profile = await get_company_profile(db, user_id)
    return {
        "quotePrefix": profile.quotePrefix,
        "invoicePrefix": profile.invoicePrefix,
    }


async def get_default_vat_rate(db, user_id: str) -> int:
    profile = await get_company_profile(db, user_id)
    return profile.defaultVatRate


def resolve_import_vat_rate(
    detected_rate: Optional[int],
    confidence: Optional[float],
    default_rate: int,
    *,
    threshold: float = 0.85,
) -> int:
    """Use detected VAT only when confidence is sufficient; otherwise profile default."""
    if detected_rate is not None and (confidence or 0.0) >= threshold:
        return detected_rate
    return default_rate


def _logo_storage_key(user_id: str, kind: str, filename: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", filename or "logo.png")
    return f"company-logos/{user_id}/{kind}/{uuid.uuid4().hex}-{safe}"


async def store_company_logo(
    db,
    user_id: str,
    file: UploadFile,
    *,
    kind: str = "logo",
) -> CompanyProfilePublic:
    from file_validation import validate_file_magic
    from storage import get_storage

    content = await file.read()
    if not content or len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail={"message": "Logo must be under 2 MB."})
    filename = file.filename or "logo.png"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "png"
    if ext not in {"png", "jpg", "jpeg", "webp"}:
        raise HTTPException(status_code=400, detail={"message": "Logo must be PNG, JPG or WebP."})
    validate_file_magic(ext, content)
    storage = get_storage()
    key = _logo_storage_key(user_id, kind, filename)
    await storage.save(key, content)

    user = await get_user_with_profile(db, user_id)
    profile = dict(user["companyProfile"])
    field = "pdfLogoStorageKey" if kind == "pdf" else "logoStorageKey"
    profile[field] = key
    profile["updatedAt"] = _utc_now_iso()

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"companyProfile": profile, "updatedAt": _utc_now_iso()}},
    )
    return profile_public(profile)


def build_logo_api_url(storage_key: Optional[str]) -> Optional[str]:
    if not storage_key:
        return None
    return f"/api/company-profile/assets/{storage_key}"
