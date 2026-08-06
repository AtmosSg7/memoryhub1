"""Channel-independent Action Engine.

Writers (Gmail, WhatsApp, SMS, phone, calendar, commercial lifecycle) emit
facts. Rules decide which persisted actions to create. No AI in this package.
"""

from action_engine.engine import evaluate_communication, evaluate_invoice, evaluate_quote
from action_engine.service import (
    complete_action,
    dismiss_action,
    list_actions,
    snooze_action,
)

__all__ = [
    "evaluate_communication",
    "evaluate_invoice",
    "evaluate_quote",
    "list_actions",
    "complete_action",
    "dismiss_action",
    "snooze_action",
]
