"""Commercial invoice validation — readiness checks before export / PDP dispatch."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from commercial_engine import (
    compute_global_totals,
    parse_line_items,
    resolve_document_amounts,
    totals_from_lines,
)
from commercial_validation_models import CommercialValidationIssue, CommercialValidationResult

_INVOICE_NUMBER_PATTERN = re.compile(r"^FAC-\d{4}-\d{4}$")
_MIN_ADDRESS_LENGTH = 5


def _issue(
    code: str,
    message: str,
    *,
    severity: str = "error",
    field: Optional[str] = None,
) -> CommercialValidationIssue:
    return CommercialValidationIssue(
        code=code,
        message=message,
        severity=severity,  # type: ignore[arg-type]
        field=field,
    )


def _parse_iso_date(value: str) -> bool:
    if not value or not str(value).strip():
        return False
    try:
        datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def _validate_client(client: Optional[Dict[str, Any]]) -> tuple[List[CommercialValidationIssue], List[CommercialValidationIssue]]:
    errors: List[CommercialValidationIssue] = []
    warnings: List[CommercialValidationIssue] = []

    if not client:
        errors.append(_issue("CLIENT_MISSING", "Client record is required.", field="clientId"))
        return errors, warnings

    name = (client.get("name") or "").strip()
    if not name:
        errors.append(_issue("CLIENT_NAME_MISSING", "Client name is required.", field="client.name"))

    address = (client.get("address") or "").strip()
    city = (client.get("city") or "").strip()
    if len(address) < _MIN_ADDRESS_LENGTH:
        errors.append(
            _issue(
                "CLIENT_ADDRESS_MISSING",
                "Client billing address is required for e-invoicing.",
                field="client.address",
            )
        )
    if not city:
        warnings.append(
            _issue(
                "CLIENT_CITY_MISSING",
                "Client city is recommended for structured invoices.",
                severity="warning",
                field="client.city",
            )
        )

    company = (client.get("company") or "").strip()
    siret = (client.get("siret") or "").strip()
    vat_number = (client.get("vatNumber") or "").strip()
    if company and not siret:
        warnings.append(
            _issue(
                "CLIENT_SIRET_RECOMMENDED",
                "SIRET is recommended when the client is a company.",
                severity="warning",
                field="client.siret",
            )
        )
    if company and not vat_number:
        warnings.append(
            _issue(
                "CLIENT_VAT_RECOMMENDED",
                "VAT number is recommended for B2B invoices.",
                severity="warning",
                field="client.vatNumber",
            )
        )

    return errors, warnings


def _validate_seller(seller: Optional[Dict[str, Any]]) -> tuple[List[CommercialValidationIssue], List[CommercialValidationIssue]]:
    errors: List[CommercialValidationIssue] = []
    warnings: List[CommercialValidationIssue] = []

    if not seller:
        errors.append(_issue("SELLER_MISSING", "Seller account is required.", field="seller"))
        return errors, warnings

    company = (seller.get("companyName") or "").strip()
    if not company:
        errors.append(
            _issue("SELLER_COMPANY_MISSING", "Seller company name is required.", field="seller.companyName")
        )

    siret = (seller.get("siret") or "").strip()
    vat_number = (seller.get("vatNumber") or "").strip()
    if not siret:
        warnings.append(
            _issue(
                "SELLER_SIRET_RECOMMENDED",
                "Seller SIRET will be required for PDP submission.",
                severity="warning",
                field="seller.siret",
            )
        )
    if not vat_number:
        warnings.append(
            _issue(
                "SELLER_VAT_RECOMMENDED",
                "Seller VAT number will be required for PDP submission.",
                severity="warning",
                field="seller.vatNumber",
            )
        )

    return errors, warnings


def _validate_lines(invoice: Dict[str, Any]) -> tuple[List[CommercialValidationIssue], List[CommercialValidationIssue]]:
    errors: List[CommercialValidationIssue] = []
    warnings: List[CommercialValidationIssue] = []

    raw_lines = invoice.get("lineItems")
    lines = parse_line_items(raw_lines)

    if not lines:
        amount_ht = int(invoice.get("amountHT") or 0)
        if amount_ht <= 0:
            errors.append(_issue("LINES_EMPTY", "At least one line item or a positive amount is required.", field="lineItems"))
        return errors, warnings

    for index, line in enumerate(lines, start=1):
        if line.amountHT <= 0:
            errors.append(
                _issue(
                    "LINE_AMOUNT_INVALID",
                    f"Line {index} must have a positive amount.",
                    field=f"lineItems[{index - 1}].amountHT",
                )
            )
        if line.vatRate is not None and (line.vatRate < 0 or line.vatRate > 100):
            errors.append(
                _issue(
                    "LINE_VAT_INVALID",
                    f"Line {index} VAT rate must be between 0 and 100.",
                    field=f"lineItems[{index - 1}].vatRate",
                )
            )

    return errors, warnings


def _validate_totals(invoice: Dict[str, Any]) -> List[CommercialValidationIssue]:
    errors: List[CommercialValidationIssue] = []
    stored_ht = int(invoice.get("amountHT") or 0)
    stored_vat = int(invoice.get("vatRate") or 0)
    stored_ttc = int(invoice.get("amountTTC") or 0)

    lines = parse_line_items(invoice.get("lineItems"))
    if lines:
        expected = totals_from_lines(lines, fallback_vat_rate=stored_vat)
    else:
        expected = compute_global_totals(stored_ht, stored_vat)

    if expected.amountHT != stored_ht:
        errors.append(
            _issue(
                "TOTALS_HT_MISMATCH",
                "Stored amount HT does not match line items.",
                field="amountHT",
            )
        )
    if expected.amountTTC != stored_ttc:
        errors.append(
            _issue(
                "TOTALS_TTC_MISMATCH",
                "Stored amount TTC does not match computed total.",
                field="amountTTC",
            )
        )

    vat_amount = stored_ttc - stored_ht
    if stored_ht > 0:
        implied_rate = int(round(vat_amount * 100 / stored_ht))
        if abs(implied_rate - stored_vat) > 1 and not lines:
            errors.append(
                _issue(
                    "TOTALS_VAT_INCONSISTENT",
                    "HT, VAT rate and TTC are inconsistent.",
                    field="vatRate",
                )
            )

    return errors


def _validate_numbering_and_dates(invoice: Dict[str, Any]) -> List[CommercialValidationIssue]:
    errors: List[CommercialValidationIssue] = []

    number = (invoice.get("number") or "").strip()
    if not number:
        errors.append(_issue("NUMBER_MISSING", "Invoice number is required.", field="number"))
    elif not _INVOICE_NUMBER_PATTERN.match(number):
        errors.append(
            _issue(
                "NUMBER_FORMAT_INVALID",
                "Invoice number must match FAC-YYYY-#### format.",
                field="number",
            )
        )

    invoice_date = invoice.get("invoiceDate") or ""
    if not invoice_date:
        errors.append(_issue("DATE_MISSING", "Invoice date is required.", field="invoiceDate"))
    elif not _parse_iso_date(invoice_date):
        errors.append(_issue("DATE_INVALID", "Invoice date is not a valid ISO date.", field="invoiceDate"))

    return errors


def validate_invoice_document(
    invoice: Dict[str, Any],
    *,
    client: Optional[Dict[str, Any]] = None,
    seller: Optional[Dict[str, Any]] = None,
) -> CommercialValidationResult:
    """Validate an invoice Mongo document before export or PDP dispatch."""
    errors: List[CommercialValidationIssue] = []
    warnings: List[CommercialValidationIssue] = []

    if invoice.get("status") == "cancelled":
        errors.append(_issue("INVOICE_CANCELLED", "Cancelled invoices cannot be exported.", field="status"))

    client_errors, client_warnings = _validate_client(client)
    seller_errors, seller_warnings = _validate_seller(seller)
    line_errors, line_warnings = _validate_lines(invoice)

    errors.extend(client_errors)
    errors.extend(seller_errors)
    errors.extend(line_errors)
    errors.extend(_validate_totals(invoice))
    errors.extend(_validate_numbering_and_dates(invoice))

    warnings.extend(client_warnings)
    warnings.extend(seller_warnings)
    warnings.extend(line_warnings)

    return CommercialValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )


async def validate_invoice_for_user(db, user_id: str, invoice: Dict[str, Any]) -> CommercialValidationResult:
    client = await db.clients.find_one(
        {"userId": user_id, "id": invoice.get("clientId")},
        {"_id": 0},
    )
    seller = await db.users.find_one({"id": user_id}, {"_id": 0, "passwordHash": 0})
    return validate_invoice_document(invoice, client=client, seller=seller)
