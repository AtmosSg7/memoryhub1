"""HTTP routes for contacts integrations (Google Contacts v1)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse

from auth import get_current_user, get_db
from integrations import oauth_service, sync_service
from integrations.models import (
    GoogleContactsPreviewResponse,
    GoogleContactsStatusResponse,
    GoogleContactsSyncResponse,
)
from observability import get_logger

logger = get_logger(__name__)

integrations_router = APIRouter(prefix="/integrations", tags=["integrations"])


@integrations_router.get("/google-contacts/status", response_model=GoogleContactsStatusResponse)
async def google_contacts_status(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await sync_service.get_status(db, current_user["id"])


@integrations_router.post("/google-contacts/connect")
async def google_contacts_connect(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        return await oauth_service.start_google_contacts_connect(db, current_user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


@integrations_router.get("/google-contacts/mock-authorize")
async def google_contacts_mock_authorize(
    state: str = Query(...),
):
    """Dev/test only — simulates Google consent when INTEGRATIONS_CONTACTS_PROVIDER=mock."""
    from integrations.config import contacts_provider_mode
    from security_config import IS_DEPLOYED

    if IS_DEPLOYED or contacts_provider_mode() != "mock":
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        redirect_url = await oauth_service.mock_authorize_redirect(state)
    except Exception as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc
    return RedirectResponse(url=redirect_url, status_code=302)


@integrations_router.get("/google-contacts/callback")
async def google_contacts_callback(
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    db=Depends(get_db),
):
    """OAuth redirect URI — no auth cookie required; state binds the user."""
    redirect_url = await oauth_service.handle_google_contacts_callback(
        db, code=code, state=state, error=error
    )
    return RedirectResponse(url=redirect_url, status_code=302)


@integrations_router.get(
    "/google-contacts/preview",
    response_model=GoogleContactsPreviewResponse,
)
async def google_contacts_preview(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        return await sync_service.preview_google_contacts(db, current_user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc
    except Exception:
        logger.exception("Google Contacts preview failed")
        raise HTTPException(
            status_code=502,
            detail={"message": "Unable to reach Google Contacts."},
        )


@integrations_router.post(
    "/google-contacts/import",
    response_model=GoogleContactsSyncResponse,
)
async def google_contacts_import(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Initial import after confirmation (same engine as sync)."""
    try:
        return await sync_service.sync_google_contacts(db, current_user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc
    except Exception:
        logger.exception("Google Contacts import failed")
        raise HTTPException(
            status_code=502,
            detail={"message": "Import failed. Please try again."},
        )


@integrations_router.post(
    "/google-contacts/sync",
    response_model=GoogleContactsSyncResponse,
)
async def google_contacts_sync(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        return await sync_service.sync_google_contacts(db, current_user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc
    except Exception:
        logger.exception("Google Contacts sync failed")
        raise HTTPException(
            status_code=502,
            detail={"message": "Sync failed. Please try again."},
        )


@integrations_router.post("/google-contacts/disconnect")
async def google_contacts_disconnect(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    removed = await oauth_service.disconnect_google_contacts(db, current_user["id"])
    return {"disconnected": removed}


# --- Gmail (read-only inbox) ---

from integrations import gmail_oauth_service, gmail_sync_service
from integrations.models import (
    ClientEmailsResponse,
    GmailPreviewResponse,
    GmailStatusResponse,
    GmailSyncResponse,
)


@integrations_router.get("/gmail/status", response_model=GmailStatusResponse)
async def gmail_status(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await gmail_sync_service.get_gmail_status(db, current_user["id"])


@integrations_router.post("/gmail/connect")
async def gmail_connect(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        return await gmail_oauth_service.start_gmail_connect(db, current_user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


@integrations_router.get("/gmail/mock-authorize")
async def gmail_mock_authorize(state: str = Query(...)):
    from integrations.config import gmail_provider_mode
    from security_config import IS_DEPLOYED

    if IS_DEPLOYED or gmail_provider_mode() != "mock":
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    try:
        redirect_url = await gmail_oauth_service.mock_gmail_authorize_redirect(state)
    except Exception as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc
    return RedirectResponse(url=redirect_url, status_code=302)


@integrations_router.get("/gmail/callback")
async def gmail_callback(
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    db=Depends(get_db),
):
    redirect_url = await gmail_oauth_service.handle_gmail_callback(
        db, code=code, state=state, error=error
    )
    return RedirectResponse(url=redirect_url, status_code=302)


@integrations_router.get("/gmail/preview", response_model=GmailPreviewResponse)
async def gmail_preview(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        return await gmail_sync_service.preview_gmail(db, current_user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc
    except Exception:
        logger.exception("Gmail preview failed")
        raise HTTPException(
            status_code=502,
            detail={"message": "Unable to reach Gmail."},
        )


@integrations_router.post("/gmail/sync", response_model=GmailSyncResponse)
async def gmail_sync(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    from integrations.gmail_errors import GmailSyncInProgressError

    try:
        return await gmail_sync_service.sync_gmail(db, current_user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc
    except GmailSyncInProgressError as exc:
        raise HTTPException(status_code=409, detail={"message": str(exc)}) from exc
    except Exception:
        logger.exception("Gmail sync failed")
        raise HTTPException(
            status_code=502,
            detail={"message": "Gmail sync failed. Please try again."},
        )


@integrations_router.post("/gmail/disconnect")
async def gmail_disconnect(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    removed = await gmail_oauth_service.disconnect_gmail(db, current_user["id"])
    return {"disconnected": removed}


@integrations_router.get(
    "/gmail/clients/{client_id}/emails",
    response_model=ClientEmailsResponse,
)
async def gmail_client_emails(
    client_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
):
    client = await db.clients.find_one(
        {"userId": current_user["id"], "id": client_id},
        {"_id": 0, "id": 1},
    )
    if not client:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})
    return await gmail_sync_service.list_client_emails(
        db, current_user["id"], client_id, limit=limit
    )
