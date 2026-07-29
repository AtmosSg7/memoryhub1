"""Google Contacts sync orchestration (Google → MemoryHub only)."""

from __future__ import annotations

from typing import Optional, Tuple

from integrations import account_service
from integrations.constants import ACCOUNT_STATUS_CONNECTED, PROVIDER_GOOGLE_CONTACTS
from integrations.import_service import import_remote_contacts
from integrations.models import (
    GoogleContactsPreviewResponse,
    GoogleContactsSyncResponse,
    SyncSummary,
)
from integrations.registry import get_contacts_provider


async def preview_google_contacts(db, user_id: str) -> GoogleContactsPreviewResponse:
    account = await account_service.get_account(db, user_id, PROVIDER_GOOGLE_CONTACTS)
    if not account or account.get("status") != ACCOUNT_STATUS_CONNECTED:
        return GoogleContactsPreviewResponse(connected=False, contactCount=0)

    provider = get_contacts_provider(PROVIDER_GOOGLE_CONTACTS)
    access = await account_service.ensure_fresh_access_token(db, user_id, provider, account)
    count = await provider.count_contacts(access_token=access)
    return GoogleContactsPreviewResponse(
        connected=True,
        contactCount=count,
        accountEmail=account.get("accountEmail"),
    )


async def sync_google_contacts(db, user_id: str) -> GoogleContactsSyncResponse:
    """Manual sync / import: pull remote contacts and merge into MemoryHub clients."""
    account = await account_service.get_account(db, user_id, PROVIDER_GOOGLE_CONTACTS)
    if not account or account.get("status") != ACCOUNT_STATUS_CONNECTED:
        raise ValueError("Google Contacts is not connected.")

    provider = get_contacts_provider(PROVIDER_GOOGLE_CONTACTS)
    try:
        access = await account_service.ensure_fresh_access_token(db, user_id, provider, account)
        contacts = await provider.list_contacts(access_token=access)
        summary, _results = await import_remote_contacts(db, user_id, contacts)
        updated = await account_service.save_sync_summary(
            db, user_id, PROVIDER_GOOGLE_CONTACTS, summary
        )
        return GoogleContactsSyncResponse(
            summary=summary,
            account=account_service.account_public(updated),
        )
    except Exception as exc:
        await account_service.mark_account_error(db, user_id, PROVIDER_GOOGLE_CONTACTS, str(exc))
        raise


async def get_status(db, user_id: str):
    from integrations.config import contacts_provider_mode, google_contacts_configured
    from integrations.models import GoogleContactsStatusResponse, SyncSummary

    account = await account_service.get_account(db, user_id, PROVIDER_GOOGLE_CONTACTS)
    last_sync = None
    if account and account.get("lastSyncSummary"):
        last_sync = SyncSummary(**account["lastSyncSummary"])
    connected = bool(account and account.get("status") == ACCOUNT_STATUS_CONNECTED)
    return GoogleContactsStatusResponse(
        configured=google_contacts_configured() or contacts_provider_mode() == "mock",
        providerMode=contacts_provider_mode(),
        connected=connected,
        account=account_service.account_public(account) if account and connected else None,
        lastSync=last_sync,
    )
