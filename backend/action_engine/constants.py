"""Action Engine constants and action types."""

from __future__ import annotations

# Persisted statuses
ACTION_STATUS_PENDING = "pending"
ACTION_STATUS_COMPLETED = "completed"
ACTION_STATUS_DISMISSED = "dismissed"
ACTION_STATUS_EXPIRED = "expired"

ACTION_STATUSES = (
    ACTION_STATUS_PENDING,
    ACTION_STATUS_COMPLETED,
    ACTION_STATUS_DISMISSED,
    ACTION_STATUS_EXPIRED,
)

# Priorities
ACTION_PRIORITY_LOW = "low"
ACTION_PRIORITY_NORMAL = "normal"
ACTION_PRIORITY_HIGH = "high"
ACTION_PRIORITY_URGENT = "urgent"

ACTION_PRIORITIES = (
    ACTION_PRIORITY_LOW,
    ACTION_PRIORITY_NORMAL,
    ACTION_PRIORITY_HIGH,
    ACTION_PRIORITY_URGENT,
)

# Business action types (channel-agnostic)
ACTION_TYPE_REPLY_TO_PROSPECT = "reply_to_prospect"
ACTION_TYPE_READ_CLIENT_REPLY = "read_client_reply"
ACTION_TYPE_CALL_BACK = "call_back"
ACTION_TYPE_FOLLOW_UP_OVERDUE_INVOICE = "follow_up_overdue_invoice"
ACTION_TYPE_CREATE_INVOICE_FROM_QUOTE = "create_invoice_from_quote"
# Accepted Communication Intelligence suggestions (user-confirmed only)
ACTION_TYPE_PREPARE_QUOTE = "prepare_quote"
ACTION_TYPE_HANDLE_COMPLAINT = "handle_complaint"
ACTION_TYPE_ANSWER_QUESTION = "answer_question"
ACTION_TYPE_FOLLOW_UP_COMMUNICATION = "follow_up_communication"
ACTION_TYPE_REVIEW_PAYMENT = "review_payment"
ACTION_TYPE_REVIEW_DOCUMENT = "review_document"
ACTION_TYPE_SCHEDULE_APPOINTMENT = "schedule_appointment"

ACTION_TYPES = (
    ACTION_TYPE_REPLY_TO_PROSPECT,
    ACTION_TYPE_READ_CLIENT_REPLY,
    ACTION_TYPE_CALL_BACK,
    ACTION_TYPE_FOLLOW_UP_OVERDUE_INVOICE,
    ACTION_TYPE_CREATE_INVOICE_FROM_QUOTE,
    ACTION_TYPE_PREPARE_QUOTE,
    ACTION_TYPE_HANDLE_COMPLAINT,
    ACTION_TYPE_ANSWER_QUESTION,
    ACTION_TYPE_FOLLOW_UP_COMMUNICATION,
    ACTION_TYPE_REVIEW_PAYMENT,
    ACTION_TYPE_REVIEW_DOCUMENT,
    ACTION_TYPE_SCHEDULE_APPOINTMENT,
)

# Communication types that can drive messaging rules
MESSAGING_COMMUNICATION_TYPES = frozenset(
    {"email", "whatsapp", "sms", "phone"}
)

# Source labels (where the fact originated — not the rule)
ACTION_SOURCE_COMMUNICATION = "communication"
ACTION_SOURCE_INVOICE = "invoice"
ACTION_SOURCE_QUOTE = "quote"
ACTION_SOURCE_SYSTEM = "system"
