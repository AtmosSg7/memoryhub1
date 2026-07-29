# Production secrets checklist — fill values in deploy/.env (never commit)

Copy `deploy/.env.production.example` to `deploy/.env` and replace every `CHANGE_ME`.

## Required — application

- [ ] `ENV=production`
- [ ] `PUBLIC_APP_URL` — public HTTPS URL (e.g. https://app.example.com)
- [ ] `FRONTEND_URL` — same as public app URL
- [ ] `FRONTEND_PUBLIC_URL` — same (email links)
- [ ] `BACKEND_PUBLIC_URL` — same (webhooks, API callbacks)
- [ ] `PORTAL_BASE_URL` — same (client portal links)
- [ ] `CORS_ORIGINS` — exact frontend origin(s), HTTPS only

## Required — security

- [ ] `JWT_SECRET` — random ≥ 32 characters
- [ ] `SENTRY_USER_SALT` — random salt (≠ dev default)

## Required — MongoDB (with docker-compose.prod.yml)

- [ ] `MONGO_ROOT_USERNAME`
- [ ] `MONGO_ROOT_PASSWORD` — strong password
- [ ] `DB_NAME` — production database name
- [ ] `MONGO_URL` — set automatically by compose prod override (do not expose port 27017)

## Required — email (SMTP)

- [ ] `EMAIL_PROVIDER=smtp`
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- [ ] `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`
- [ ] `SUPPORT_EMAIL`

## Required — Stripe (live)

- [ ] `STRIPE_SECRET_KEY` — `sk_live_…`
- [ ] `STRIPE_WEBHOOK_SECRET` — `whsec_…`
- [ ] `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`
- [ ] `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`

## Required — storage

- [ ] `STORAGE_BACKEND=local`
- [ ] `LOCAL_UPLOAD_DIR=/app/uploads` (set by compose)
- [ ] `MAX_UPLOAD_BYTES`

## Required — product

- [ ] `CREDITS_ENFORCED=true`

## Optional

- [ ] `SENTRY_DSN` — error monitoring
- [ ] `OPENAI_API_KEY` — if `ANALYZER_PROVIDER=openai`
- [ ] S3 variables — if `STORAGE_BACKEND=s3`

## TLS certificates

- [ ] `deploy/certs/fullchain.pem`
- [ ] `deploy/certs/privkey.pem`

## Post-deploy verification

- [ ] `curl -fsS https://<domain>/health`
- [ ] `curl -fsS https://<domain>/health/backend/ready`
- [ ] Register + login smoke test
- [ ] `deploy/scripts/backup-all.sh` succeeds
- [ ] Stripe webhook test event in Dashboard
