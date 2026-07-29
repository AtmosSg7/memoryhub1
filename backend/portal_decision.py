"""Portal decision helpers — acceptance/rejection proof without qualified e-signature claims."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import Request

PORTAL_DECISION_DISCLAIMER = (
    "Accusé de réception portail client — ne constitue pas une signature électronique qualifiée."
)


def extract_client_request_meta(request: Optional[Request]) -> Dict[str, Optional[str]]:
    if request is None:
        return {"ipAddress": None, "userAgent": None}

    forwarded = (request.headers.get("x-forwarded-for") or "").strip()
    ip_address = None
    if forwarded:
        ip_address = forwarded.split(",")[0].strip() or None
    elif request.client:
        ip_address = request.client.host

    user_agent = (request.headers.get("user-agent") or "").strip()[:500] or None
    return {"ipAddress": ip_address, "userAgent": user_agent}


def quote_version_snapshot(doc: dict) -> Dict[str, Any]:
    return {
        "number": doc.get("number"),
        "amountHT": doc.get("amountHT"),
        "amountTTC": doc.get("amountTTC"),
        "vatRate": doc.get("vatRate", 20),
        "updatedAt": doc.get("updatedAt"),
    }


def build_portal_decision_proof(
    *,
    action: str,
    at_iso: str,
    signer_name: str,
    comment: Optional[str],
    request_meta: Dict[str, Optional[str]],
    quote_doc: dict,
) -> dict:
    return {
        "action": action,
        "at": at_iso,
        "signerName": signer_name.strip(),
        "comment": (comment or "").strip() or None,
        "ipAddress": request_meta.get("ipAddress"),
        "userAgent": request_meta.get("userAgent"),
        "quoteVersion": quote_version_snapshot(quote_doc),
        "disclaimer": PORTAL_DECISION_DISCLAIMER,
    }
