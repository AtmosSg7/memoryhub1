"""Default VAT rate from company profile tests."""

import uuid

import pytest

from company_profile_service import resolve_import_vat_rate
from import_analysis_merger import merge_page_analyses
from import_models import AnalysisResultData, NormalizedCommercialFields, utc_now_iso
from tests.conftest import create_client_record, register_user

LINE_PAYLOAD = {
    "description": "Prestation test",
    "quantity": 1,
    "unitPriceHT": 10000,
    "amountHT": 10000,
}


def _set_profile_vat(client, rate: int):
    res = client.patch("/api/company-profile", json={"defaultVatRate": rate})
    assert res.status_code == 200, res.text
    assert res.json()["profile"]["defaultVatRate"] == rate


def _create_quote(client, client_id, *, line_vat=None):
    line = {**LINE_PAYLOAD}
    if line_vat is not None:
        line["vatRate"] = line_vat
    return client.post(
        "/api/quotes",
        json={
            "clientId": client_id,
            "title": "Devis TVA",
            "amountHT": 10000,
            "lineItems": [line],
        },
    )


def _create_invoice(client, client_id, *, line_vat=None):
    line = {**LINE_PAYLOAD}
    if line_vat is not None:
        line["vatRate"] = line_vat
    return client.post(
        "/api/invoices",
        json={
            "clientId": client_id,
            "title": "Facture TVA",
            "amountHT": 10000,
            "lineItems": [line],
        },
    )


@pytest.mark.parametrize("vat_rate", [20, 10, 5, 0])
def test_new_quote_uses_profile_default_vat(client, vat_rate):
    register_user(client, suffix=uuid.uuid4().hex)
    _set_profile_vat(client, vat_rate)
    owned = create_client_record(client)

    res = _create_quote(client, owned["id"])
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["vatRate"] == vat_rate
    assert body["lineItems"][0]["vatRate"] == vat_rate


@pytest.mark.parametrize("vat_rate", [20, 10, 5, 0])
def test_new_invoice_uses_profile_default_vat(client, vat_rate):
    register_user(client, suffix=uuid.uuid4().hex)
    _set_profile_vat(client, vat_rate)
    owned = create_client_record(client)

    res = _create_invoice(client, owned["id"])
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["vatRate"] == vat_rate
    assert body["lineItems"][0]["vatRate"] == vat_rate


def test_explicit_line_vat_is_preserved(client):
    register_user(client, suffix=uuid.uuid4().hex)
    _set_profile_vat(client, 10)
    owned = create_client_record(client)

    res = _create_quote(client, owned["id"], line_vat=20)
    assert res.status_code == 201
    body = res.json()
    assert body["lineItems"][0]["vatRate"] == 20


def test_existing_quote_vat_unchanged_on_update(client):
    register_user(client, suffix=uuid.uuid4().hex)
    _set_profile_vat(client, 20)
    owned = create_client_record(client)
    created = _create_quote(client, owned["id"], line_vat=20)
    quote_id = created.json()["id"]

    _set_profile_vat(client, 10)
    updated = client.put(
        f"/api/quotes/{quote_id}",
        json={
            "title": "Devis modifié",
            "lineItems": [
                {
                    **LINE_PAYLOAD,
                    "vatRate": 20,
                }
            ],
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["lineItems"][0]["vatRate"] == 20


def test_resolve_import_vat_rate_uses_detected_when_confident():
    assert resolve_import_vat_rate(10, 0.9, 20) == 10


def test_resolve_import_vat_rate_uses_default_when_not_confident():
    assert resolve_import_vat_rate(10, 0.4, 20) == 20
    assert resolve_import_vat_rate(None, 0.0, 10) == 10


def test_merge_drops_low_confidence_vat():
    result = merge_page_analyses(
        [
            AnalysisResultData(
                normalized=NormalizedCommercialFields(vatRate=15, amountHT=10000),
                confidence={"vatRate": 0.4},
                detectedKind="quote",
                provider="mock",
                providerVersion="1",
                analyzedAt=utc_now_iso(),
            )
        ],
        failed_pages=[],
        provider="mock",
        provider_version="1",
        analyzed_at=utc_now_iso(),
    )
    assert result.normalized.vatRate is None
    assert result.confidence["vatRate"] == 0.4


def test_merge_keeps_high_confidence_vat():
    result = merge_page_analyses(
        [
            AnalysisResultData(
                normalized=NormalizedCommercialFields(vatRate=10, amountHT=10000),
                confidence={"vatRate": 0.92},
                detectedKind="invoice",
                provider="mock",
                providerVersion="1",
                analyzedAt=utc_now_iso(),
            )
        ],
        failed_pages=[],
        provider="mock",
        provider_version="1",
        analyzed_at=utc_now_iso(),
    )
    assert result.normalized.vatRate == 10
