"""Follow-up engine and email trigger registry tests."""

from email_trigger_registry import EMAIL_TRIGGER_REGISTRY, list_email_triggers, resolve_trigger_for_event


def test_email_trigger_registry_has_lifecycle_triggers():
    triggers = list_email_triggers()
    ids = {item.id for item in triggers}
    assert "quote_sent" in ids
    assert "quote_accepted" in ids
    assert "invoice_sent" in ids
    assert "invoice_paid" in ids
    assert EMAIL_TRIGGER_REGISTRY["quote_viewed"].implemented is False


def test_resolve_trigger_for_quote_sent_event():
    trigger = resolve_trigger_for_event("quote_sent")
    assert trigger is not None
    assert trigger.id == "quote_sent"
