"""Import API integration tests."""

import io
import uuid

from tests.conftest import register_user


def _jpeg_bytes() -> bytes:
    from PIL import Image

    image = Image.new("RGB", (120, 120), color="#CC3344")
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def test_import_analyze_single_pdf(client):
    register_user(client, suffix=uuid.uuid4().hex)
    client.post("/api/credits/dev/assign-plan", params={"planId": "solo"})

    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    res = client.post(
        "/api/imports/analyze",
        files={"file": ("devis-test.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "pending"
    assert body["analysis"]["detectedKind"] in {"quote", "invoice"}


def test_import_analyze_multi_images(client):
    register_user(client, suffix=uuid.uuid4().hex)
    client.post("/api/credits/dev/assign-plan", params={"planId": "solo"})

    image_a = _jpeg_bytes()
    image_b = _jpeg_bytes()
    res = client.post(
        "/api/imports/analyze",
        files=[
            ("files", ("page-1.jpg", io.BytesIO(image_a), "image/jpeg")),
            ("files", ("page-2.jpg", io.BytesIO(image_b), "image/jpeg")),
        ],
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["file"].get("originalFileCount") == 2
    assert body["file"].get("pageCount", 1) >= 2


def test_import_estimate_multi_files(client):
    register_user(client, suffix=uuid.uuid4().hex)
    res = client.post(
        "/api/imports/estimate",
        json={
            "extension": "jpg",
            "sizeBytes": 4000,
            "files": [
                {"extension": "jpg", "sizeBytes": 2000},
                {"extension": "jpg", "sizeBytes": 2000},
            ],
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["fileCount"] == 2


def test_import_limit_premium_message(client, monkeypatch):
    monkeypatch.setenv("IMPORT_MAX_FILE_SIZE_BYTES", "100")
    register_user(client, suffix=uuid.uuid4().hex)

    large = _jpeg_bytes()
    res = client.post(
        "/api/imports/analyze",
        files={"file": ("large.jpg", io.BytesIO(large), "image/jpeg")},
    )
    assert res.status_code == 413, res.text
    assert "trop volumineux" in res.json()["detail"]["message"].lower()
