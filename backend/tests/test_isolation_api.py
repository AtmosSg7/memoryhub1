"""Cross-user isolation tests for protected resources."""

import io
import uuid

from tests.conftest import create_client_record, create_quote_record, register_user


def _two_users(client):
    suffix_a = uuid.uuid4().hex
    suffix_b = uuid.uuid4().hex
    register_user(client, suffix=suffix_a)
    owned_client = create_client_record(client, name=f"Client A {suffix_a}")
    owned_quote = create_quote_record(client, owned_client["id"])
    owned_note = client.post("/api/notes", json={"content": "Note A", "type": "general"}).json()

    client.post("/api/auth/logout")
    register_user(client, suffix=suffix_b)
    return owned_client, owned_quote, owned_note


def test_user_b_cannot_read_client_a(client):
    owned_client, _, _ = _two_users(client)
    res = client.get(f"/api/clients/{owned_client['id']}")
    assert res.status_code == 404


def test_user_b_cannot_update_client_a(client):
    owned_client, _, _ = _two_users(client)
    res = client.put(f"/api/clients/{owned_client['id']}", json={"name": "Hacked"})
    assert res.status_code == 404


def test_user_b_cannot_delete_client_a(client):
    owned_client, _, _ = _two_users(client)
    res = client.delete(f"/api/clients/{owned_client['id']}")
    assert res.status_code == 404


def test_user_b_cannot_read_quote_a(client):
    _, owned_quote, _ = _two_users(client)
    res = client.get(f"/api/quotes/{owned_quote['id']}")
    assert res.status_code == 404


def test_user_b_cannot_convert_quote_a(client):
    _, owned_quote, _ = _two_users(client)
    res = client.post(f"/api/quotes/{owned_quote['id']}/convert-to-invoice")
    assert res.status_code == 404


def test_user_b_cannot_read_note_a(client):
    _, _, owned_note = _two_users(client)
    res = client.get(f"/api/notes/{owned_note['id']}")
    assert res.status_code == 404


def test_user_b_cannot_delete_note_a(client):
    _, _, owned_note = _two_users(client)
    res = client.delete(f"/api/notes/{owned_note['id']}")
    assert res.status_code == 404


def test_user_b_cannot_download_foreign_document(client):
    suffix_a = uuid.uuid4().hex
    register_user(client, suffix=suffix_a)
    pdf = io.BytesIO(b"%PDF-1.4 test content isolation")
    upload = client.post(
        "/api/documents/upload",
        files={"file": ("test.pdf", pdf, "application/pdf")},
    )
    assert upload.status_code in (200, 201)
    doc_id = upload.json()["id"]

    client.post("/api/auth/logout")
    register_user(client, suffix=uuid.uuid4().hex)

    download = client.get(f"/api/documents/{doc_id}/download")
    assert download.status_code == 404


def test_search_does_not_leak_other_user_data(client):
    suffix_a = uuid.uuid4().hex
    unique_name = f"UniqueClient{suffix_a}"
    register_user(client, suffix=suffix_a)
    create_client_record(client, name=unique_name)

    client.post("/api/auth/logout")
    register_user(client, suffix=uuid.uuid4().hex)

    search = client.get("/api/search", params={"q": unique_name[:8]})
    assert search.status_code == 200
    payload = search.json()
    assert payload["total"] == 0
