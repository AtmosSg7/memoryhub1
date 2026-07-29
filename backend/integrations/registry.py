"""Provider registry for contacts and email integrations."""

from __future__ import annotations

from integrations.config import contacts_provider_mode, gmail_provider_mode
from integrations.constants import PROVIDER_GMAIL, PROVIDER_GOOGLE_CONTACTS
from integrations.contacts_provider import ContactsProvider
from integrations.email_provider import EmailProvider


def get_contacts_provider(provider_key: str = PROVIDER_GOOGLE_CONTACTS) -> ContactsProvider:
    if provider_key != PROVIDER_GOOGLE_CONTACTS:
        raise ValueError(f"Unsupported contacts provider: {provider_key}")

    mode = contacts_provider_mode()
    if mode == "mock":
        from integrations.providers.mock_contacts import MockGoogleContactsProvider

        return MockGoogleContactsProvider()

    from integrations.providers.google_contacts import GoogleContactsProvider

    return GoogleContactsProvider()


def get_email_provider(provider_key: str = PROVIDER_GMAIL) -> EmailProvider:
    if provider_key != PROVIDER_GMAIL:
        raise ValueError(f"Unsupported email provider: {provider_key}")

    mode = gmail_provider_mode()
    if mode == "mock":
        from integrations.providers.mock_gmail import MockGmailProvider

        return MockGmailProvider()

    from integrations.providers.gmail import GmailProvider

    return GmailProvider()
