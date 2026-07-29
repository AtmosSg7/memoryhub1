"""Shared Google OAuth helpers (Contacts / Gmail / future Google products)."""

from __future__ import annotations

from typing import List, Optional
from urllib.parse import urlencode

import httpx

from integrations.config import google_client_id, google_client_secret

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def build_google_authorize_url(
    *,
    state: str,
    redirect_uri: str,
    scopes: List[str],
) -> str:
    params = {
        "client_id": google_client_id(),
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(scopes),
        "state": state,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_google_code(*, code: str, redirect_uri: str, default_scope: str = "") -> dict:
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
        "scope": token_data.get("scope") or default_scope,
        "account_email": profile.get("email"),
        "account_name": profile.get("name"),
        "account_id": profile.get("sub"),
    }


async def refresh_google_access_token(*, refresh_token: str) -> dict:
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


async def revoke_google_token(*, token: Optional[str]) -> None:
    if not token:
        return
    async with httpx.AsyncClient(timeout=15.0) as client:
        await client.post(GOOGLE_REVOKE_URL, params={"token": token})
