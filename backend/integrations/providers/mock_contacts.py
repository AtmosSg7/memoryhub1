"""Mock Google Contacts provider for tests and local dev without credentials."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional
from urllib.parse import urlencode

from integrations.contacts_provider import ContactsProvider
from integrations.models import (
    RemoteContact,
    RemoteContactAddress,
    RemoteContactEmail,
    RemoteContactPhone,
)

_MOCK_CODES: Dict[str, dict] = {}
_MOCK_CONTACTS: List[RemoteContact] = []


def reset_mock_google_contacts() -> None:
    _MOCK_CODES.clear()
    _MOCK_CONTACTS.clear()


def seed_mock_google_contacts(contacts: Optional[List[RemoteContact]] = None) -> None:
    _MOCK_CONTACTS.clear()
    if contacts:
        _MOCK_CONTACTS.extend(contacts)
    else:
        _MOCK_CONTACTS.extend(_default_contacts())


def register_mock_auth_code(code: str, *, account_email: str = "artisan@gmail.com") -> None:
    _MOCK_CODES[code] = {
        "access_token": f"mock-access-{code}",
        "refresh_token": f"mock-refresh-{code}",
        "expires_in": 3600,
        "token_type": "Bearer",
        "scope": "https://www.googleapis.com/auth/contacts.readonly",
        "account_email": account_email,
        "account_name": "Artisan Google",
        "account_id": "mock-google-user-1",
    }


def _default_contacts() -> List[RemoteContact]:
    return [
        RemoteContact(
            sourceId="people/c1",
            displayName="Jean Martin",
            givenName="Jean",
            familyName="Martin",
            company="Martin Plomberie",
            photoUrl="https://example.com/photo-jean.jpg",
            emails=[
                RemoteContactEmail(
                    value="jean@martin.fr",
                    label="work",
                    primary=True,
                    sourceId="people/c1/emails/0",
                )
            ],
            phones=[
                RemoteContactPhone(
                    value="06 12 34 56 78",
                    label="mobile",
                    primary=True,
                    sourceId="people/c1/phones/0",
                )
            ],
            addresses=[
                RemoteContactAddress(
                    line1="10 rue du Port",
                    city="Lyon",
                    postalCode="69001",
                    country="FR",
                    label="work",
                    primary=True,
                    sourceId="people/c1/addresses/0",
                )
            ],
        ),
        RemoteContact(
            sourceId="people/c2",
            displayName="Sophie Durand",
            givenName="Sophie",
            familyName="Durand",
            company="Durand Élec",
            emails=[
                RemoteContactEmail(
                    value="sophie@durand.fr",
                    label="work",
                    primary=True,
                    sourceId="people/c2/emails/0",
                )
            ],
            phones=[
                RemoteContactPhone(
                    value="+33 7 00 00 00 00",
                    label="mobile",
                    primary=True,
                    sourceId="people/c2/phones/0",
                )
            ],
        ),
    ]


class MockGoogleContactsProvider(ContactsProvider):
    provider_key = "google_contacts"

    def build_authorize_url(self, *, state: str, redirect_uri: str) -> str:
        params = urlencode(
            {
                "client_id": "mock-google-client",
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "https://www.googleapis.com/auth/contacts.readonly",
                "state": state,
                "access_type": "offline",
                "prompt": "consent",
            }
        )
        return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"

    async def exchange_code(self, *, code: str, redirect_uri: str) -> dict:
        payload = _MOCK_CODES.get(code)
        if not payload:
            register_mock_auth_code(code)
            payload = _MOCK_CODES[code]
        if not _MOCK_CONTACTS:
            seed_mock_google_contacts()
        return dict(payload)

    async def refresh_access_token(self, *, refresh_token: str) -> dict:
        if not refresh_token.startswith("mock-refresh-"):
            raise ValueError("Invalid mock refresh token.")
        return {
            "access_token": f"mock-access-refreshed-{datetime.now(timezone.utc).timestamp()}",
            "expires_in": 3600,
            "token_type": "Bearer",
            "refresh_token": refresh_token,
        }

    async def revoke_token(self, *, token: str) -> None:
        return None

    async def list_contacts(self, *, access_token: str) -> List[RemoteContact]:
        if not access_token.startswith("mock-access-"):
            raise ValueError("Invalid mock access token.")
        if not _MOCK_CONTACTS:
            seed_mock_google_contacts()
        return list(_MOCK_CONTACTS)

    async def count_contacts(self, *, access_token: str) -> int:
        contacts = await self.list_contacts(access_token=access_token)
        return len(contacts)
