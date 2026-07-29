"""Unit tests for Client-centric hydrate / dual-write service."""

from client_models import ClientCreate, ClientUpdate
from client_service import (
    apply_client_updates,
    build_client_document,
    client_display_name,
    client_public,
    hydrate_client_doc,
    max_iso_datetime,
    merge_client_list_stats,
)


def test_hydrate_legacy_flat_client_synthesizes_nested_contacts():
    legacy = {
        "id": "c1",
        "name": "Dupont",
        "email": "dupont@example.com",
        "phone": "0600000000",
        "address": "12 rue de la Paix",
        "city": "Paris",
        "company": "Dupont SARL",
        "status": "active",
        "createdAt": "2026-01-01T00:00:00+00:00",
        "updatedAt": "2026-01-01T00:00:00+00:00",
    }

    hydrated = hydrate_client_doc(legacy)
    assert hydrated["schemaVersion"] >= 3
    assert len(hydrated["emails"]) == 1
    assert hydrated["emails"][0]["value"] == "dupont@example.com"
    assert hydrated["emails"][0]["isPrimary"] is True
    assert hydrated["emails"][0]["source"] == "manual"
    assert hydrated["emails"][0]["syncStatus"] == "synced"
    assert hydrated["emails"][0]["version"] == 1
    assert hydrated["phones"][0]["value"] == "0600000000"
    assert hydrated["phones"][0]["source"] == "manual"
    assert hydrated["addresses"][0]["line1"] == "12 rue de la Paix"
    assert hydrated["addresses"][0]["city"] == "Paris"
    assert hydrated["companyInfo"]["tradeName"] == "Dupont SARL"
    assert hydrated["isFavorite"] is False
    assert hydrated["tags"] == []


def test_client_public_keeps_flat_scalars_for_backward_compat():
    legacy = {
        "id": "c2",
        "name": "Martin",
        "email": "m@example.com",
        "phone": "0700000000",
        "address": "1 avenue",
        "city": "Lyon",
        "status": "new",
        "createdAt": "2026-01-01T00:00:00+00:00",
        "updatedAt": "2026-01-01T00:00:00+00:00",
    }
    public = client_public(legacy)
    assert public.email == "m@example.com"
    assert public.phone == "0700000000"
    assert public.address == "1 avenue"
    assert public.city == "Lyon"
    assert len(public.emails) == 1
    assert public.emails[0].value == "m@example.com"
    assert public.emails[0].source == "manual"
    assert public.emails[0].syncStatus == "synced"
    assert public.schemaVersion >= 3


def test_build_client_document_dual_writes_nested_and_flat():
    body = ClientCreate(
        name="Alice",
        email="alice@example.com",
        phone="0611111111",
        address="5 place",
        city="Nantes",
        tags=["vip", "VIP", " chantier "],
        isFavorite=True,
    )
    doc = build_client_document("user-1", body)
    assert doc["email"] == "alice@example.com"
    assert doc["emails"][0]["value"] == "alice@example.com"
    assert doc["phones"][0]["value"] == "0611111111"
    assert doc["addresses"][0]["city"] == "Nantes"
    assert doc["isFavorite"] is True
    assert doc["tags"] == ["vip", "chantier"]
    assert doc["schemaVersion"] == 3
    assert doc["emails"][0]["source"] == "manual"
    assert doc["phones"][0]["syncStatus"] == "synced"


def test_update_flat_email_marks_user_modification_on_primary():
    existing = build_client_document(
        "user-1",
        ClientCreate(name="Bob", email="old@example.com", status="active"),
    )
    merged, _ = apply_client_updates(
        existing,
        ClientUpdate(email="new@example.com"),
    )
    assert merged["email"] == "new@example.com"
    assert merged["emails"][0]["value"] == "new@example.com"
    assert merged["emails"][0]["isPrimary"] is True
    assert merged["emails"][0]["isUserModified"] is True
    assert merged["emails"][0]["version"] >= 2


def test_update_nested_emails_syncs_flat_primary():
    existing = build_client_document(
        "user-1",
        ClientCreate(name="Carla", email="a@example.com", status="active"),
    )
    merged, _ = apply_client_updates(
        existing,
        ClientUpdate(
            emails=[
                {"id": "e1", "value": "billing@example.com", "label": "billing", "isPrimary": True},
                {"id": "e2", "value": "perso@example.com", "label": "personal", "isPrimary": False},
            ]
        ),
    )
    assert merged["email"] == "billing@example.com"
    assert len(merged["emails"]) == 2


def test_display_name_prefers_company():
    assert client_display_name({"company": "ACME", "name": "Jean"}) == "ACME"
    assert client_display_name({"company": "  ", "name": "Jean"}) == "Jean"


def test_max_iso_datetime_picks_latest():
    assert max_iso_datetime("2026-01-01T00:00:00Z", "2026-07-01T12:00:00Z") == "2026-07-01T12:00:00Z"
    assert max_iso_datetime(None, "", "2026-03-01T00:00:00Z") == "2026-03-01T00:00:00Z"
    assert max_iso_datetime(None, "") is None


def test_merge_client_list_stats_prefers_newer_resource_activity():
    client_doc = {
        "updatedAt": "2026-01-01T00:00:00+00:00",
        "createdAt": "2025-12-01T00:00:00+00:00",
    }
    merged = merge_client_list_stats(
        client_doc,
        {
            "totalRevenue": 12000,
            "documentsCount": 3,
            "notesCount": 2,
            "lastActivityAt": "2026-07-20T10:00:00+00:00",
        },
    )
    assert merged["totalRevenue"] == 12000
    assert merged["documentsCount"] == 3
    assert merged["notesCount"] == 2
    assert merged["lastActivityAt"] == "2026-07-20T10:00:00+00:00"


def test_client_public_defaults_last_activity_to_updated_at():
    public = client_public(
        {
            "id": "c3",
            "name": "Legacy",
            "status": "active",
            "createdAt": "2026-01-01T00:00:00+00:00",
            "updatedAt": "2026-02-01T00:00:00+00:00",
        }
    )
    assert public.lastActivityAt == "2026-02-01T00:00:00+00:00"
    assert public.totalRevenue == 0
    assert public.documentsCount == 0
    assert public.notesCount == 0
