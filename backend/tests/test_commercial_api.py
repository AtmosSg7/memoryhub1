"""Commercial document CRUD and quote-to-invoice conversion tests."""

import uuid

from tests.conftest import create_client_record, create_quote_record, register_user


def test_quote_to_invoice_conversion(client):
    register_user(client, suffix=uuid.uuid4().hex)
    owned_client = create_client_record(client)
    quote = create_quote_record(client, owned_client["id"])

    accept = client.put(f"/api/quotes/{quote['id']}", json={"status": "accepted"})
    assert accept.status_code == 200

    convert = client.post(f"/api/quotes/{quote['id']}/convert-to-invoice")
    assert convert.status_code == 201
    invoice = convert.json()

    payment = client.post(
        f"/api/invoices/{invoice['id']}/payments",
        json={"amount": invoice["amountTTC"], "method": "transfer"},
    )
    assert payment.status_code in (200, 201)
    assert payment.json().get("status") == "paid"


def test_reject_negative_quote_amount(client):
    register_user(client, suffix=uuid.uuid4().hex)
    owned_client = create_client_record(client)
    res = client.post(
        "/api/quotes",
        json={
            "clientId": owned_client["id"],
            "title": "Bad quote",
            "amountHT": -100,
            "vatRate": 20,
        },
    )
    assert res.status_code == 422


def test_reject_invalid_vat_rate(client):
    register_user(client, suffix=uuid.uuid4().hex)
    owned_client = create_client_record(client)
    res = client.post(
        "/api/quotes",
        json={
            "clientId": owned_client["id"],
            "title": "Bad VAT",
            "amountHT": 10000,
            "vatRate": 150,
        },
    )
    assert res.status_code == 422
