"""Phone Hub V2 — quick manual call entry into Communications."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional

from phone.constants import VENDOR_MANUAL
from phone.conversation_service import PhoneConversationService
from phone.models import ManualCallCreateRequest, ManualCallCreateResponse, RemoteCall
from phone.normalizer import PhoneNormalizer


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _manual_provider_call_id(
    *,
    normalized: str,
    started_at: str,
    direction: str,
    status: str,
    duration: Optional[int],
) -> str:
    raw = f"{normalized}|{started_at}|{direction}|{status}|{duration or 0}|{uuid.uuid4().hex[:8]}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"manual:{digest}"


async def create_manual_call(
    db,
    user_id: str,
    body: ManualCallCreateRequest,
) -> ManualCallCreateResponse:
    normalizer = PhoneNormalizer()
    identity = normalizer.identity(body.phoneNumber)
    if not identity:
        raise ValueError("invalid_phone_number")

    direction = normalizer.normalize_direction(body.direction)
    # Treat explicit "missed" as status; direction stays incoming unless outgoing.
    raw_status = (body.status or "").strip().lower() or direction
    if raw_status in {"missed", "voicemail", "rejected", "spam", "blocked"}:
        status = normalizer.normalize_status(raw_status, direction=direction)
    elif direction == "outgoing":
        status = normalizer.normalize_status(raw_status or "answered", direction=direction)
    else:
        status = normalizer.normalize_status(raw_status or "answered", direction=direction)

    started_at = (body.startedAt or "").strip() or _utc_now_iso()
    duration = body.duration
    if duration is not None:
        duration = max(0, int(duration))

    provider_call_id = _manual_provider_call_id(
        normalized=identity.normalized,
        started_at=started_at,
        direction=direction,
        status=status,
        duration=duration,
    )

    remote = RemoteCall(
        providerCallId=provider_call_id,
        provider="phone",
        vendor=VENDOR_MANUAL,
        phoneNumber=body.phoneNumber.strip(),
        counterpartyPhone=body.phoneNumber.strip(),
        direction=direction,
        status=status,
        startedAt=started_at,
        endedAt=body.endedAt,
        duration=duration,
        voicemail=status == "voicemail",
        notes=(body.notes or "").strip() or None,
        raw={
            "source": "manual",
            "counterpartyName": (body.counterpartyName or "").strip() or None,
        },
    )

    service = PhoneConversationService(db)
    outcome = await service.ingest_remote_call(user_id, remote, vendor=VENDOR_MANUAL)

    # Persist optional counterparty display name on the communication metadata.
    name = (body.counterpartyName or "").strip()
    if name:
        await db.communications.update_one(
            {"userId": user_id, "provider": "phone", "providerId": provider_call_id},
            {"$set": {"metadata.counterpartyName": name, "metadata.fromName": name}},
        )

    doc = await db.communications.find_one(
        {"userId": user_id, "provider": "phone", "providerId": provider_call_id},
        {"_id": 0},
    )
    if not doc:
        raise RuntimeError("call_persist_failed")

    from phone.journal_service import communication_to_journal_item, _actions_for_comms

    action_map = await _actions_for_comms(db, user_id, [doc["id"]])
    aid, astatus = action_map.get(doc["id"], (None, None))
    item = communication_to_journal_item(doc, action_id=aid, action_status=astatus)
    return ManualCallCreateResponse(call=item, outcome=outcome)
