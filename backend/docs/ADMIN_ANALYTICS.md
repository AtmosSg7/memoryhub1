# Admin Analytics & Operations V1

Internal founder dashboard — **not** exposed to artisan users.

## Security

- Admin role is resolved **server-side only** via:
  - `users.role = "admin"` (set with `scripts/promote_admin.py`), or
  - email listed in `ADMIN_EMAILS` (comma-separated, lowercase)
- `require_admin()` protects every `/api/admin/*` route (403 for normal users).
- Frontend `/admin` checks `user.isAdmin` from `GET /api/auth/me` for UX only.
- No public endpoint to self-promote. No role accepted from client payloads.
- Admin actions append to `admin_audit_logs` (no update/delete API).
- Rate limit: 120 requests/hour per admin session (`admin_rate_limit`).
- CSV exports are logged in audit trail.

### First administrator

```bash
cd backend
python scripts/promote_admin.py founder@example.com
```

Or set `ADMIN_EMAILS=founder@example.com` before first login (bootstrap only).

## Data sources (source of truth)

| Metric | Collection | Notes |
|--------|------------|-------|
| Signups | `users.createdAt` | Total / new in period |
| Active user | `events`, `import_sessions`, `credit_transactions` | Distinct `userId` with activity in period |
| Activation | `users` + lookups | ≥1 `clients` AND (≥1 `quotes` OR `invoices` OR `import_sessions`) |
| Subscriptions | `user_subscriptions` | Status & plan breakdown |
| Subscription history | `subscription_history` | Churn, trial→paid |
| MRR | `user_subscriptions` + env prices | See below |
| Credits consumed | `credit_transactions` | `type=debit`, sum `costApplied` |
| OpenAI usage | `ai_usage_events` | Tokens + estimated USD |
| Imports | `import_sessions` + `ai_usage_events` | Sessions by status; `analysisFailed` = `ai_usage_events` where `actionKey=IMPORT_DOCUMENT` and `success=false` |
| Emails | `email_events` | sent / failed / retrying |
| Stripe failures | `stripe_events` | `status=failed` |
| Admin actions | `admin_audit_logs` | Append-only |

We **do not** duplicate product events into a new collection when existing data suffices.

## Metric definitions

### Active user (period)

User with ≥1 record in any of:

- `events` (`createdAt` in period)
- `import_sessions` (`createdAt` in period)
- `credit_transactions` debit (`createdAt` in period)

### Activation

Account with ≥1 client **and** at least one of: quote, invoice, or AI import session.

### Trial → paid

User with `subscription_history.event = trial_started` and later `activated` or `renewed`.

### Churn (period)

Count of `subscription_history` where `event ∈ {cancelled, expired}` in period.

### MRR (estimated)

```
MRR = Σ ADMIN_MRR_<PLAN>_EUR for each subscription in {trial, active, past_due}
```

- Currency: **EUR**
- Source label: `catalog_estimate` when env prices set, else `not_configured`
- **Not** Stripe invoice amounts — configure real catalog prices:

```env
ADMIN_MRR_SOLO_EUR=4.9
ADMIN_MRR_PRO_EUR=9.9
ADMIN_MRR_TEAM_EUR=19.9
```

### Gross AI margin (overview)

When MRR configured and known AI cost > 0:

```
revenueEur = MRR
aiCostUsd = sum(ai_usage_events.estimatedCostUsd where costKnown=true, last 30d)
```

Disclaimer: excludes infra, SMTP, Stripe fees. USD cost not converted to EUR automatically.

## OpenAI cost tracking

Collection: `ai_usage_events`

Recorded on each import analysis (`record_import_ai_usage`), idempotent per session:

- `idempotencyKey = ai-usage:import:{sessionId}`

Fields: model, input/output/total tokens, durationMs, success, `estimatedCostUsd`, `costKnown`.

Pricing: `ai_cost_config.py` — USD per 1M tokens per model.

Override via env:

```env
OPENAI_INPUT_USD_PER_1M_GPT_4O_MINI=0.15
OPENAI_OUTPUT_USD_PER_1M_GPT_4O_MINI=0.60
```

If model unknown: tokens stored, `costKnown=false`, `estimatedCostUsd=null` — **never invented**.

## Admin API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/overview` | KPIs + alerts |
| GET | `/api/admin/users` | Paginated user list |
| GET | `/api/admin/users/{id}` | Account detail |
| GET | `/api/admin/subscriptions` | Paginated subscriptions |
| GET | `/api/admin/ai-usage` | AI events + summary |
| GET | `/api/admin/imports` | Import sessions |
| GET | `/api/admin/credits` | Credit ledger slice |
| GET | `/api/admin/emails` | Email events |
| GET | `/api/admin/errors` | Operational failures |
| GET | `/api/admin/system-health` | Mongo + alerts |
| POST | `/api/admin/users/{id}/grant-credits` | Grant credits (reason required) |
| POST | `/api/admin/users/{id}/suspend` | Suspend account |
| POST | `/api/admin/users/{id}/resume` | Resume account |
| POST | `/api/admin/users/{id}/resend-verification` | Resend verify email |
| POST | `/api/admin/credits/simulate` | Non-persisted credit simulation |
| GET | `/api/admin/export/{resource}` | CSV export (users, subscriptions, ai-usage, credits, imports, emails) |

Query: `period=today|7d|30d` or `from` + `to` (max 366 days).

## Admin actions (V1)

| Action | Audit `action` | Notes |
|--------|----------------|-------|
| Grant credits | `grant_credits` | Via `billing_service.grant_admin_credits` |
| Suspend account | `suspend_account` | Sets `accountStatus=suspended`, blocks login |
| Resume account | `resume_account` | Clears suspension |
| Resend verification | `resend_verification` | New token + email |
| CSV export | `export_csv` | Logged with period |

## Operational alerts (in-app)

Displayed in overview / system-health:

- Stripe webhook failures (24h)
- Email permanent failures (24h)
- Import failures (7d)
- Subscriptions past_due
- AI events with unknown cost (7d)

No external notifications in V1 — architecture ready for Sentry/email later.

## Indexes

Created at startup (`server.py`):

- `ai_usage_events`: id, idempotencyKey (unique partial), userId+createdAt, createdAt, actionKey+createdAt
- `admin_audit_logs`: id, createdAt, adminUserId+createdAt
- `users`: role (sparse), accountStatus (sparse)
- `events`: createdAt
- `stripe_events`: status+createdAt
- `email_events`: status+updatedAt, createdAt

## RGPD & data minimization

Admin UI shows account-level data only — no document content, client PII beyond counts, passwords, tokens, or API keys.

Exports limited to `ADMIN_EXPORT_MAX_ROWS` (5000) and require admin auth.

## Incident procedure

1. Check `/admin/system` — Mongo readiness, email retries, alerts.
2. Review `/admin/errors` — Stripe, imports, emails.
3. Inspect `admin_audit_logs` for recent admin actions.
4. For user issues: `/admin/users/{id}` — subscription, credits, failed emails.
5. OpenAI cost spike: `/admin/ai` — top consumers, unknown model rates.

## Limits & performance

- Pagination: default 25, max 100 per list.
- Aggregations run in MongoDB — no full collection scan in Python.
- `daily_metrics` not implemented in V1 — add if overview latency grows.
