"""Google Contacts (People API) provider — read-only OAuth + contact fetch."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import httpx

from integrations.config import (
    google_client_id,
    google_client_secret,
    google_contacts_scopes,
)
from integrations.contacts_provider import ContactsProvider
from integrations.models import (
    RemoteContact,
    RemoteContactAddress,
    RemoteContactEmail,
    RemoteContactPhone,
)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_PEOPLE_URL = "https://people.googleapis.com/v1/people/me/connections"


def _label_from_google(type_value: Optional[str]) -> str:
    raw = (type_value or "").strip().lower()
    mapping = {
        "home": "personal",
        "work": "work",
        "mobile": "mobile",
        "other": "other",
        "main": "main",
    }
    return mapping.get(raw, "other" if raw else "main")


def _parse_person(person: Dict[str, Any]) -> Optional[RemoteContact]:
    resource = (person.get("resourceName") or "").strip()
    if not resource:
        return None

    names = person.get("names") or []
    primary_name = next((n for n in names if n.get("metadata", {}).get("primary")), None) or (
        names[0] if names else {}
    )
    given = (primary_name.get("givenName") or "").strip() or None
    family = (primary_name.get("familyName") or "").strip() or None
    display = (primary_name.get("displayName") or "").strip()
    if not display:
        display = " ".join([p for p in [given, family] if p]).strip() or resource

    orgs = person.get("organizations") or []
    company = None
    if orgs:
        primary_org = next((o for o in orgs if o.get("metadata", {}).get("primary")), None) or orgs[0]
        company = (primary_org.get("name") or "").strip() or None

    photos = person.get("photos") or []
    photo_url = None
    if photos:
        primary_photo = next((p for p in photos if p.get("metadata", {}).get("primary")), None) or photos[0]
        photo_url = (primary_photo.get("url") or "").strip() or None

    emails: List[RemoteContactEmail] = []
    for index, entry in enumerate(person.get("emailAddresses") or []):
        value = (entry.get("value") or "").strip()
        if not value:
            continue
        emails.append(
            RemoteContactEmail(
                value=value,
                label=_label_from_google(entry.get("type")),
                primary=bool(entry.get("metadata", {}).get("primary")) or index == 0,
                sourceId=f"{resource}/emails/{index}",
            )
        )

    phones: List[RemoteContactPhone] = []
    for index, entry in enumerate(person.get("phoneNumbers") or []):
        value = (entry.get("value") or "").strip()
        if not value:
            continue
        phones.append(
            RemoteContactPhone(
                value=value,
                label=_label_from_google(entry.get("type")),
                primary=bool(entry.get("metadata", {}).get("primary")) or index == 0,
                sourceId=f"{resource}/phones/{index}",
            )
        )

    addresses: List[RemoteContactAddress] = []
    for index, entry in enumerate(person.get("addresses") or []):
        line1 = (entry.get("streetAddress") or entry.get("formattedValue") or "").strip() or None
        city = (entry.get("city") or "").strip() or None
        postal = (entry.get("postalCode") or "").strip() or None
        country = (entry.get("countryCode") or entry.get("country") or "FR").strip() or "FR"
        if not any([line1, city, postal]):
            continue
        addresses.append(
            RemoteContactAddress(
                line1=line1,
                line2=(entry.get("extendedAddress") or "").strip() or None,
                city=city,
                postalCode=postal,
                country=country[:2].upper(),
                label=_label_from_google(entry.get("type")),
                primary=bool(entry.get("metadata", {}).get("primary")) or index == 0,
                sourceId=f"{resource}/addresses/{index}",
            )
        )

    if not any([emails, phones, addresses, company, display]):
        return None

    return RemoteContact(
        sourceId=resource,
        displayName=display,
        givenName=given,
        familyName=family,
        company=company,
        photoUrl=photo_url,
        emails=emails,
        phones=phones,
        addresses=addresses,
        raw={"resourceName": resource},
    )


class GoogleContactsProvider(ContactsProvider):
    provider_key = "google_contacts"

    def build_authorize_url(self, *, state: str, redirect_uri: str) -> str:
        params = {
            "client_id": google_client_id(),
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(google_contacts_scopes()),
            "state": state,
            "access_type": "offline",
            "include_granted_scopes": "true",
            "prompt": "consent",
        }
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, *, code: str, redirect_uri: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            token_res = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": google_client_id(),
                    "client_secret": google_client_secret(),
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            token_res.raise_for_status()
            token_data = token_res.json()
            access = token_data.get("access_token")
            profile = {}
            if access:
                profile_res = await client.get(
                    GOOGLE_USERINFO_URL,
                    headers={"Authorization": f"Bearer {access}"},
                )
                if profile_res.status_code == 200:
                    profile = profile_res.json()

        return {
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "expires_in": int(token_data.get("expires_in") or 3600),
            "token_type": token_data.get("token_type") or "Bearer",
            "scope": token_data.get("scope") or " ".join(google_contacts_scopes()),
            "account_email": profile.get("email"),
            "account_name": profile.get("name"),
            "account_id": profile.get("sub"),
        }

    async def refresh_access_token(self, *, refresh_token: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": google_client_id(),
                    "client_secret": google_client_secret(),
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )
            res.raise_for_status()
            data = res.json()
        return {
            "access_token": data.get("access_token"),
            "expires_in": int(data.get("expires_in") or 3600),
            "token_type": data.get("token_type") or "Bearer",
            "refresh_token": data.get("refresh_token") or refresh_token,
            "scope": data.get("scope"),
        }

    async def revoke_token(self, *, token: str) -> None:
        if not token:
            return
        async with httpx.AsyncClient(timeout=15.0) as client:
            await client.post(GOOGLE_REVOKE_URL, params={"token": token})

    async def list_contacts(self, *, access_token: str) -> List[RemoteContact]:
        contacts: List[RemoteContact] = []
        page_token = None
        async with httpx.AsyncClient(timeout=45.0) as client:
            while True:
                params = {
                    "personFields": "names,emailAddresses,phoneNumbers,organizations,addresses,photos",
                    "pageSize": 200,
                }
                if page_token:
                    params["pageToken"] = page_token
                res = await client.get(
                    GOOGLE_PEOPLE_URL,
                    params=params,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                res.raise_for_status()
                payload = res.json()
                for person in payload.get("connections") or []:
                    parsed = _parse_person(person)
                    if parsed:
                        contacts.append(parsed)
                page_token = payload.get("nextPageToken")
                if not page_token:
                    break
        return contacts

    async def count_contacts(self, *, access_token: str) -> int:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.get(
                GOOGLE_PEOPLE_URL,
                params={
                    "personFields": "names",
                    "pageSize": 1,
                },
                headers={"Authorization": f"Bearer {access_token}"},
            )
            res.raise_for_status()
            payload = res.json()
            total = payload.get("totalPeople")
            if total is not None:
                return int(total)
            # Fallback: full list count (rare)
        contacts = await self.list_contacts(access_token=access_token)
        return len(contacts)
