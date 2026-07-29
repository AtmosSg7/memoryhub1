"""Unit tests for generic contact sync metadata helpers."""

from contact_sync import (
    apply_user_contact_edits,
    default_contact_sync_fields,
    detect_user_modification,
    hydrate_contact_sync,
    mark_contact_user_modified,
    prepare_conflict_resolution,
)


def test_default_sync_fields_are_manual_synced():
    fields = default_contact_sync_fields()
    assert fields["source"] == "manual"
    assert fields["syncStatus"] == "synced"
    assert fields["isUserModified"] is False
    assert fields["version"] == 1
    assert fields["sourceId"] is None


def test_hydrate_fills_missing_sync_metadata_without_destroying_value():
    hydrated = hydrate_contact_sync({"id": "e1", "value": "a@example.com", "isPrimary": True})
    assert hydrated["value"] == "a@example.com"
    assert hydrated["source"] == "manual"
    assert hydrated["syncStatus"] == "synced"
    assert hydrated["version"] == 1
    assert hydrated["isUserModified"] is False


def test_detect_and_mark_user_modification():
    previous = hydrate_contact_sync(
        {
            "id": "p1",
            "value": "0600000000",
            "label": "main",
            "isPrimary": True,
            "source": "google_contacts",
            "sourceId": "gc-1",
            "syncStatus": "synced",
            "version": 2,
        }
    )
    current = {**previous, "value": "0611111111"}
    assert detect_user_modification(previous, current, kind="phone") is True

    stamped = mark_contact_user_modified(current, actor="user")
    assert stamped["isUserModified"] is True
    assert stamped["version"] == 3
    assert stamped["updatedBy"] == "user"
    assert stamped["source"] == "google_contacts"
    assert stamped["sourceId"] == "gc-1"
    assert stamped["syncStatus"] == "conflict"


def test_apply_user_contact_edits_stamps_new_and_changed_items():
    previous = [
        hydrate_contact_sync(
            {
                "id": "e1",
                "value": "old@example.com",
                "label": "main",
                "isPrimary": True,
                "source": "manual",
                "version": 1,
            }
        )
    ]
    next_items = [
        {"id": "e1", "value": "new@example.com", "label": "main", "isPrimary": True},
        {"id": "e2", "value": "extra@example.com", "label": "work", "isPrimary": False},
    ]
    result = apply_user_contact_edits(previous, next_items, kind="email", actor="user")
    by_id = {item["id"]: item for item in result}
    assert by_id["e1"]["isUserModified"] is True
    assert by_id["e1"]["version"] == 2
    assert by_id["e2"]["source"] == "manual"
    assert by_id["e2"]["isUserModified"] is True


def test_prepare_conflict_resolution_prefers_local_when_user_modified():
    local = mark_contact_user_modified(
        hydrate_contact_sync(
            {
                "id": "e1",
                "value": "local@example.com",
                "source": "gmail",
                "sourceId": "gm-1",
            }
        )
    )
    remote = hydrate_contact_sync(
        {
            "id": "e1",
            "value": "remote@example.com",
            "source": "gmail",
            "sourceId": "gm-1",
        }
    )
    resolution = prepare_conflict_resolution(local, remote, kind="email")
    assert resolution["status"] == "conflict"
    assert resolution["prefer"] == "local"
    assert resolution["local"]["value"] == "local@example.com"
    assert resolution["remote"]["value"] == "remote@example.com"
