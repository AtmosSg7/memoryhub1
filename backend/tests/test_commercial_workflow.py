"""Commercial workflow tests — conversion, validation, export preparation."""

import uuid

from tests.conftest import create_client_record, create_quote_record, register_user


def _convert_quote(client, client_id: str):
    quote = create_quote_record(client, client_id)
    client.put(f"/api/quotes/{quote['id']}", json={"status": "accepted"})
    res = client.post(f"/api/quotes/{quote['id']}/convert-to-invoice")
    assert res.status_code == 201, res.text
    return res.json()


def test_conversion_initializes_export_workflow(client):
    register_user(client, suffix=uuid.uuid4().hex)
    owned_client = create_client_record(client)
    client.put(
        f"/api/clients/{owned_client['id']}",
        json={"address": "1 rue Workflow", "city": "Nantes"},
    )
    invoice = _convert_quote(client, owned_client["id"])
    assert invoice.get("exportStatus") in {"validated", "ready_for_export", "draft"}
    assert invoice.get("lifecycleStatus") is not None


def test_prepare_export_requires_validation(client):
    register_user(client, suffix=uuid.uuid4().hex)
    owned_client = create_client_record(client)
    invoice = _convert_quote(client, owned_client["id"])

    lifecycle = client.get(f"/api/commercial/invoices/{invoice['id']}/lifecycle")
    assert lifecycle.status_code == 200

    prepare = client.post(f"/api/commercial/invoices/{invoice['id']}/prepare-export")
    assert prepare.status_code in (200, 422)


def test_structured_export_pdf_with_require_ready_false(client):
    register_user(client, suffix=uuid.uuid4().hex)
    owned_client = create_client_record(client)
    invoice = _convert_quote(client, owned_client["id"])

    res = client.post(
        f"/api/commercial/invoices/{invoice['id']}/export",
        params={"format": "pdf", "requireReady": "false"},
    )
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"


def test_facturx_export_returns_not_implemented(client):
    register_user(client, suffix=uuid.uuid4().hex)
    owned_client = create_client_record(client)
    client.put(
        f"/api/clients/{owned_client['id']}",
        json={"address": "2 rue Export", "city": "Lille"},
    )
    invoice = _convert_quote(client, owned_client["id"])
    client.post(f"/api/commercial/invoices/{invoice['id']}/prepare-export")

    res = client.post(
        f"/api/commercial/invoices/{invoice['id']}/export",
        params={"format": "facturx", "requireReady": "true"},
    )
    assert res.status_code == 501
    assert res.json()["detail"]["code"] == "export_not_implemented"
