"""API tests for the events / client timeline ledger."""

import uuid

from tests.conftest import create_client_record, create_quote_record, login_user, register_user


def test_list_client_events_chronological_and_linked(client):
    email, password = register_user(client, suffix=f"evt-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)
    created = create_client_record(client, name="Timeline Client")
    create_quote_record(client, created["id"])
    note = client.post(
        "/api/notes",
        json={"clientId": created["id"], "content": "Appel client"},
    )
    assert note.status_code in (200, 201), note.text

    res = client.get(f"/api/events?clientId={created['id']}&limit=50")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] >= 2
    items = body["items"]
    assert items, "expected timeline events"

    # Newest first
    created_ats = [item["createdAt"] for item in items]
    assert created_ats == sorted(created_ats, reverse=True)

    types = {item["type"] for item in items}
    assert "client_created" in types or "quote_created" in types or "note_created" in types
    assert all(item.get("clientId") == created["id"] for item in items)


def test_list_client_events_supports_offset_pagination(client):
    email, password = register_user(client, suffix=f"evp-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)
    created = create_client_record(client, name="Paged Client")
    for index in range(3):
        note = client.post(
            "/api/notes",
            json={"clientId": created["id"], "content": f"Note {index}"},
        )
        assert note.status_code in (200, 201), note.text

    first = client.get(f"/api/events?clientId={created['id']}&limit=2&offset=0")
    assert first.status_code == 200, first.text
    first_ids = [item["id"] for item in first.json()["items"]]
    assert len(first_ids) == 2

    second = client.get(f"/api/events?clientId={created['id']}&limit=2&offset=2")
    assert second.status_code == 200, second.text
    second_ids = [item["id"] for item in second.json()["items"]]
    assert first_ids[0] not in second_ids


def test_list_client_events_isolates_users_and_unknown_client(client):
    suffix_a = f"eva-{uuid.uuid4().hex[:8]}"
    suffix_b = f"evb-{uuid.uuid4().hex[:8]}"
    email_a, password_a = register_user(client, suffix=suffix_a)
    login_user(client, email_a, password_a)
    owned = create_client_record(client, name="Owned Timeline")
    create_quote_record(client, owned["id"])

    client.post("/api/auth/logout")
    register_user(client, suffix=suffix_b)

    denied = client.get(f"/api/events?clientId={owned['id']}")
    assert denied.status_code == 404

    missing = client.get("/api/events?clientId=00000000-0000-0000-0000-000000000000")
    assert missing.status_code == 404


def test_legacy_client_still_has_readable_timeline(client):
    email, password = register_user(client, suffix=f"evl-{uuid.uuid4().hex[:8]}")
    login_user(client, email, password)
    created = create_client_record(client, name="Legacy Timeline")

    res = client.get(f"/api/events?clientId={created['id']}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] >= 1
    assert body["items"][0]["type"] in {"client_created", "client_updated"}
    assert "createdAt" in body["items"][0]
    assert "metadata" in body["items"][0]
