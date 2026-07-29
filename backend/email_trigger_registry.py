"""Email trigger registry — architecture for automated transactional emails."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, List, Literal, Optional

EmailTriggerId = Literal[
    "quote_sent",
    "quote_viewed",
    "quote_accepted",
    "quote_rejected",
    "quote_expired",
    "quote_follow_up",
    "invoice_sent",
    "invoice_viewed",
    "invoice_due_soon",
    "invoice_overdue",
    "invoice_paid",
    "invoice_follow_up",
    "portal_access_shared",
]

TriggerChannel = Literal["transactional", "manual", "scheduled"]


@dataclass(frozen=True)
class EmailTriggerDefinition:
    id: EmailTriggerId
    entity_type: Literal["quote", "invoice", "client"]
    event_type: str
    channel: TriggerChannel
    template_key: str
    description: str
    implemented: bool


EMAIL_TRIGGER_REGISTRY: Dict[EmailTriggerId, EmailTriggerDefinition] = {
    "quote_sent": EmailTriggerDefinition(
        id="quote_sent",
        entity_type="quote",
        event_type="quote_sent",
        channel="transactional",
        template_key="quote_send",
        description="Email d'envoi de devis au client",
        implemented=True,
    ),
    "quote_viewed": EmailTriggerDefinition(
        id="quote_viewed",
        entity_type="quote",
        event_type="quote_viewed",
        channel="scheduled",
        template_key="quote_viewed_notify_artisan",
        description="Notification artisan — devis consulté sur le portail",
        implemented=False,
    ),
    "quote_accepted": EmailTriggerDefinition(
        id="quote_accepted",
        entity_type="quote",
        event_type="quote_accepted",
        channel="transactional",
        template_key="quote_accepted",
        description="Notification artisan — devis accepté",
        implemented=True,
    ),
    "quote_rejected": EmailTriggerDefinition(
        id="quote_rejected",
        entity_type="quote",
        event_type="quote_rejected",
        channel="transactional",
        template_key="quote_rejected",
        description="Notification artisan — devis refusé",
        implemented=True,
    ),
    "quote_expired": EmailTriggerDefinition(
        id="quote_expired",
        entity_type="quote",
        event_type="quote_expired",
        channel="scheduled",
        template_key="quote_expired",
        description="Notification artisan — devis expiré",
        implemented=False,
    ),
    "quote_follow_up": EmailTriggerDefinition(
        id="quote_follow_up",
        entity_type="quote",
        event_type="follow_up_recorded",
        channel="manual",
        template_key="quote_follow_up",
        description="Relance devis (manuel ou assisté)",
        implemented=True,
    ),
    "invoice_sent": EmailTriggerDefinition(
        id="invoice_sent",
        entity_type="invoice",
        event_type="invoice_sent",
        channel="transactional",
        template_key="invoice_send",
        description="Email d'envoi de facture au client",
        implemented=True,
    ),
    "invoice_viewed": EmailTriggerDefinition(
        id="invoice_viewed",
        entity_type="invoice",
        event_type="invoice_viewed",
        channel="scheduled",
        template_key="invoice_viewed_notify_artisan",
        description="Notification artisan — facture consultée sur le portail",
        implemented=False,
    ),
    "invoice_due_soon": EmailTriggerDefinition(
        id="invoice_due_soon",
        entity_type="invoice",
        event_type="invoice_due_soon",
        channel="scheduled",
        template_key="invoice_follow_up",
        description="Rappel échéance facture",
        implemented=True,
    ),
    "invoice_overdue": EmailTriggerDefinition(
        id="invoice_overdue",
        entity_type="invoice",
        event_type="invoice_overdue",
        channel="scheduled",
        template_key="invoice_follow_up",
        description="Alerte facture en retard",
        implemented=True,
    ),
    "invoice_paid": EmailTriggerDefinition(
        id="invoice_paid",
        entity_type="invoice",
        event_type="invoice_paid",
        channel="transactional",
        template_key="invoice_paid",
        description="Confirmation paiement facture",
        implemented=False,
    ),
    "invoice_follow_up": EmailTriggerDefinition(
        id="invoice_follow_up",
        entity_type="invoice",
        event_type="follow_up_recorded",
        channel="manual",
        template_key="invoice_follow_up",
        description="Relance facture (manuel ou assisté)",
        implemented=True,
    ),
    "portal_access_shared": EmailTriggerDefinition(
        id="portal_access_shared",
        entity_type="client",
        event_type="portal_access_shared",
        channel="transactional",
        template_key="portal_access",
        description="Lien portail client",
        implemented=True,
    ),
}


def list_email_triggers(*, implemented_only: bool = False) -> List[EmailTriggerDefinition]:
    items = list(EMAIL_TRIGGER_REGISTRY.values())
    if implemented_only:
        items = [item for item in items if item.implemented]
    return items


def resolve_trigger_for_event(event_type: str) -> Optional[EmailTriggerDefinition]:
    for trigger in EMAIL_TRIGGER_REGISTRY.values():
        if trigger.event_type == event_type:
            return trigger
    return None


async def dispatch_email_trigger(
    db,
    user_id: str,
    trigger_id: EmailTriggerId,
    *,
    entity_id: str,
    context: Optional[dict] = None,
) -> bool:
    """Dispatch hook for future automated emails. Returns True if sent."""
    trigger = EMAIL_TRIGGER_REGISTRY.get(trigger_id)
    if not trigger or not trigger.implemented:
        return False
    _ = (db, user_id, entity_id, context)
    return False
