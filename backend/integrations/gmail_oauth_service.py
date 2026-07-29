"""Gmail OAuth connect / disconnect (reuses connected_accounts)."""

from __future__ import annotations

import os
from typing import Optional
from urllib.parse import urlencode

from integrations import account_service
from integrations.config import (
    gmail_configured,
    gmail_provider_mode,
    google_gmail_redirect_uri,
    google_redirect_uri,
)
from integrations.constants import PROVIDER_GMAIL
from integrations.oauth_service import frontend_integrations_url
from integrations.oauth_state import create_oauth_state, verify_oauth_state
from integrations.registry import get_email_provider


def resolve_gmail_redirect_uri() -> str:
    configured = google_gmail_redirect_uri()
    if configured:
        return configured
    # Prefer dedicated path; fall back only when shared GOOGLE_REDIRECT_URI is unset.
    backend = (
        os.environ.get("BACKEND_PUBLIC_URL")
        or os.environ.get("PUBLIC_APP_URL")
        or "http://localhost:8000"
    ).rstrip("/")
    if google_redirect_uri() and "/gmail/" in google_redirect_uri():
        return google_redirect_uri()
    return f"{backend}/api/integrations/gmail/callback"


async def start_gmail_connect(db, user_id: str) -> dict:
    if gmail_provider_mode() == "google" and not gmail_configured():
        raise ValueError("Gmail is not configured on this server.")

    provider = get_email_provider(PROVIDER_GMAIL)
    redirect_uri = resolve_gmail_redirect_uri()
    state = create_oauth_state(user_id, provider=PROVIDER_GMAIL)

    if gmail_provider_mode() == "mock":
        backend = (
            os.environ.get("BACKEND_PUBLIC_URL")
            or os.environ.get("PUBLIC_APP_URL")
            or "http://localhost:8000"
        ).rstrip("/")
        url = f"{backend}/api/integrations/gmail/mock-authorize?{urlencode({'state': state})}"
        return {"authorizeUrl": url, "providerMode": "mock"}

    url = provider.build_authorize_url(state=state, redirect_uri=redirect_uri)
    return {"authorizeUrl": url, "providerMode": gmail_provider_mode()}


async def mock_gmail_authorize_redirect(state: str) -> str:
    from integrations.providers.mock_gmail import register_mock_gmail_auth_code

    code = f"mock-gmail-code-{state[:16]}"
    register_mock_gmail_auth_code(code)
    redirect_uri = resolve_gmail_redirect_uri()
    return f"{redirect_uri}?{urlencode({'code': code, 'state': state})}"


async def handle_gmail_callback(
    db,
    *,
    code: Optional[str],
    state: Optional[str],
    error: Optional[str] = None,
) -> str:
    if error:
        return frontend_integrations_url(query={"gmail": "error", "reason": error[:80]})
    if not code or not state:
        return frontend_integrations_url(
            query={"gmail": "error", "reason": "missing_code_or_state"}
        )

    try:
        body = verify_oauth_state(state, provider=PROVIDER_GMAIL)
    except ValueError:
        return frontend_integrations_url(query={"gmail": "error", "reason": "invalid_state"})

    user_id = body.get("uid")
    if not user_id:
        return frontend_integrations_url(query={"gmail": "error", "reason": "invalid_state"})

    provider = get_email_provider(PROVIDER_GMAIL)
    redirect_uri = resolve_gmail_redirect_uri()
    try:
        token_payload = await provider.exchange_code(code=code, redirect_uri=redirect_uri)
        await account_service.upsert_connected_account(
            db,
            user_id,
            provider=PROVIDER_GMAIL,
            token_payload=token_payload,
            scopes=(token_payload.get("scope") or "").split(),
        )
    except Exception:
        await account_service.mark_account_error(db, user_id, PROVIDER_GMAIL, "OAuth exchange failed")
        return frontend_integrations_url(query={"gmail": "error", "reason": "exchange_failed"})

    return frontend_integrations_url(query={"gmail": "connected"})


async def disconnect_gmail(db, user_id: str) -> bool:
    existing = await account_service.get_account(db, user_id, PROVIDER_GMAIL)
    if not existing:
        return False

    provider = get_email_provider(PROVIDER_GMAIL)
    tokens = account_service.decrypted_tokens(existing)
    revoke_token = tokens.get("refresh_token") or tokens.get("access_token")
    try:
        if revoke_token:
            await provider.revoke_token(token=revoke_token)
    except Exception:
        pass

    await account_service.disconnect_account(db, user_id, PROVIDER_GMAIL)
    return True
