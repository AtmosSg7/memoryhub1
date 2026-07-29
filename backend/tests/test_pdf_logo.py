"""PDF company logo rendering tests."""

import os
import uuid
from io import BytesIO

import pytest
from PIL import Image
from pymongo import MongoClient

from pdf_documents import build_quote_pdf
from pdf_logo_loader import load_pdf_logo_bytes, prepare_logo_bytes
from storage import get_storage
from tests.conftest import create_client_record, create_quote_record, register_user


def _make_logo_bytes(width: int, height: int, *, color=(12, 84, 160)) -> bytes:
    image = Image.new("RGB", (width, height), color=color)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _pdf_has_image(pdf_bytes: bytes) -> bool:
    return b"/Subtype /Image" in pdf_bytes


def _upload_logo(client, png_bytes: bytes, kind: str = "logo"):
    files = {"file": ("logo.png", png_bytes, "image/png")}
    res = client.post(f"/api/company-profile/logo?kind={kind}", files=files)
    assert res.status_code == 200, res.text
    return res.json()


def _set_logo_storage_key(user_email: str, storage_key: str):
    mongo = MongoClient(os.environ["MONGO_URL"])
    mongo[os.environ["DB_NAME"]].users.update_one(
        {"email": user_email.lower()},
        {"$set": {"companyProfile.logoStorageKey": storage_key, "companyProfile.pdfLogoStorageKey": storage_key}},
    )


def test_pdf_without_logo_unchanged(client):
    register_user(client, suffix=uuid.uuid4().hex)
    owned = create_client_record(client)
    quote = create_quote_record(client, owned["id"])

    res = client.get(f"/api/quotes/{quote['id']}/pdf")
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"
    assert not _pdf_has_image(res.content)

    baseline = build_quote_pdf(quote, seller={"companyName": "Atelier Test"})
    assert baseline[:4] == b"%PDF"
    assert not _pdf_has_image(baseline)


def test_pdf_with_logo_embeds_image(client):
    register_user(client, suffix=uuid.uuid4().hex)
    _upload_logo(client, _make_logo_bytes(320, 120))
    owned = create_client_record(client)
    quote = create_quote_record(client, owned["id"])

    res = client.get(f"/api/quotes/{quote['id']}/pdf")
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"
    assert _pdf_has_image(res.content)


def test_pdf_with_logo_via_invoice_and_portal(client):
    email, _ = register_user(client, suffix=uuid.uuid4().hex)
    _upload_logo(client, _make_logo_bytes(240, 80))
    owned = create_client_record(client)
    quote = create_quote_record(client, owned["id"])
    client.put(f"/api/quotes/{quote['id']}", json={"status": "accepted"})
    invoice = client.post(f"/api/quotes/{quote['id']}/convert-to-invoice").json()

    invoice_pdf = client.get(f"/api/invoices/{invoice['id']}/pdf")
    assert invoice_pdf.status_code == 200
    assert _pdf_has_image(invoice_pdf.content)

    portal = client.post(f"/api/clients/{owned['id']}/portal")
    token = portal.json()["token"]
    portal_pdf = client.get(f"/api/portal/{token}/quotes/{quote['id']}/pdf")
    assert portal_pdf.status_code == 200
    assert _pdf_has_image(portal_pdf.content)


def test_pdf_missing_logo_does_not_fail(client):
    email, _ = register_user(client, suffix=uuid.uuid4().hex)
    missing_key = f"company-logos/missing/{uuid.uuid4().hex}-logo.png"
    _set_logo_storage_key(email, missing_key)
    owned = create_client_record(client)
    quote = create_quote_record(client, owned["id"])

    res = client.get(f"/api/quotes/{quote['id']}/pdf")
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"
    assert not _pdf_has_image(res.content)


def test_pdf_invalid_logo_does_not_fail(client):
    email, _ = register_user(client, suffix=uuid.uuid4().hex)
    owned = create_client_record(client)
    quote = create_quote_record(client, owned["id"])

    storage_key = f"company-logos/test-user/logo/{uuid.uuid4().hex}-bad.png"
    import asyncio

    asyncio.get_event_loop().run_until_complete(get_storage().save(storage_key, b"not-an-image"))
    _set_logo_storage_key(email, storage_key)

    res = client.get(f"/api/quotes/{quote['id']}/pdf")
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"
    assert not _pdf_has_image(res.content)


@pytest.mark.parametrize(
    "width,height",
    [
        (80, 80),
        (640, 120),
        (180, 360),
    ],
)
def test_pdf_logo_sizes_preserve_generation(client, width, height):
    register_user(client, suffix=uuid.uuid4().hex)
    _upload_logo(client, _make_logo_bytes(width, height))
    owned = create_client_record(client)
    quote = create_quote_record(client, owned["id"])

    res = client.get(f"/api/quotes/{quote['id']}/pdf")
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"
    assert _pdf_has_image(res.content)


def test_prepare_logo_bytes_accepts_jpeg():
    image = Image.new("RGB", (120, 60), color=(200, 20, 20))
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    prepared = prepare_logo_bytes(buffer.getvalue())
    assert prepared is not None


def test_prepare_logo_bytes_rejects_corrupt_data():
    assert prepare_logo_bytes(b"broken") is None


def test_load_pdf_logo_bytes_reads_once(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCAL_UPLOAD_DIR", str(tmp_path))
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    from storage import factory as storage_factory

    storage_factory._storage = None

    key = "company-logos/u1/logo/test.png"
    logo = _make_logo_bytes(100, 40)
    import asyncio

    asyncio.get_event_loop().run_until_complete(get_storage().save(key, logo))
    loaded = asyncio.get_event_loop().run_until_complete(load_pdf_logo_bytes(key))
    assert loaded == logo

    storage_factory._storage = None
