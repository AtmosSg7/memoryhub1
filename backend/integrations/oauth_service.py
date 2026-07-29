"""OAuth connect / disconnect for contacts providers."""

from __future__ import annotations

import os
from typing import Optional
from urllib.parse import urlencode

from integrations import account_service
from integrations.config import google_redirect_uri, contacts_provider_mode
from integrations.constants import PROVIDER_GOOGLE_CONTACTS
from integrations.oauth_state import create_oauth_state, verify_oauth_state
from integrations.registry import get_contacts_provider


def frontend_integrations_url(*, query: Optional[dict] = None) -> str:
    base = (
        os.environ.get("FRONTEND_PUBLIC_URL")
        or os.environ.get("FRONTEND_URL")
        or "http://localhost:3000"
    ).rstrip("/")
    path = f"{base}/dashboard/integrations"
    if query:
        return f"{path}?{urlencode(query)}"
    return path


def resolve_redirect_uri() -> str:
    configured = google_redirect_uri()
    if configured:
        return configured
    # Mock / local default when GOOGLE_REDIRECT_URI is unset
    backend = (
        os.environ.get("BACKEND_PUBLIC_URL")
        or os.environ.get("PUBLIC_APP_URL")
        or "http://localhost:8000"
    ).rstrip("/")
    return f"{backend}/api/integrations/google-contacts/callback"


async def start_google_contacts_connect(db, user_id: str) -> dict:
    """Return authorize URL for the current user."""
    if contacts_provider_mode() == "google":
        from integrations.config import google_contacts_configured

        if not google_contacts_configured():
            raise ValueError("Google Contacts is not configured on this server.")

    provider = get_contacts_provider(PROVIDER_GOOGLE_CONTACTS)
    redirect_uri = resolve_redirect_uri()
    state = create_oauth_state(user_id, provider=PROVIDER_GOOGLE_CONTACTS)

    # Mock mode: bounce through our own authorize endpoint (no Google Cloud needed)
    if contacts_provider_mode() == "mock":
        backend = (
            os.environ.get("BACKEND_PUBLIC_URL")
            or os.environ.get("PUBLIC_APP_URL")
            or "http://localhost:8000"
        ).rstrip("/")
        url = f"{backend}/api/integrations/google-contacts/mock-authorize?{urlencode({'state': state})}"
        return {"authorizeUrl": url, "providerMode": "mock"}

    url = provider.build_authorize_url(state=state, redirect_uri=redirect_uri)
    return {"authorizeUrl": url, "providerMode": contacts_provider_mode()}


async def mock_authorize_redirect(state: str) -> str:
    """Complete mock OAuth by redirecting to the real callback with a fake code."""
    from integrations.providers.mock_contacts import register_mock_auth_code

    code = f"mock-code-{state[:16]}"
    register_mock_auth_code(code)
    redirect_uri = resolve_redirect_uri()
    return f"{redirect_uri}?{urlencode({'code': code, 'state': state})}"


async def handle_google_contacts_callback(
    db,
    *,
    code: Optional[str],
    state: Optional[str],
    error: Optional[str] = None,
) -> str:
    """Exchange OAuth code, persist encrypted tokens, redirect to frontend."""
    if error:
        return frontend_integrations_url(
            query={"google_contacts": "error", "reason": error[:80]}
        )
    if not code or not state:
        return frontend_integrations_url(
            query={"google_contacts": "error", "reason": "missing_code_or_state"}
        )

    try:
        body = verify_oauth_state(state, provider=PROVIDER_GOOGLE_CONTACTS)
    except ValueError:
        return frontend_integrations_url(
            query={"google_contacts": "error", "reason": "invalid_state"}
        )

    user_id = body.get("uid")
    if not user_id:
        return frontend_integrations_url(
            query={"google_contacts": "error", "reason": "invalid_state"}
        )

    provider = get_contacts_provider(PROVIDER_GOOGLE_CONTACTS)
    redirect_uri = resolve_redirect_uri()
    try:
        token_payload = await provider.exchange_code(code=code, redirect_uri=redirect_uri)
        await account_service.upsert_connected_account(
            db,
            user_id,
            provider=PROVIDER_GOOGLE_CONTACTS,
            token_payload=token_payload,
            scopes=(token_payload.get("scope") or "").split(),
        )
    except Exception:
        await account_service.mark_account_error(
            db, user_id, PROVIDER_GOOGLE_CONTACTS, "OAuth exchange failed"
        )
        return frontend_integrations_url(
            query={"google_contacts": "error", "reason": "exchange_failed"}
        )

    return frontend_integrations_url(
        query={"google_contacts": "connected"}
    )


async def disconnect_google_contacts(db, user_id: str) -> bool:
    existing = await account_service.get_account(db, user_id, PROVIDER_GOOGLE_CONTACTS)
    if not existing:
        return False

    provider = get_contacts_provider(PROVIDER_GOOGLE_CONTACTS)
    tokens = account_service.decrypted_tokens(existing)
    # Prefer refresh token for revoke; fall back to access
    revoke_token = tokens.get("refresh_token") or tokens.get("access_token")
    try:
        if revoke_token:
            await provider.revoke_token(token=revoke_token)
    except Exception:
        # Local delete still proceeds — never leave tokens after disconnect
        pass

    await account_service.disconnect_account(db, user_id, PROVIDER_GOOGLE_CONTACTS)
    return True
