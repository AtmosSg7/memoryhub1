import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException

from personal_reminder_models import PersonalReminderPublic

DEFAULT_TITLE = "Note sans titre"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(value: str) -> str:
    try:
        normalized = str(value).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": "Invalid reminder date."}) from exc


def _user_filter(user_id: str) -> dict:
    return {"userId": user_id}


def _reminder_message(note_doc: dict) -> str:
    title = (note_doc.get("title") or "").strip()
    content = (note_doc.get("content") or "").strip()
    if title and title != DEFAULT_TITLE:
        return title if not content else f"{title} — {content[:200]}"
    return content[:240] if content else DEFAULT_TITLE


def personal_reminder_public(doc: dict) -> PersonalReminderPublic:
    return PersonalReminderPublic(
        id=doc["id"],
        noteId=doc["noteId"],
        clientId=doc.get("clientId"),
        clientName=doc.get("clientName"),
        message=doc.get("message") or "",
        remindAt=doc["remindAt"],
        status=doc.get("status", "pending"),
        completedAt=doc.get("completedAt"),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    )


async def upsert_personal_reminder(db, user_id: str, note_doc: dict, remind_at: str) -> None:
    remind_at_iso = _parse_iso(remind_at)
    now = _now_iso()
    note_id = note_doc["id"]

    existing = await db.personal_reminders.find_one(
        {**_user_filter(user_id), "noteId": note_id, "status": "pending"},
        {"_id": 0},
    )

    payload = {
        "noteId": note_id,
        "clientId": note_doc.get("clientId"),
        "clientName": note_doc.get("clientName"),
        "message": _reminder_message(note_doc),
        "remindAt": remind_at_iso,
        "status": "pending",
        "completedAt": None,
        "updatedAt": now,
    }

    if existing:
        await db.personal_reminders.update_one(
            {"userId": user_id, "id": existing["id"]},
            {"$set": payload},
        )
        reminder_id = existing["id"]
    else:
        reminder_id = str(uuid.uuid4())
        await db.personal_reminders.insert_one(
            {
                "id": reminder_id,
                "userId": user_id,
                "createdAt": now,
                **payload,
            }
        )

    await db.notes.update_one(
        {"userId": user_id, "id": note_id},
        {"$set": {"remindAt": remind_at_iso, "reminderId": reminder_id, "updatedAt": now}},
    )


async def clear_personal_reminder_for_note(db, user_id: str, note_id: str) -> None:
    now = _now_iso()
    await db.personal_reminders.update_many(
        {**_user_filter(user_id), "noteId": note_id, "status": "pending"},
        {"$set": {"status": "completed", "completedAt": now, "updatedAt": now}},
    )
    await db.notes.update_one(
        {"userId": user_id, "id": note_id},
        {"$unset": {"remindAt": "", "reminderId": ""}, "$set": {"updatedAt": now}},
    )


async def delete_personal_reminders_for_note(db, user_id: str, note_id: str) -> None:
    await db.personal_reminders.delete_many({**_user_filter(user_id), "noteId": note_id})


async def list_due_personal_reminders(db, user_id: str, limit: int = 20) -> List[PersonalReminderPublic]:
    now = _now_iso()
    cursor = (
        db.personal_reminders.find(
            {
                **_user_filter(user_id),
                "status": "pending",
                "remindAt": {"$lte": now},
            },
            {"_id": 0},
        )
        .sort("remindAt", 1)
        .limit(limit)
    )
    items = [personal_reminder_public(doc) async for doc in cursor]
    return items


async def complete_personal_reminder(db, user_id: str, reminder_id: str) -> PersonalReminderPublic:
    doc = await db.personal_reminders.find_one(
        {**_user_filter(user_id), "id": reminder_id},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Reminder not found."})
    if doc.get("status") == "completed":
        return personal_reminder_public(doc)

    now = _now_iso()
    await db.personal_reminders.update_one(
        {"userId": user_id, "id": reminder_id},
        {"$set": {"status": "completed", "completedAt": now, "updatedAt": now}},
    )
    await db.notes.update_one(
        {"userId": user_id, "id": doc["noteId"]},
        {"$unset": {"remindAt": "", "reminderId": ""}, "$set": {"updatedAt": now}},
    )

    updated = {**doc, "status": "completed", "completedAt": now, "updatedAt": now}
    return personal_reminder_public(updated)


async def snooze_personal_reminder(
    db, user_id: str, reminder_id: str, remind_at: str
) -> PersonalReminderPublic:
    doc = await db.personal_reminders.find_one(
        {**_user_filter(user_id), "id": reminder_id, "status": "pending"},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Reminder not found."})

    remind_at_iso = _parse_iso(remind_at)
    now = _now_iso()
    await db.personal_reminders.update_one(
        {"userId": user_id, "id": reminder_id},
        {"$set": {"remindAt": remind_at_iso, "updatedAt": now}},
    )
    await db.notes.update_one(
        {"userId": user_id, "id": doc["noteId"]},
        {"$set": {"remindAt": remind_at_iso, "updatedAt": now}},
    )

    updated = {**doc, "remindAt": remind_at_iso, "updatedAt": now}
    return personal_reminder_public(updated)
