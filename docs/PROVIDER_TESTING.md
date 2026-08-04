# Provider Testing — Staging

## Règles staging (backend `env_validation.py`)

| Provider | Variable | Staging | Production |
|----------|----------|---------|------------|
| OpenAI | `ANALYZER_PROVIDER=openai` | **Obligatoire** | Obligatoire |
| OpenAI | `OPENAI_API_KEY` | **Obligatoire** | Obligatoire |
| Email | `EMAIL_PROVIDER=smtp` | **Obligatoire** | Obligatoire |
| Email | `SMTP_*`, `SUPPORT_EMAIL` | Obligatoire | Obligatoire |
| Stripe | `STRIPE_SECRET_KEY` | `sk_test_*` only | `sk_live_*` |
| Stripe backend | `STRIPE_BACKEND` | Pas `fake`/`mock` | live/stripe |
| Crédits | `CREDITS_ENFORCED=true` | **Obligatoire** | Obligatoire |

Development / E2E local : `EMAIL_PROVIDER=fake`, `ANALYZER_PROVIDER=mock`, `STRIPE_BACKEND=fake` autorisés.

## Tests OpenAI

1. Upload PDF via Import wizard
2. Vérifier analyse < 60s
3. Vérifier débit crédits (`GET /api/credits/me`)
4. Logs backend : pas d'erreur 401 OpenAI

## Tests SMTP

1. Register nouveau compte → email vérification reçu
2. Envoi devis (email) → message reçu ou file d'attente sans 500
3. `docker compose logs backend | rg -i smtp`

Preview local (dev) : `python backend/scripts/preview_emails.py`

## Tests Stripe (test mode)

1. Billing → checkout Solo → carte test `4242…`
2. Webhook endpoint configuré sur dashboard Stripe
3. `STRIPE_WEBHOOK_SECRET` correspond au endpoint staging
4. Admin MRR cohérent avec plans (4,90 / 9,90 / 19,90 €)

## Validation env sans secrets

```bash
./deploy/scripts/validate-staging-env.sh
```

Refuse de s'exécuter si `ENV=production`.
