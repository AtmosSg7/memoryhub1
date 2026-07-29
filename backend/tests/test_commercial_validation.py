"""Commercial validation service tests."""

import uuid

from commercial_validation_service import validate_invoice_document
from tests.conftest import create_client_record, create_quote_record, register_user


def _invoice_doc(client_id: str, **overrides):
    base = {
        "id": str(uuid.uuid4()),
        "number": "FAC-2026-0001",
        "clientId": client_id,
        "clientName": "Client Test",
        "title": "Facture test",
        "status": "in_progress",
        "invoiceDate": "2026-07-14T10:00:00+00:00",
        "amountHT": 10000,
        "vatRate": 20,
        "amountTTC": 12000,
        "lineItems": [
            {
                "description": "Prestation",
                "quantity": 1,
                "unitPriceHT": 10000,
                "vatRate": 20,
                "amountHT": 10000,
            }
        ],
    }
    base.update(overrides)
    return base


def test_validation_passes_with_complete_data():
    client = {"name": "ACME", "address": "12 rue de Paris", "city": "Paris"}
    seller = {"companyName": "MemoryHub SARL"}
    result = validate_invoice_document(_invoice_doc("c1"), client=client, seller=seller)
    assert result.valid is True
    assert result.errors == []


def test_validation_fails_without_client_address():
    result = validate_invoice_document(
        _invoice_doc("c1"),
        client={"name": "ACME"},
        seller={"companyName": "MemoryHub SARL"},
    )
    assert result.valid is False
    assert any(err.code == "CLIENT_ADDRESS_MISSING" for err in result.errors)


def test_validation_fails_on_totals_mismatch():
    doc = _invoice_doc("c1", amountTTC=99999)
    result = validate_invoice_document(
        doc,
        client={"name": "ACME", "address": "12 rue de Paris"},
        seller={"companyName": "MemoryHub SARL"},
    )
    assert result.valid is False
    assert any(err.code == "TOTALS_TTC_MISMATCH" for err in result.errors)


def test_validation_api_endpoint(client):
    register_user(client, suffix=uuid.uuid4().hex)
    owned_client = create_client_record(client)
    client.put(
        f"/api/clients/{owned_client['id']}",
        json={"address": "10 avenue Test", "city": "Lyon"},
    )
    quote = create_quote_record(client, owned_client["id"])
    client.put(f"/api/quotes/{quote['id']}", json={"status": "accepted"})
    invoice = client.post(f"/api/quotes/{quote['id']}/convert-to-invoice").json()

    res = client.post(f"/api/commercial/invoices/{invoice['id']}/validate")
    assert res.status_code == 200
    body = res.json()
    assert body["validation"]["valid"] is True
    assert body["lifecycle"]["exportStatus"] in {"validated", "ready_for_export"}
