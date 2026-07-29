"""Tests for personal reminders API and note integration."""

import uuid
from datetime import datetime, timedelta, timezone

from tests.conftest import register_user


def _iso_in_past(minutes=5):
    dt = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    return dt.isoformat()


def _iso_in_future(hours=2):
    dt = datetime.now(timezone.utc) + timedelta(hours=hours)
    return dt.isoformat()


def _create_note(client, content="Appeler M. Durand pour confirmer le chantier", remind_at=None):
    payload = {
        "content": content,
        "type": "phone",
    }
    if remind_at:
        payload["remindAt"] = remind_at
    res = client.post("/api/notes", json=payload)
    assert res.status_code in (200, 201)
    return res.json()


def test_note_without_reminder_not_in_due_list(client):
    register_user(client)
    _create_note(client, content="Note simple sans rappel")

    due = client.get("/api/personal-reminders/due")
    assert due.status_code == 200
    assert due.json()["total"] == 0


def test_note_with_due_reminder_appears_in_due_list(client):
    register_user(client)
    note = _create_note(client, remind_at=_iso_in_past())

    due = client.get("/api/personal-reminders/due")
    assert due.status_code == 200
    payload = due.json()
    assert payload["total"] == 1
    assert payload["items"][0]["noteId"] == note["id"]
    assert payload["items"][0]["status"] == "pending"
    assert "Durand" in payload["items"][0]["message"]


def test_future_reminder_not_due_yet(client):
    register_user(client)
    _create_note(client, remind_at=_iso_in_future(hours=24))

    due = client.get("/api/personal-reminders/due")
    assert due.status_code == 200
    assert due.json()["total"] == 0


def test_complete_reminder_removes_from_due(client):
    register_user(client)
    note = _create_note(client, remind_at=_iso_in_past())

    due = client.get("/api/personal-reminders/due")
    reminder_id = due.json()["items"][0]["id"]

    complete = client.post(f"/api/personal-reminders/{reminder_id}/complete")
    assert complete.status_code == 200
    assert complete.json()["status"] == "completed"

    due_after = client.get("/api/personal-reminders/due")
    assert due_after.json()["total"] == 0

    note_after = client.get(f"/api/notes/{note['id']}")
    assert note_after.status_code == 200
    assert note_after.json().get("remindAt") is None


def test_snooze_one_hour_pushes_reminder_forward(client):
    register_user(client)
    _create_note(client, remind_at=_iso_in_past())

    due = client.get("/api/personal-reminders/due")
    reminder_id = due.json()["items"][0]["id"]

    snooze_at = _iso_in_future(hours=1)
    snooze = client.post(
        f"/api/personal-reminders/{reminder_id}/snooze",
        json={"remindAt": snooze_at},
    )
    assert snooze.status_code == 200
    assert snooze.json()["status"] == "pending"

    due_after = client.get("/api/personal-reminders/due")
    assert due_after.json()["total"] == 0


def test_snooze_tomorrow_morning(client):
    register_user(client)
    _create_note(client, remind_at=_iso_in_past())

    due = client.get("/api/personal-reminders/due")
    reminder_id = due.json()["items"][0]["id"]

    tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
    tomorrow = tomorrow.replace(hour=8, minute=0, second=0, microsecond=0)
    snooze_at = tomorrow.isoformat()

    snooze = client.post(
        f"/api/personal-reminders/{reminder_id}/snooze",
        json={"remindAt": snooze_at},
    )
    assert snooze.status_code == 200

    due_after = client.get("/api/personal-reminders/due")
    assert due_after.json()["total"] == 0


def test_user_isolation(client):
    suffix_a = uuid.uuid4().hex
    suffix_b = uuid.uuid4().hex
    register_user(client, suffix=suffix_a)
    _create_note(client, remind_at=_iso_in_past())
    due_a = client.get("/api/personal-reminders/due")
    assert due_a.json()["total"] == 1
    reminder_id = due_a.json()["items"][0]["id"]

    client.post("/api/auth/logout")
    register_user(client, suffix=suffix_b)
    due_b = client.get("/api/personal-reminders/due")
    assert due_b.json()["total"] == 0

    forbidden = client.post(f"/api/personal-reminders/{reminder_id}/complete")
    assert forbidden.status_code == 404


def test_clear_reminder_on_note_update(client):
    register_user(client)
    note = _create_note(client, remind_at=_iso_in_past())

    due = client.get("/api/personal-reminders/due")
    assert due.json()["total"] == 1

    updated = client.put(
        f"/api/notes/{note['id']}",
        json={"content": "Contenu mis à jour", "clearReminder": True},
    )
    assert updated.status_code == 200
    assert updated.json().get("remindAt") is None

    due_after = client.get("/api/personal-reminders/due")
    assert due_after.json()["total"] == 0
