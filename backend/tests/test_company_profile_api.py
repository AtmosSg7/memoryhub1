"""Company profile API and validation tests."""

from company_profile_validators import (
    validate_business_email,
    validate_iban,
    validate_phone,
    validate_siret,
    validate_vat_number,
)
from tests.conftest import register_user

# Valid test SIRET (SIREN 732829320 passes Luhn) + NIC
VALID_SIRET = "73282932000074"
VALID_IBAN = "FR1420041010050500013M02606"


def test_siret_validation():
    normalized, error = validate_siret(VALID_SIRET)
    assert error is None
    assert normalized == VALID_SIRET
    _, error = validate_siret("123")
    assert error is not None


def test_vat_validation():
    normalized, error = validate_vat_number("FR40303265045")
    assert error is None
    assert normalized == "FR40303265045"


def test_iban_validation():
    normalized, error = validate_iban(VALID_IBAN)
    assert error is None
    _, error = validate_iban("FR00BAD")
    assert error is not None


def test_email_and_phone_validation():
    email, err = validate_business_email("contact@example.com")
    assert err is None
    assert email == "contact@example.com"
    phone, err = validate_phone("+33 6 12 34 56 78")
    assert err is None
    assert phone is not None


def test_get_company_profile_migrates_from_company_name(client):
    register_user(client, company_name="Atelier Dupont")
    res = client.get("/api/company-profile")
    assert res.status_code == 200
    body = res.json()
    assert body["profile"]["legalName"] == "Atelier Dupont"
    assert body["profile"]["quotePrefix"] == "DEV"


def test_update_company_profile(client):
    register_user(client)
    payload = {
        "legalName": "MemoryHub SARL",
        "tradeName": "MemoryHub",
        "siret": VALID_SIRET,
        "vatNumber": "FR40303265045",
        "address": "10 rue de Paris",
        "postalCode": "75001",
        "city": "Paris",
        "phone": "+33123456789",
        "email": "facturation@memoryhub.test",
        "iban": VALID_IBAN,
        "bic": "BNPAFRPP",
        "paymentTerms": "Paiement à 30 jours",
        "quotePrefix": "DEVIS",
        "invoicePrefix": "FAC",
        "defaultVatRate": 20,
    }
    res = client.patch("/api/company-profile", json=payload)
    assert res.status_code == 200
    profile = res.json()["profile"]
    assert profile["legalName"] == "MemoryHub SARL"
    assert profile["siret"] == VALID_SIRET
    assert profile["quotePrefix"] == "DEVIS"

    me = client.get("/api/auth/me")
    assert me.json()["companyName"] == "MemoryHub SARL"


def test_invalid_siret_rejected(client):
    register_user(client)
    res = client.patch("/api/company-profile", json={"siret": "123"})
    assert res.status_code == 422


def test_new_quote_uses_company_prefix(client):
    from tests.conftest import create_client_record

    register_user(client)
    client.patch("/api/company-profile", json={"quotePrefix": "QTE"})
    owned = create_client_record(client)
    quote = client.post(
        "/api/quotes",
        json={"clientId": owned["id"], "title": "Test", "amountHT": 10000, "vatRate": 20, "status": "sent"},
    )
    assert quote.status_code in (200, 201)
    assert quote.json()["number"].startswith("QTE-")
