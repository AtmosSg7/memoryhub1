"""Document upload validation and access control tests."""

import io
import uuid

from tests.conftest import register_user


def test_reject_disallowed_extension(client):
    register_user(client, suffix=uuid.uuid4().hex)
    res = client.post(
        "/api/documents/upload",
        files={"file": ("malware.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
    )
    assert res.status_code == 400


def test_reject_empty_file(client):
    register_user(client, suffix=uuid.uuid4().hex)
    res = client.post(
        "/api/documents/upload",
        files={"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")},
    )
    assert res.status_code == 400


def test_reject_pdf_with_wrong_magic(client):
    register_user(client, suffix=uuid.uuid4().hex)
    res = client.post(
        "/api/documents/upload",
        files={"file": ("fake.pdf", io.BytesIO(b"not a pdf"), "application/pdf")},
    )
    assert res.status_code == 400


def test_upload_and_download_pdf(client):
    register_user(client, suffix=uuid.uuid4().hex)
    content = b"%PDF-1.4\n% test document"
    upload = client.post(
        "/api/documents/upload",
        files={"file": ("valid.pdf", io.BytesIO(content), "application/pdf")},
    )
    assert upload.status_code in (200, 201)
    doc_id = upload.json()["id"]

    download = client.get(f"/api/documents/{doc_id}/download")
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF")


def test_download_nonexistent_document(client):
    register_user(client, suffix=uuid.uuid4().hex)
    res = client.get("/api/documents/00000000-0000-0000-0000-000000000000/download")
    assert res.status_code == 404


def test_malicious_filename_sanitized(client):
    register_user(client, suffix=uuid.uuid4().hex)
    upload = client.post(
        "/api/documents/upload",
        files={"file": ("../../etc/passwd.pdf", io.BytesIO(b"%PDF-1.4 safe"), "application/pdf")},
    )
    assert upload.status_code in (200, 201)
    assert ".." not in upload.json()["name"]
