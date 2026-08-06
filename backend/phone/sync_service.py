"""Phone Hub status / connect / sync / disconnect orchestration."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from integrations import account_service
from phone.config import phone_configured, phone_provider_mode, phone_sync_max_calls
from phone.constants import (
    ACCOUNT_STATUS_CONNECTED,
    PHONE_CARRIER_VENDORS,
    PHONE_MODE_MANUAL,
    PHONE_SYNC_STATE_ERROR,
    PHONE_SYNC_STATE_IDLE,
    PHONE_SYNC_STATE_RUNNING,
    PHONE_VENDORS,
    PROVIDER_PHONE,
)
from phone.models import (
    PhoneAccountPublic,
    PhoneConnectResponse,
    PhoneLastCallPublic,
    PhoneMailboxStats,
    PhonePreviewResponse,
    PhoneStatusResponse,
    PhoneSyncResponse,
    PhoneSyncSummary,
)
from phone.registry import get_phone_provider
from phone.sync import DefaultPhoneSync


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _account_public(doc: dict, *, vendor: str) -> PhoneAccountPublic:
    return PhoneAccountPublic(
        id=doc["id"],
        provider=PROVIDER_PHONE,
        vendor=doc.get("vendor") or vendor,
        status=doc.get("status") or "disconnected",
        accountName=doc.get("accountName"),
        accountEmail=doc.get("accountEmail"),
        connectedAt=doc.get("connectedAt"),
        lastSyncedAt=doc.get("lastSyncedAt"),
        syncState=doc.get("syncState") or PHONE_SYNC_STATE_IDLE,
        lastError=doc.get("lastError"),
    )


async def _phone_stats(db, user_id: str) -> PhoneMailboxStats:
    base = {"userId": user_id, "type": "phone", "provider": PROVIDER_PHONE}
    total = int(await db.communications.count_documents(base))
    linked = int(
        await db.communications.count_documents(
            {**base, "clientId": {"$type": "string", "$ne": ""}}
        )
    )
    missed = int(
        await db.communications.count_documents(
            {
                **base,
                "$or": [
                    {"metadata.status": "missed"},
                    {"metadata.missed": True},
                ],
            }
        )
    )
    return PhoneMailboxStats(
        linked=linked,
        unmatched=max(0, total - linked),
        total=total,
        missed=missed,
    )


async def _last_call(db, user_id: str) -> Optional[PhoneLastCallPublic]:
    doc = await db.communications.find_one(
        {"userId": user_id, "type": "phone", "provider": PROVIDER_PHONE},
        {"_id": 0},
        sort=[("createdAt", -1)],
    )
    if not doc:
        return None
    meta = doc.get("metadata") or {}
    return PhoneLastCallPublic(
        providerCallId=doc.get("providerId"),
        phoneNumber=meta.get("phoneNumber") or meta.get("fromPhone") or meta.get("toPhone"),
        direction=doc.get("direction") or meta.get("callDirection"),
        status=meta.get("status"),
        startedAt=meta.get("startedAt") or doc.get("createdAt"),
        clientId=doc.get("clientId"),
    )


async def get_phone_status(db, user_id: str) -> PhoneStatusResponse:
    mode = phone_provider_mode()
    account = await account_service.get_account(db, user_id, PROVIDER_PHONE)
    connected = bool(account and account.get("status") == ACCOUNT_STATUS_CONNECTED)
    syncing = bool(account and account.get("syncState") == PHONE_SYNC_STATE_RUNNING)
    last_sync = None
    if account and account.get("lastSyncSummary"):
        raw = account["lastSyncSummary"]
        last_sync = PhoneSyncSummary(**raw) if isinstance(raw, dict) else None

    # Product UI uses mode=manual_journal + carrierConnected=false (no live operator).
    # ``connected`` still reflects mock/dev sync accounts for the V1 harness.
    return PhoneStatusResponse(
        configured=True,
        providerMode=mode,
        mode=PHONE_MODE_MANUAL,
        connected=connected,
        carrierConnected=False,
        syncing=syncing,
        account=_account_public(account, vendor=mode) if account else None,
        lastSync=last_sync,
        lastCall=await _last_call(db, user_id),
        stats=await _phone_stats(db, user_id),
        availableVendors=list(PHONE_VENDORS),
        comingSoonVendors=list(PHONE_CARRIER_VENDORS),
    )


async def connect_phone(db, user_id: str) -> PhoneConnectResponse:
    provider = get_phone_provider()
    if not provider.is_ready():
        raise ValueError(
            f"{provider.display_name} is not ready. "
            "Use INTEGRATIONS_PHONE_PROVIDER=mock or configure a vendor."
        )
    token_payload = await provider.connect(user_id=user_id)
    account = await account_service.upsert_connected_account(
        db,
        user_id,
        provider=PROVIDER_PHONE,
        token_payload=token_payload,
        scopes=["phone.read"],
    )
    await db.connected_accounts.update_one(
        {"userId": user_id, "provider": PROVIDER_PHONE},
        {
            "$set": {
                "vendor": provider.vendor_id,
                "syncState": PHONE_SYNC_STATE_IDLE,
                "lastError": None,
            }
        },
    )
    account = await account_service.get_account(db, user_id, PROVIDER_PHONE)
    return PhoneConnectResponse(
        connected=True,
        account=_account_public(account, vendor=provider.vendor_id),
        providerMode=provider.vendor_id,
        message="Phone connected (architecture mode — no live carrier).",
    )


async def disconnect_phone(db, user_id: str) -> dict:
    account = await account_service.get_account(db, user_id, PROVIDER_PHONE)
    if account:
        provider = get_phone_provider(account.get("vendor"))
        try:
            await provider.disconnect(access_token=None)
        except Exception:
            pass
    await account_service.disconnect_account(db, user_id, PROVIDER_PHONE)
    return {"disconnected": True}


async def preview_phone(db, user_id: str) -> PhonePreviewResponse:
    account = await account_service.get_account(db, user_id, PROVIDER_PHONE)
    if not account or account.get("status") != ACCOUNT_STATUS_CONNECTED:
        raise ValueError("Phone is not connected.")
    provider = get_phone_provider(account.get("vendor"))
    count = await provider.count_calls(access_token=None)
    return PhonePreviewResponse(
        connected=True,
        callCount=count,
        accountName=account.get("accountName"),
    )


async def sync_phone(db, user_id: str) -> PhoneSyncResponse:
    account = await account_service.get_account(db, user_id, PROVIDER_PHONE)
    if not account or account.get("status") != ACCOUNT_STATUS_CONNECTED:
        raise ValueError("Phone is not connected.")
    if account.get("syncState") == PHONE_SYNC_STATE_RUNNING:
        raise ValueError("Phone sync already in progress.")

    provider = get_phone_provider(account.get("vendor"))
    if not provider.is_ready():
        raise ValueError(f"{provider.display_name} sync is not ready.")

    await db.connected_accounts.update_one(
        {"userId": user_id, "provider": PROVIDER_PHONE},
        {"$set": {"syncState": PHONE_SYNC_STATE_RUNNING, "lastError": None}},
    )
    try:
        summary = await DefaultPhoneSync().sync_user(
            db,
            user_id,
            provider=provider,
            connected_account_id=account["id"],
            access_token=None,
            max_results=phone_sync_max_calls(),
        )
        summary_dict = summary.model_dump()
        await db.connected_accounts.update_one(
            {"userId": user_id, "provider": PROVIDER_PHONE},
            {
                "$set": {
                    "syncState": PHONE_SYNC_STATE_IDLE,
                    "lastSyncedAt": _utc_now_iso(),
                    "lastSyncSummary": summary_dict,
                    "lastError": None,
                    "status": ACCOUNT_STATUS_CONNECTED,
                }
            },
        )
    except Exception as exc:
        await db.connected_accounts.update_one(
            {"userId": user_id, "provider": PROVIDER_PHONE},
            {
                "$set": {
                    "syncState": PHONE_SYNC_STATE_ERROR,
                    "lastError": str(exc)[:500],
                }
            },
        )
        raise

    account = await account_service.get_account(db, user_id, PROVIDER_PHONE)
    return PhoneSyncResponse(
        summary=summary,
        account=_account_public(account, vendor=provider.vendor_id),
    )
