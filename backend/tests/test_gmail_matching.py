"""Unit tests for Gmail client matching."""

from integrations.email_matching import counterparty_emails, find_client_for_email
from integrations.models import RemoteEmailMessage


def test_counterparty_inbound_uses_from():
    msg = RemoteEmailMessage(
        sourceId="1",
        fromEmail="jean@martin.fr",
        toEmails=["artisan@gmail.com"],
        direction="inbound",
    )
    assert counterparty_emails(msg, account_email="artisan@gmail.com") == {"jean@martin.fr"}


def test_counterparty_outbound_uses_to():
    msg = RemoteEmailMessage(
        sourceId="2",
        fromEmail="artisan@gmail.com",
        toEmails=["sophie@durand.fr"],
        direction="outbound",
    )
    assert counterparty_emails(msg, account_email="artisan@gmail.com") == {"sophie@durand.fr"}


def test_match_by_email():
    clients = [{"id": "c1", "email": "jean@martin.fr", "emails": [], "name": "Jean"}]
    msg = RemoteEmailMessage(
        sourceId="1",
        fromEmail="jean@martin.fr",
        toEmails=["me@x.com"],
        direction="inbound",
    )
    match, reason = find_client_for_email(clients, msg, account_email="me@x.com")
    assert match["id"] == "c1"
    assert reason == "email"


def test_match_by_name_fallback():
    clients = [
        {
            "id": "c2",
            "name": "Jean Martin",
            "contactName": "Jean Martin",
            "company": "Martin Plomberie",
            "emails": [],
        }
    ]
    msg = RemoteEmailMessage(
        sourceId="3",
        fromEmail="unknown@example.com",
        fromName="Jean Martin",
        toEmails=["me@x.com"],
        direction="inbound",
    )
    match, reason = find_client_for_email(clients, msg, account_email="me@x.com")
    assert match["id"] == "c2"
    assert reason == "name"


def test_suggest_high_email_medium_name_low_domain():
    from integrations.email_matching import (
        CONFIDENCE_HIGH,
        CONFIDENCE_LOW,
        CONFIDENCE_MEDIUM,
        is_suggestion_displayable,
        suggest_client_for_email,
    )

    clients = [
        {
            "id": "c1",
            "name": "Jean Martin",
            "contactName": "Jean Martin",
            "company": "Atelier Martin",
            "email": "jean@atelier-martin.fr",
            "emails": [],
        }
    ]
    exact = RemoteEmailMessage(
        sourceId="1",
        fromEmail="jean@atelier-martin.fr",
        toEmails=["me@x.com"],
        direction="inbound",
    )
    client, reason, conf = suggest_client_for_email(clients, exact, account_email="me@x.com")
    assert client["id"] == "c1"
    assert reason == "email"
    assert conf == CONFIDENCE_HIGH
    assert is_suggestion_displayable(conf)

    by_name = RemoteEmailMessage(
        sourceId="2",
        fromEmail="autre@example.com",
        fromName="Jean Martin",
        toEmails=["me@x.com"],
        direction="inbound",
    )
    client, reason, conf = suggest_client_for_email(clients, by_name, account_email="me@x.com")
    assert client["id"] == "c1"
    assert conf == CONFIDENCE_MEDIUM

    by_domain = RemoteEmailMessage(
        sourceId="3",
        fromEmail="autre@atelier-martin.fr",
        fromName="Inconnu",
        toEmails=["me@x.com"],
        direction="inbound",
    )
    client, reason, conf = suggest_client_for_email(clients, by_domain, account_email="me@x.com")
    assert conf == CONFIDENCE_LOW
    assert not is_suggestion_displayable(conf)
