"""Release Candidate — commercial totals non-regression tests."""

from commercial_engine import (
    compute_global_totals,
    normalize_line_item,
    totals_from_lines,
)
from commercial_models import CommercialLineItem


def test_global_totals_standard_vat():
    totals = compute_global_totals(10000, 20)
    assert totals.amountHT == 10000
    assert totals.vatRate == 20
    assert totals.amountTTC == 12000


def test_global_totals_rounding_integer_cents():
    totals = compute_global_totals(33333, 20)
    assert totals.amountTTC == (33333 * 120) // 100


def test_line_items_decimal_quantity():
    line = normalize_line_item(
        {
            "description": "Pose carrelage",
            "quantity": 2.5,
            "unitPriceHT": 4000,
            "vatRate": 10,
        }
    )
    assert line is not None
    assert line.amountHT == 10000
    totals = totals_from_lines([line])
    assert totals.amountHT == 10000
    assert totals.amountTTC == 11000


def test_line_items_mixed_vat_rates():
    lines = [
        CommercialLineItem(description="A", quantity=1, unitPriceHT=10000, vatRate=20, amountHT=10000),
        CommercialLineItem(description="B", quantity=1, unitPriceHT=5000, vatRate=10, amountHT=5000),
    ]
    totals = totals_from_lines(lines)
    assert totals.amountHT == 15000
    assert totals.amountTTC == 10000 * 120 // 100 + 5000 * 110 // 100


def test_line_items_percent_discount():
    line = normalize_line_item(
        {
            "description": "Remise client",
            "quantity": 1,
            "unitPriceHT": 20000,
            "vatRate": 20,
            "discount": "10%",
        }
    )
    assert line is not None
    assert line.amountHT == 18000
    totals = totals_from_lines([line])
    assert totals.amountTTC == 21600


def test_quote_api_line_items_totals(client):
    import uuid

    from tests.conftest import create_client_record, register_user

    register_user(client, suffix=uuid.uuid4().hex)
    owned_client = create_client_record(client)

    res = client.post(
        "/api/quotes",
        json={
            "clientId": owned_client["id"],
            "title": "Devis lignes RC",
            "lineItems": [
                {
                    "description": "Main d'œuvre",
                    "quantity": 3,
                    "unitPriceHT": 5000,
                    "vatRate": 20,
                    "amountHT": 15000,
                },
                {
                    "description": "Fourniture",
                    "quantity": 1,
                    "unitPriceHT": 15000,
                    "vatRate": 10,
                    "amountHT": 15000,
                },
            ],
        },
    )
    assert res.status_code in (200, 201), res.text
    quote = res.json()
    assert quote["amountHT"] == 30000
    assert quote["amountTTC"] == 15000 * 120 // 100 + 15000 * 110 // 100
