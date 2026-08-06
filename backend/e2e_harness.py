"""E2E-only harness routes — disabled when deployed or ALLOW_E2E_SEED is off.

Never expose in staging/production. No secrets; uses mock Gmail only.
"""

from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user, get_db
from env_validation import IS_DEPLOYED
from integrations.constants import PROVIDER_GMAIL
from integrations.gmail_errors import GmailSyncInProgressError
from integrations.models import RemoteEmailMessage
from observability import get_logger

logger = get_logger(__name__)

e2e_router = APIRouter(prefix="/e2e", tags=["e2e"])

E2E_MARKER = "e2e_playwright_v1"


def _e2e_allowed() -> bool:
    if IS_DEPLOYED:
        return False
    if os.environ.get("ENV", "development").lower() == "production":
        return False
    return os.environ.get("ALLOW_E2E_SEED", "").lower() in {"1", "true", "yes"}


def _require_e2e() -> None:
    if not _e2e_allowed():
        raise HTTPException(status_code=404, detail={"message": "Not found."})


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SeedUnknownRequest(BaseModel):
    fromEmail: str = "alex.inconnu@e2e.example.com"
    fromName: str = "Alex Inconnu"
    subject: str = "Devis terrasse Lyon E2E"
    preview: str = "Bonjour, je souhaite un devis pour une terrasse à Lyon."
    sourceId: Optional[str] = None
    resetFirst: bool = True


class AppendReplyRequest(BaseModel):
    fromEmail: str = "alex.inconnu@e2e.example.com"
    fromName: str = "Alex Inconnu"
    subject: str = "Re: Devis terrasse Lyon E2E"
    preview: str = "Merci, je reste disponible cette semaine."
    sourceId: Optional[str] = None


class ScenarioResponse(BaseModel):
    ok: bool = True
    synced: int = 0
    communicationIds: List[str] = Field(default_factory=list)
    fromEmail: Optional[str] = None
    subject: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)


async def _ensure_gmail_connected(db, user_id: str) -> None:
    from integrations import gmail_oauth_service, gmail_sync_service
    from integrations.config import gmail_provider_mode

    if gmail_provider_mode() != "mock":
        raise HTTPException(
            status_code=400,
            detail={"message": "E2E harness requires INTEGRATIONS_GMAIL_PROVIDER=mock."},
        )

    status = await gmail_sync_service.get_gmail_status(db, user_id)
    if status.connected:
        return

    start = await gmail_oauth_service.start_gmail_connect(db, user_id)
    authorize_url = start.get("authorizeUrl") or ""
    parsed = urlparse(authorize_url)
    state = (parse_qs(parsed.query).get("state") or [None])[0]
    if not state:
        raise HTTPException(status_code=500, detail={"message": "Missing OAuth state."})

    callback_url = await gmail_oauth_service.mock_gmail_authorize_redirect(state)
    cb = urlparse(callback_url)
    qs = parse_qs(cb.query)
    code = (qs.get("code") or [None])[0]
    cb_state = (qs.get("state") or [None])[0]
    redirect = await gmail_oauth_service.handle_gmail_callback(
        db, code=code, state=cb_state, error=None
    )
    if "gmail=connected" not in (redirect or ""):
        raise HTTPException(
            status_code=500,
            detail={"message": "Gmail mock connect failed.", "redirect": redirect},
        )


async def _force_full_sync_cursor(db, user_id: str) -> None:
    """Clear Gmail history cursor so the next sync re-reads the mock mailbox."""
    await db.connected_accounts.update_one(
        {"userId": user_id, "provider": PROVIDER_GMAIL},
        {"$unset": {"historyId": "", "lastHistoryId": ""}},
    )


async def _run_sync(db, user_id: str):
    from integrations.gmail_sync_service import sync_gmail

    try:
        return await sync_gmail(db, user_id)
    except GmailSyncInProgressError as exc:
        raise HTTPException(
            status_code=409,
            detail={"message": "Gmail sync already in progress."},
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


async def _purge_user_journey_data(db, user_id: str, from_email: Optional[str] = None) -> int:
    """Remove prior E2E journey artifacts for isolation (never touches other users)."""
    removed = 0
    email_filter = (from_email or "").strip().lower()
    comm_query: Dict[str, Any] = {"userId": user_id}
    if email_filter:
        comm_query["$or"] = [
            {"metadata.fromEmail": email_filter},
            {"metadata.fromEmail": from_email},
            {"metadata.e2eMarker": E2E_MARKER},
        ]
    else:
        comm_query["metadata.e2eMarker"] = E2E_MARKER

    comm_ids = [
        doc["id"]
        async for doc in db.communications.find(comm_query, {"_id": 0, "id": 1})
    ]
    if comm_ids:
        r = await db.communications.delete_many({"userId": user_id, "id": {"$in": comm_ids}})
        removed += r.deleted_count
        await db.communication_analyses.delete_many(
            {"userId": user_id, "communicationId": {"$in": comm_ids}}
        )
        await db.actions.delete_many(
            {"userId": user_id, "communicationId": {"$in": comm_ids}}
        )
        await db.events.delete_many(
            {
                "userId": user_id,
                "$or": [
                    {"entityId": {"$in": comm_ids}},
                    {"metadata.communicationId": {"$in": comm_ids}},
                ],
            }
        )
        await db.email_messages.delete_many(
            {"userId": user_id, "providerId": {"$in": comm_ids}}
        )

    # Prospect decisions for this identity
    if email_filter:
        await db.prospect_decisions.delete_many(
            {
                "userId": user_id,
                "identityKey": f"email:{email_filter}",
            }
        )
        # Clients created during prior E2E runs for this sender
        client_ids = [
            doc["id"]
            async for doc in db.clients.find(
                {"userId": user_id, "email": email_filter},
                {"_id": 0, "id": 1},
            )
        ]
        if client_ids:
            await db.clients.delete_many({"userId": user_id, "id": {"$in": client_ids}})
            await db.actions.delete_many(
                {"userId": user_id, "clientId": {"$in": client_ids}}
            )
            await db.events.delete_many(
                {"userId": user_id, "clientId": {"$in": client_ids}}
            )
        await db.actions.delete_many(
            {
                "userId": user_id,
                "metadata.fromEmail": email_filter,
            }
        )
    await db.prospect_decisions.delete_many(
        {"userId": user_id, "metadata.e2eMarker": E2E_MARKER}
    )
    return removed


def _build_unknown_message(body: SeedUnknownRequest) -> RemoteEmailMessage:
    source_id = body.sourceId or f"e2e-unk-{uuid.uuid4().hex[:12]}"
    return RemoteEmailMessage(
        sourceId=source_id,
        threadId=f"thread-{source_id}",
        subject=body.subject,
        snippet=body.preview,
        fromEmail=body.fromEmail,
        fromName=body.fromName,
        toEmails=["artisan@gmail.com"],
        direction="inbound",
        sentAt=_now(),
        webLink=f"https://mail.google.com/mail/u/0/#inbox/{source_id}",
        attachments=[],
    )


def _build_reply_message(body: AppendReplyRequest) -> RemoteEmailMessage:
    source_id = body.sourceId or f"e2e-reply-{uuid.uuid4().hex[:12]}"
    return RemoteEmailMessage(
        sourceId=source_id,
        threadId=f"thread-{re.sub(r'[^a-z0-9]+', '-', body.fromEmail.lower())}",
        subject=body.subject,
        snippet=body.preview,
        fromEmail=body.fromEmail,
        fromName=body.fromName,
        toEmails=["artisan@gmail.com"],
        direction="inbound",
        sentAt=_now(),
        webLink=f"https://mail.google.com/mail/u/0/#inbox/{source_id}",
        attachments=[],
    )


@e2e_router.get("/health")
async def e2e_health():
    _require_e2e()
    return {
        "ok": True,
        "allowE2eSeed": True,
        "gmailProvider": os.environ.get("INTEGRATIONS_GMAIL_PROVIDER", "mock"),
        "ciEnabled": os.environ.get("COMMUNICATION_INTELLIGENCE_ENABLED", "false"),
    }


@e2e_router.post("/scenario/seed-unknown", response_model=ScenarioResponse)
async def e2e_seed_unknown(
    body: SeedUnknownRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Reset mock mailbox to a single unknown inbound email, connect Gmail, sync."""
    _require_e2e()
    from integrations.providers.mock_gmail import reset_mock_gmail, seed_mock_gmail

    user_id = current_user["id"]
    if body.resetFirst:
        await _purge_user_journey_data(db, user_id, body.fromEmail)

    reset_mock_gmail()
    msg = _build_unknown_message(body)
    seed_mock_gmail([msg])

    await _ensure_gmail_connected(db, user_id)
    await _force_full_sync_cursor(db, user_id)
    sync = await _run_sync(db, user_id)

    # Tag synced communications for cleanup
    await db.communications.update_many(
        {
            "userId": user_id,
            "metadata.fromEmail": body.fromEmail.lower(),
            "providerId": msg.sourceId,
        },
        {"$set": {"metadata.e2eMarker": E2E_MARKER}},
    )
    # Also match case variants
    await db.communications.update_many(
        {"userId": user_id, "providerId": msg.sourceId},
        {"$set": {"metadata.e2eMarker": E2E_MARKER}},
    )

    comm_ids = [
        doc["id"]
        async for doc in db.communications.find(
            {"userId": user_id, "providerId": msg.sourceId},
            {"_id": 0, "id": 1},
        )
    ]

    return ScenarioResponse(
        synced=int(getattr(sync.summary, "created", 0) or 0)
        + int(getattr(sync.summary, "enriched", 0) or 0),
        communicationIds=comm_ids,
        fromEmail=body.fromEmail.lower(),
        subject=body.subject,
        details={"sourceId": msg.sourceId, "summary": sync.summary.model_dump()},
    )


@e2e_router.post("/scenario/append-reply", response_model=ScenarioResponse)
async def e2e_append_reply(
    body: AppendReplyRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Append a new inbound reply from the same sender and sync incrementally."""
    _require_e2e()
    from integrations.providers.mock_gmail import append_mock_gmail_message

    user_id = current_user["id"]
    await _ensure_gmail_connected(db, user_id)
    msg = _build_reply_message(body)
    append_mock_gmail_message(msg)
    sync = await _run_sync(db, user_id)

    await db.communications.update_many(
        {"userId": user_id, "providerId": msg.sourceId},
        {"$set": {"metadata.e2eMarker": E2E_MARKER}},
    )
    comm_ids = [
        doc["id"]
        async for doc in db.communications.find(
            {"userId": user_id, "providerId": msg.sourceId},
            {"_id": 0, "id": 1},
        )
    ]
    client_id = None
    if comm_ids:
        row = await db.communications.find_one({"id": comm_ids[0]}, {"_id": 0, "clientId": 1})
        client_id = (row or {}).get("clientId")

    return ScenarioResponse(
        synced=int(getattr(sync.summary, "created", 0) or 0),
        communicationIds=comm_ids,
        fromEmail=body.fromEmail.lower(),
        subject=body.subject,
        details={
            "sourceId": msg.sourceId,
            "clientId": client_id,
            "summary": sync.summary.model_dump(),
        },
    )


@e2e_router.post("/scenario/sync", response_model=ScenarioResponse)
async def e2e_sync_again(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Re-run Gmail sync (idempotence checks)."""
    _require_e2e()
    await _ensure_gmail_connected(db, current_user["id"])
    sync = await _run_sync(db, current_user["id"])
    return ScenarioResponse(
        synced=int(getattr(sync.summary, "created", 0) or 0),
        details={"summary": sync.summary.model_dump()},
    )


@e2e_router.post("/scenario/reset", response_model=ScenarioResponse)
async def e2e_reset(
    body: SeedUnknownRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Purge journey data for the given unknown sender (isolation)."""
    _require_e2e()
    from integrations.providers.mock_gmail import reset_mock_gmail

    removed = await _purge_user_journey_data(db, current_user["id"], body.fromEmail)
    reset_mock_gmail()
    return ScenarioResponse(ok=True, details={"removedCommunications": removed})
