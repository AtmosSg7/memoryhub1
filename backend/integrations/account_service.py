"""Persistence for connected integration accounts."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from integrations.constants import (
    ACCOUNT_STATUS_CONNECTED,
    ACCOUNT_STATUS_DISCONNECTED,
    PROVIDER_GOOGLE_CONTACTS,
    TOKEN_REFRESH_SKEW_SECONDS,
)
from integrations.models import ConnectedAccountPublic, SyncSummary
from integrations.secrets import decrypt_secret, encrypt_secret

ACCOUNT_PROJECTION = {"_id": 0}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_now_iso() -> str:
    return _utc_now().isoformat()


def account_public(doc: dict) -> ConnectedAccountPublic:
    return ConnectedAccountPublic(
        id=doc["id"],
        provider=doc.get("provider") or PROVIDER_GOOGLE_CONTACTS,
        status=doc.get("status") or ACCOUNT_STATUS_DISCONNECTED,
        accountEmail=doc.get("accountEmail"),
        accountName=doc.get("accountName"),
        scopes=list(doc.get("scopes") or []),
        connectedAt=doc.get("connectedAt"),
        lastSyncedAt=doc.get("lastSyncedAt"),
        lastError=doc.get("lastError"),
    )


async def get_account(db, user_id: str, provider: str = PROVIDER_GOOGLE_CONTACTS) -> Optional[dict]:
    return await db.connected_accounts.find_one(
        {"userId": user_id, "provider": provider},
        ACCOUNT_PROJECTION,
    )


async def upsert_connected_account(
    db,
    user_id: str,
    *,
    provider: str,
    token_payload: dict,
    scopes: Optional[List[str]] = None,
) -> dict:
    now = _utc_now()
    expires_in = int(token_payload.get("expires_in") or 3600)
    expires_at = (now + timedelta(seconds=max(60, expires_in))).isoformat()
    existing = await get_account(db, user_id, provider)

    access_enc = encrypt_secret(token_payload.get("access_token"))
    refresh_raw = token_payload.get("refresh_token")
    refresh_enc = (
        encrypt_secret(refresh_raw)
        if refresh_raw
        else (existing or {}).get("refreshTokenEnc")
    )

    new_email = (token_payload.get("account_email") or "").strip().lower() or None
    new_account_id = (token_payload.get("account_id") or "").strip() or None
    prev_email = ((existing or {}).get("accountEmail") or "").strip().lower() or None
    prev_account_id = ((existing or {}).get("accountId") or "").strip() or None

    # Same Gmail mailbox → keep incremental cursor. Different mailbox → reset.
    # accountId is authoritative when both sides have it (email alone is not enough:
    # reconnecting a different Google identity must never reuse another mailbox's cursor).
    if not existing:
        same_mailbox = False
    elif new_account_id and prev_account_id:
        same_mailbox = new_account_id == prev_account_id
    elif new_email and prev_email:
        same_mailbox = new_email == prev_email
    else:
        same_mailbox = False

    doc = {
        "id": (existing or {}).get("id") or str(uuid.uuid4()),
        "userId": user_id,
        "provider": provider,
        "status": ACCOUNT_STATUS_CONNECTED,
        "accountEmail": new_email or (existing or {}).get("accountEmail"),
        "accountName": token_payload.get("account_name") or (existing or {}).get("accountName"),
        "accountId": new_account_id or (existing or {}).get("accountId"),
        "scopes": scopes or (token_payload.get("scope") or "").split() or (existing or {}).get("scopes") or [],
        "accessTokenEnc": access_enc,
        "refreshTokenEnc": refresh_enc,
        "tokenExpiresAt": expires_at,
        "connectedAt": (existing or {}).get("connectedAt") or now.isoformat(),
        "updatedAt": now.isoformat(),
        "lastSyncedAt": (existing or {}).get("lastSyncedAt") if same_mailbox else None,
        "lastSyncSummary": (existing or {}).get("lastSyncSummary") if same_mailbox else None,
        "lastError": None,
        # Gmail incremental cursor (never reuse across different mailboxes)
        "historyId": (existing or {}).get("historyId") if same_mailbox else None,
        "lastSuccessfulSyncAt": (existing or {}).get("lastSuccessfulSyncAt") if same_mailbox else None,
        "lastFullSyncAt": (existing or {}).get("lastFullSyncAt") if same_mailbox else None,
        "syncState": (existing or {}).get("syncState") if same_mailbox else None,
        "lastSyncError": None,
        "lastSyncAttemptAt": (existing or {}).get("lastSyncAttemptAt") if same_mailbox else None,
        "consecutiveSyncErrors": (
            int((existing or {}).get("consecutiveSyncErrors") or 0) if same_mailbox else 0
        ),
        "nextSyncAt": (existing or {}).get("nextSyncAt") if same_mailbox else None,
    }

    await db.connected_accounts.update_one(
        {"userId": user_id, "provider": provider},
        {"$set": doc},
        upsert=True,
    )
    return doc


async def save_sync_summary(db, user_id: str, provider: str, summary: SyncSummary) -> dict:
    now = _utc_now_iso()
    payload = summary.model_dump()
    payload["finishedAt"] = payload.get("finishedAt") or now
    await db.connected_accounts.update_one(
        {"userId": user_id, "provider": provider},
        {
            "$set": {
                "lastSyncedAt": payload["finishedAt"],
                "lastSyncSummary": payload,
                "updatedAt": now,
                "lastError": None,
            }
        },
    )
    account = await get_account(db, user_id, provider)
    return account or {}


async def mark_account_error(db, user_id: str, provider: str, message: str) -> None:
    await db.connected_accounts.update_one(
        {"userId": user_id, "provider": provider},
        {
            "$set": {
                "status": "error",
                "lastError": (message or "")[:500],
                "updatedAt": _utc_now_iso(),
            }
        },
    )


async def disconnect_account(db, user_id: str, provider: str = PROVIDER_GOOGLE_CONTACTS) -> Optional[dict]:
    existing = await get_account(db, user_id, provider)
    if not existing:
        return None
    await db.connected_accounts.delete_one({"userId": user_id, "provider": provider})
    return existing


def decrypted_tokens(doc: dict) -> Dict[str, Optional[str]]:
    return {
        "access_token": decrypt_secret(doc.get("accessTokenEnc")),
        "refresh_token": decrypt_secret(doc.get("refreshTokenEnc")),
    }


def access_token_expired(doc: dict) -> bool:
    expires_at = doc.get("tokenExpiresAt")
    if not expires_at:
        return True
    try:
        dt = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt <= _utc_now() + timedelta(seconds=TOKEN_REFRESH_SKEW_SECONDS)
    except ValueError:
        return True


async def ensure_fresh_access_token(db, user_id: str, provider, account: dict) -> str:
    tokens = decrypted_tokens(account)
    access = tokens.get("access_token")
    if access and not access_token_expired(account):
        return access

    refresh = tokens.get("refresh_token")
    if not refresh:
        raise ValueError("Google connection expired. Please reconnect.")

    refreshed = await provider.refresh_access_token(refresh_token=refresh)
    updated = await upsert_connected_account(
        db,
        user_id,
        provider=account.get("provider") or PROVIDER_GOOGLE_CONTACTS,
        token_payload={
            **refreshed,
            "account_email": account.get("accountEmail"),
            "account_name": account.get("accountName"),
            "account_id": account.get("accountId"),
        },
        scopes=account.get("scopes"),
    )
    return decrypt_secret(updated.get("accessTokenEnc")) or ""
