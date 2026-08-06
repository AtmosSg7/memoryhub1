# Production secrets checklist — fill values in deploy/.env (never commit)

Copy `deploy/.env.production.example` to `deploy/.env` and replace every `CHANGE_ME`.

## Required — application

- [ ] `ENV=production`
- [ ] `PUBLIC_APP_URL` — public HTTPS URL (e.g. https://basera.fr)
- [ ] `FRONTEND_URL` — same as public app URL
- [ ] `FRONTEND_PUBLIC_URL` — same (email links)
- [ ] `BACKEND_PUBLIC_URL` — same (webhooks, API callbacks)
- [ ] `PORTAL_BASE_URL` — same (client portal links)
- [ ] `CORS_ORIGINS` — exact frontend origin(s), HTTPS only

## Required — security

- [ ] `JWT_SECRET` — random ≥ 32 characters
- [ ] `SENTRY_USER_SALT` — random salt (≠ dev default)

## Required — MongoDB (with docker-compose.production.yml)

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

- [ ] `STRIPE_SECRET_KEY` — `sk_live_…` (fichier `deploy/.env` / secrets host — jamais dans Git)
- [ ] `STRIPE_WEBHOOK_SECRET` — `whsec_…` (quand le webhook Live est créé)
- [ ] `STRIPE_PRICE_SOLO=price_1U0ogXH44aox1nDPS97Gx7Vg` (Starter 4,90 €)
- [ ] `STRIPE_PRICE_PRO=price_1U0ogjH44aox1nDPsQvh4rgY` (Pro 9,90 €)
- [ ] `STRIPE_PRICE_TEAM=price_1U0ogwH44aox1nDPIqCVldxr` (Business 19,90 €)
- [ ] `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`

## Required — storage

- [ ] `STORAGE_BACKEND=local`
- [ ] `LOCAL_UPLOAD_DIR=/app/uploads` (set by compose)
- [ ] `MAX_UPLOAD_BYTES`

## Required — product

- [ ] `CREDITS_ENFORCED=true`

## Optional

- [ ] `SENTRY_DSN` — error monitoring
- [ ] `OPENAI_API_KEY` — **required** in production (`ANALYZER_PROVIDER` must be `openai`)
- [ ] S3 variables — if `STORAGE_BACKEND=s3`

## Optional — Google integrations (Contacts + Gmail)

Omit all variables below to disable real Google OAuth (integrations stay unavailable in deployed env until configured).

### Google Cloud Console setup

1. Create or select a Google Cloud project.
2. Enable APIs: **Google People API**, **Gmail API**.
3. OAuth consent screen: configure app name, support email, scopes; while in **Testing**, add each tester Google account under **Test users**.
4. Credentials → **Create credentials** → **OAuth client ID** → type **Web application**.
5. **Authorized redirect URIs** (HTTPS in staging/production; must match env exactly):
   - Contacts: `https://<backend-host>/api/integrations/google-contacts/callback`
   - Gmail: `https://<backend-host>/api/integrations/gmail/callback`
6. **Authorized JavaScript origins**: not required (OAuth uses server-side redirect only; the frontend never receives the authorization code).

Local development redirect URIs (from `backend/.env.example`):

- `http://localhost:8000/api/integrations/google-contacts/callback`
- `http://localhost:8000/api/integrations/gmail/callback`

### Environment variables

- [ ] `GOOGLE_CLIENT_ID` — OAuth client ID (public)
- [ ] `GOOGLE_CLIENT_SECRET` — **never commit**; store only in `deploy/.env`
- [ ] `GOOGLE_REDIRECT_URI` — Contacts callback URL (HTTPS in production)
- [ ] `GOOGLE_GMAIL_REDIRECT_URI` — Gmail callback URL (HTTPS in production)
- [ ] `FRONTEND_PUBLIC_URL` — post-OAuth redirect target (`/dashboard/integrations`)
- [ ] `BACKEND_PUBLIC_URL` — public backend base URL (fallback for callback paths)
- [ ] `INTEGRATIONS_TOKEN_KEY` — dedicated secret ≥ 32 characters for Fernet token encryption; **never commit**; **do not reuse `JWT_SECRET`**; changing it invalidates encrypted tokens in MongoDB

Provider mode is auto-detected: when all required credentials for an integration are set, the server uses `google`; otherwise integrations are off in deployed env. Do not set `INTEGRATIONS_CONTACTS_PROVIDER=mock` or `INTEGRATIONS_GMAIL_PROVIDER=mock` in staging or production.

Optional scope overrides (defaults are read-only):

- `GOOGLE_CONTACTS_SCOPES` — default: `contacts.readonly openid email profile`
- `GOOGLE_GMAIL_SCOPES` or `GMAIL_SCOPES` — default: `gmail.readonly openid email profile`

Gmail auto-sync (scheduler — **not secrets**, safe to commit as defaults):

- [ ] `GMAIL_AUTO_SYNC_ENABLED=true`
- [ ] `GMAIL_AUTO_SYNC_INTERVAL_MINUTES=10` (minimum enforced: 5)
- [ ] `GMAIL_AUTO_SYNC_BATCH_SIZE=25`
- [ ] `GMAIL_AUTO_SYNC_TIMEOUT_SECONDS=60`

Action Engine / Communication Intelligence (product flags — **not secrets**):

- [ ] `ACTION_ENGINE_ENABLED=true` (or `false` to disable action generation)
- [ ] `COMMUNICATION_INTELLIGENCE_ENABLED=false` until explicitly approved
- [ ] `COMMUNICATION_INTELLIGENCE_AUTO_ON_INGEST=false`
- [ ] If CI is enabled later: `COMMUNICATION_INTELLIGENCE_PROVIDER=openai` (mock is rejected when deployed)

Forbidden in production:

- [ ] `ALLOW_E2E_SEED` unset / false
- [ ] `E2E_DISABLE_RATE_LIMIT` unset
- [ ] `DB_NAME` is **not** `memoryhub_e2e` (use product DB, e.g. `basera`)
- [ ] `INTEGRATIONS_GMAIL_PROVIDER` / `INTEGRATIONS_CONTACTS_PROVIDER` not set to `mock`

### Post-config verification

- [ ] `GET /api/integrations/google-contacts/status` → `providerMode: "google"`, `configured: true`
- [ ] `GET /api/integrations/gmail/status` → `providerMode: "google"`, `configured: true`
- [ ] Manual OAuth smoke test with a test-user Google account

## TLS certificates

- [ ] `deploy/certs/fullchain.pem`
- [ ] `deploy/certs/privkey.pem`

## Post-deploy verification

- [ ] `curl -fsS https://<domain>/health`
- [ ] `curl -fsS https://<domain>/health/backend/ready`
- [ ] Register + login smoke test
- [ ] `deploy/scripts/backup-all.sh` succeeds
- [ ] Stripe webhook test event in Dashboard
