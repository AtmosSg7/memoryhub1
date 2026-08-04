"""Integration config — provider mode detection from environment."""

from __future__ import annotations

import pytest

from integrations.config import (
    contacts_provider_mode,
    gmail_configured,
    gmail_provider_mode,
    google_contacts_configured,
)


@pytest.fixture(autouse=True)
def _clear_google_env(monkeypatch):
    for name in (
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REDIRECT_URI",
        "GOOGLE_GMAIL_REDIRECT_URI",
        "INTEGRATIONS_CONTACTS_PROVIDER",
        "INTEGRATIONS_GMAIL_PROVIDER",
    ):
        monkeypatch.delenv(name, raising=False)


def test_contacts_mock_without_credentials():
    assert google_contacts_configured() is False
    assert contacts_provider_mode() == "mock"


def test_contacts_google_with_full_credentials(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/api/integrations/google-contacts/callback",
    )
    assert google_contacts_configured() is True
    assert contacts_provider_mode() == "google"


def test_gmail_mock_without_credentials():
    assert gmail_configured() is False
    assert gmail_provider_mode() == "mock"


def test_gmail_google_with_full_credentials(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv(
        "GOOGLE_GMAIL_REDIRECT_URI",
        "http://localhost:8000/api/integrations/gmail/callback",
    )
    assert gmail_configured() is True
    assert gmail_provider_mode() == "google"


def test_gmail_google_with_shared_contacts_redirect(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/api/integrations/google-contacts/callback",
    )
    assert gmail_configured() is True
    assert gmail_provider_mode() == "google"


def test_explicit_mock_overrides_credentials(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/api/integrations/google-contacts/callback",
    )
    monkeypatch.setenv("INTEGRATIONS_CONTACTS_PROVIDER", "mock")
    assert contacts_provider_mode() == "mock"


def test_partial_credentials_not_configured(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "only-id")
    assert google_contacts_configured() is False
    assert contacts_provider_mode() == "mock"
