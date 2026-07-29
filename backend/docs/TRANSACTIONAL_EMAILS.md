# Transactional Emails V1 — MemoryHub

Production-grade outbound email infrastructure: provider-agnostic, bilingual (FR/EN), HTML + text, journaled, retriable.

## Architecture

```
Business service (auth, documents, Stripe, portal)
        ↓
transactional_email_service.py   — high-level send_* API
        ↓
email_queue_service.dispatch_email()
        ↓
email_renderer.py                — HTML + text from template key
email_event_service.py           — append-only ledger (email_events)
        ↓
EmailProvider (smtp | console | fake | none)
```

**Rules enforced**

- No HTML in routes; no direct SMTP in business code
- Email failure never rolls back business actions (especially Stripe webhooks)
- Idempotency via `idempotencyKey` on `email_events`
- No full tokens in logs or ledger (`renderContext` strips token URLs)

## Environment variables

| Variable | Description | Default (dev) |
|----------|-------------|---------------|
| `EMAIL_PROVIDER` | `smtp`, `console`, `fake`, `none` | `console` (dev), `smtp` (prod) |
| `SMTP_HOST` | SMTP server hostname | — |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | Auth username | — |
| `SMTP_PASSWORD` | Auth password | — |
| `SMTP_FROM_EMAIL` | From address | — |
| `SMTP_FROM_NAME` | From display name | `MemoryHub` |
| `SMTP_USE_TLS` | `1` / `0` | `1` |
| `SMTP_TIMEOUT_SECONDS` | Connection timeout | `30` |
| `FRONTEND_PUBLIC_URL` | Base URL for links | `FRONTEND_URL` or `http://localhost:3000` |
| `SUPPORT_EMAIL` | Footer support address | `support@memoryhub.fr` |

Legacy: `SMTP_FROM` and `FRONTEND_URL` are still read as fallbacks.

### Development (`EMAIL_PROVIDER=console`)

- Writes HTML + text previews to `backend/email_previews/` (gitignored)
- Status `skipped` — **not** reported as sent
- No token values in preview meta files beyond demo scripts

### Production (`EMAIL_PROVIDER=smtp`)

- Requires `SMTP_HOST` + `SMTP_FROM_EMAIL`
- Misconfiguration logs an error and uses `none` provider (retries, never fake success)
- Frontend links must use HTTPS (`FRONTEND_PUBLIC_URL`)

## Templates

| Key | Trigger |
|-----|---------|
| `email_verification` | Registration |
| `password_reset` | Forgot password |
| `password_changed` | Reset password success |
| `welcome` | Email verified |
| `subscription_trial_started` | Stripe checkout (trial) |
| `subscription_activated` | Stripe checkout (paid) |
| `subscription_renewed` | `invoice.paid` (cycle) |
| `subscription_plan_changed` | Plan change (reserved) |
| `subscription_cancellation_scheduled` | Cancel at period end |
| `subscription_cancelled` | Subscription deleted |
| `subscription_reactivated` | Reactivation (reserved) |
| `subscription_payment_failed` | `invoice.payment_failed` |
| `subscription_expired` | Expiration (reserved) |
| `quote_sent` | Document send (email) |
| `invoice_sent` | Document send (email) |
| `portal_access` | Portal share email |
| `quote_accepted` | Portal quote acceptance → artisan |
| `payment_recorded` | Invoice payment recorded → client |

## Language selection

1. User `locale` / `language` field on `users`
2. Artisan locale for client-facing emails when dashboard `lang` is passed
3. French default

## Email ledger (`email_events`)

Fields: `id`, `userId`, `recipient`, `recipientHash`, `templateKey`, `subject`, `locale`, `status`, `provider`, `providerMessageId`, `referenceType`, `referenceId`, `idempotencyKey`, `renderContext`, `attempts`, `lastErrorCode`, `nextRetryAt`, `sentAt`, `createdAt`, `updatedAt`.

Statuses: `pending`, `sent`, `failed`, `retrying`, `skipped`.

Indexes: unique `id`, unique sparse `idempotencyKey`, `userId+createdAt`, `status+nextRetryAt`.

## Retries

- Attempts: immediate + 3 retries (60s, 5m, 30m backoff)
- `process_pending_email_retries(db)` in `email_queue_service.py` — call from a cron/job
- Designed to migrate to Redis/Celery without changing business callers

## Preview (development only)

- **API**: `GET /api/dev/emails/preview?template=…&locale=fr` (404 in production)
- **CLI**: `python backend/scripts/preview_emails.py`
- Demo data only; tokens marked `DEMO_TOKEN`

## Security

- Recipient validation + header-injection prevention
- Rate limits on document send and portal share
- Idempotency on sends and Stripe emails (`stripe-email:{eventId}:{template}`)
- No arbitrary send endpoint for users
- Portal/document ownership enforced in services

## Testing

```bash
cd backend
EMAIL_PROVIDER=fake pytest tests/test_transactional_emails.py -v
pytest  # full suite
```

`FakeEmailProvider` captures messages in tests (`conftest.py` autouse fixture).

## SMTP provider setup

### Brevo (Sendinblue)

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<your-brevo-login-email>
SMTP_PASSWORD=<smtp-key>
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=MemoryHub
```

### Postmark

```
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=<server-token>
SMTP_PASSWORD=<server-token>
```

### Generic

Any TLS SMTP with AUTH. Set `EMAIL_PROVIDER=smtp` and all variables above.

## Staging / production checklist

1. Set `ENV=production`, `EMAIL_PROVIDER=smtp`
2. Configure all SMTP variables (never commit secrets)
3. Set `FRONTEND_PUBLIC_URL=https://app.yourdomain.com`
4. Verify SPF/DKIM on sending domain
5. Send test via forgot-password + document send
6. Monitor `email_events` for `failed` / `retrying`
7. Schedule retry job for `process_pending_email_retries`

## Stripe emails

Webhook replay is safe: Stripe event idempotency + `stripe-email:{eventId}:{template}` on emails. Email errors are logged; webhook still returns 200 after business processing.

See also `backend/docs/STRIPE_INTEGRATION.md`.

## Diagnostics

| Symptom | Check |
|---------|-------|
| Status `skipped` | Dev console mode — configure SMTP for real sends |
| Status `retrying` | Temporary SMTP error — wait for retry job |
| Status `failed` | `lastErrorCode` in `email_events` (`auth_failed`, `recipient_refused`, …) |
| No email on register | `EMAIL_PROVIDER`, logs for `email_events` insert errors |
