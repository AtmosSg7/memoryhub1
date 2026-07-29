"""Unit tests for Google Contacts matching helpers."""

from integrations.matching import find_matching_client, normalize_email_loose, normalize_phone_fr
from integrations.models import RemoteContact, RemoteContactEmail, RemoteContactPhone


def test_normalize_phone_fr():
    assert normalize_phone_fr("+33 6 12 34 56 78") == "0612345678"
    assert normalize_phone_fr("06 12 34 56 78") == "0612345678"


def test_normalize_email():
    assert normalize_email_loose("  Jean@Martin.FR ") == "jean@martin.fr"


def test_match_by_email():
    clients = [{"id": "1", "email": "jean@martin.fr", "name": "Jean", "emails": [], "phones": []}]
    contact = RemoteContact(
        sourceId="people/x",
        displayName="Jean Martin",
        emails=[RemoteContactEmail(value="jean@martin.fr", primary=True)],
    )
    match, reason = find_matching_client(clients, contact)
    assert match["id"] == "1"
    assert reason == "email"


def test_match_by_phone():
    clients = [
        {
            "id": "2",
            "phone": "0700000000",
            "name": "Sophie",
            "emails": [],
            "phones": [{"value": "0700000000"}],
        }
    ]
    contact = RemoteContact(
        sourceId="people/y",
        displayName="Sophie Durand",
        phones=[RemoteContactPhone(value="+33 7 00 00 00 00", primary=True)],
    )
    match, reason = find_matching_client(clients, contact)
    assert match["id"] == "2"
    assert reason == "phone"


def test_match_by_name_company_fallback():
    clients = [
        {
            "id": "3",
            "name": "Jean Martin",
            "contactName": "Jean Martin",
            "company": "Martin Plomberie",
            "emails": [],
            "phones": [],
        }
    ]
    contact = RemoteContact(
        sourceId="people/z",
        displayName="Jean Martin",
        company="Martin Plomberie",
    )
    match, reason = find_matching_client(clients, contact)
    assert match["id"] == "3"
    assert reason == "name_company"


def test_no_match():
    clients = [{"id": "4", "name": "Other", "emails": [], "phones": []}]
    contact = RemoteContact(sourceId="people/w", displayName="Unknown")
    match, reason = find_matching_client(clients, contact)
    assert match is None
    assert reason == ""
