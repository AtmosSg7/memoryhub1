# Action Engine

Channel-independent business action layer. No AI.

## Idea

Writers (Gmail, WhatsApp, SMS, phone, calendar, commercial lifecycle) produce
facts (`communications`, quotes, invoices). Rules decide which **persisted**
actions to create. The dashboard UI is not wired yet — API + hooks only.

## Collection `actions`

| Field | Notes |
|-------|--------|
| id, userId | |
| clientId, communicationId, eventId | optional links |
| type | e.g. `reply_to_prospect` |
| priority | `low \| normal \| high \| urgent` |
| status | `pending \| completed \| dismissed \| expired` |
| source | `communication \| invoice \| quote \| system` |
| title, description, metadata | |
| idempotencyKey | unique per user — prevents duplicates |
| createdAt, dueAt, completedAt | |
| snoozedUntil, snoozedAt, snoozedBy | postpone without leaving `pending` |
| previousDueAt | original dueAt preserved across snoozes |

Unique index: `(userId, idempotencyKey)`.

Snooze: `POST /api/actions/{id}/snooze` with `{ "until": "<ISO-8601>" }`.
Active lists/counts exclude `snoozedUntil > now` (no cron). Query flags:
`includeSnoozed`, `snoozedOnly`.

## Rules (configurable via env)

| Env | Action type | Trigger |
|-----|-------------|---------|
| `ACTION_RULE_REPLY_TO_PROSPECT` | `reply_to_prospect` | inbound messaging, no client, not noise |
| `ACTION_RULE_READ_CLIENT_REPLY` | `read_client_reply` | inbound messaging with clientId |
| `ACTION_RULE_CALL_BACK` | `call_back` | phone + missed flag |
| `ACTION_RULE_FOLLOW_UP_OVERDUE_INVOICE` | `follow_up_overdue_invoice` | invoice status overdue |
| `ACTION_RULE_CREATE_INVOICE_FROM_QUOTE` | `create_invoice_from_quote` | quote accepted, no invoiceId |

Master switch: `ACTION_ENGINE_ENABLED=true`.

## Hooks

- `communication_center.upsert_communication` → messaging rules
- `commercial_lifecycle.sync_overdue_invoices` → overdue invoice rule
- quote accept (dashboard + portal) → create invoice rule
- quote → invoice conversion completes the pending create-invoice action

## API

- `GET /api/actions`
- `GET /api/actions/count`
- `GET /api/actions/{id}`
- `POST /api/actions/{id}/complete`
- `POST /api/actions/{id}/dismiss`
- `POST /api/actions/evaluate/{communication|invoice|quote}/{id}`

## Frontend (no page yet)

- `frontend/src/constants/actionTypes.js`
- `frontend/src/lib/actionsApi.js`
- `frontend/src/hooks/useActions.js`
