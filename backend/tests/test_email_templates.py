from email_templates import (
    build_email_verification_email,
    build_invoice_follow_up_email,
    build_invoice_send_email,
    build_password_reset_email,
    build_portal_access_email,
    build_quote_follow_up_email,
    build_quote_send_email,
    resolve_sender_name,
)


def test_quote_send_without_portal_has_no_false_attachment_claim():
    email = build_quote_send_email(
        lang="fr",
        greeting="Jean Dupont",
        number="2026-0042",
        title="Travaux rénovation",
        amount_ttc=120000,
        sender_name="Martin Rénovation",
        portal_url=None,
    )
    assert email.subject == "Devis n°2026-0042"
    assert "joint" not in email.body.lower()
    assert "Télécharger PDF" in email.body
    assert "Martin Rénovation" in email.body
    assert email.preheader


def test_quote_send_with_portal_includes_link():
    email = build_quote_send_email(
        lang="fr",
        greeting="Jean",
        number="1",
        title="",
        amount_ttc=10000,
        sender_name="Entreprise Test",
        portal_url="https://app.memoryhub.fr/portal/abc",
    )
    assert "https://app.memoryhub.fr/portal/abc" in email.body
    assert "accepter" in email.body.lower()


def test_invoice_follow_up_partial_balance():
    email = build_invoice_follow_up_email(
        lang="fr",
        greeting="Sophie",
        number="FA-12",
        amount_ttc=100000,
        amount_due=50000,
        sender_name="Dupont SARL",
    )
    assert "Rappel — facture" in email.subject
    assert "reste à régler" in email.body.lower()
    assert "Sauf erreur" not in email.body


def test_resolve_sender_name_prefers_company():
    assert resolve_sender_name("  ACME  ", "fr") == "ACME"


def test_resolve_sender_name_falls_back_to_user_name():
    assert (
        resolve_sender_name("", "fr", first_name="Julie", last_name="Martin")
        == "Julie Martin"
    )


def test_auth_templates_are_branded():
    verify = build_email_verification_email(
        lang="fr",
        greeting="Julie",
        verify_url="https://app.memoryhub.fr/verify-email?token=x",
    )
    reset = build_password_reset_email(
        lang="fr",
        greeting="Julie",
        reset_url="https://app.memoryhub.fr/reset-password?token=x",
    )
    portal = build_portal_access_email(
        lang="fr",
        greeting="Client",
        sender_name="Martin Rénovation",
        portal_url="https://app.memoryhub.fr/portal/t",
    )
    assert "Basera" in verify.subject
    assert "Basera" in reset.subject
    assert "espace client" in portal.subject.lower()
    assert verify.preheader and reset.preheader and portal.preheader


def test_quote_follow_up_includes_portal_when_provided():
    email = build_quote_follow_up_email(
        lang="en",
        greeting="Alex",
        number="9",
        title="Kitchen",
        amount_ttc=50000,
        sender_name="Build Co",
        portal_url="https://example.com/portal/x",
    )
    assert "https://example.com/portal/x" in email.body
    assert " (« Kitchen »)" not in email.body
    assert " — Kitchen" in email.body
