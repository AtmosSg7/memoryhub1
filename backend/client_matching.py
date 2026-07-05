import re
from typing import List, Optional

from import_models import ClientMatch, NormalizedCommercialFields


def _normalize_phone(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\D", "", value)


def _normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.strip().lower())


def _client_display_name(client: dict) -> str:
    company = (client.get("company") or "").strip()
    if company:
        return company
    return client.get("name") or ""


def match_clients(
    clients: List[dict],
    fields: NormalizedCommercialFields,
    *,
    limit: int = 5,
    min_score: float = 30.0,
) -> List[ClientMatch]:
    target_email = _normalize_text(str(fields.email) if fields.email else None)
    target_phone = _normalize_phone(fields.phone)
    target_company = _normalize_text(fields.company)
    target_name = _normalize_text(fields.clientName)
    target_address = _normalize_text(fields.address)

    matches: List[ClientMatch] = []

    for client in clients:
        score = 0.0
        reasons: List[str] = []

        client_email = _normalize_text(client.get("email"))
        if target_email and client_email and target_email == client_email:
            score += 100
            reasons.append("email_exact")

        client_phone = _normalize_phone(client.get("phone"))
        if target_phone and client_phone:
            if target_phone == client_phone:
                score += 80
                reasons.append("phone_exact")
            elif target_phone.endswith(client_phone[-9:]) or client_phone.endswith(target_phone[-9:]):
                score += 60
                reasons.append("phone_partial")

        client_company = _normalize_text(client.get("company"))
        if target_company and client_company:
            if target_company == client_company:
                score += 70
                reasons.append("company_exact")
            elif target_company in client_company or client_company in target_company:
                score += 45
                reasons.append("company_partial")

        client_name = _normalize_text(client.get("name"))
        if target_name and client_name:
            if target_name == client_name:
                score += 50
                reasons.append("name_exact")
            elif target_name in client_name or client_name in target_name:
                score += 30
                reasons.append("name_partial")

        client_address = _normalize_text(client.get("address"))
        if target_address and client_address:
            if target_address == client_address:
                score += 35
                reasons.append("address_exact")
            elif target_address in client_address or client_address in target_address:
                score += 20
                reasons.append("address_partial")

        if score >= min_score:
            matches.append(
                ClientMatch(
                    clientId=client["id"],
                    clientName=_client_display_name(client),
                    score=min(score, 100.0),
                    reasons=reasons,
                )
            )

    matches.sort(key=lambda item: item.score, reverse=True)
    return matches[:limit]
