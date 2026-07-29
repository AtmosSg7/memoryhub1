# Staging Smoke Test

## Automatique (script shell)

```bash
export STAGING_BASE_URL=https://staging.example.com   # ou http://127.0.0.1:8080
./deploy/scripts/smoke-staging.sh
```

Vérifie :

- Landing `/` → 200
- `/api/health` → 200
- `/api/ready` → 200
- `/health/frontend` → 200
- Login invalide → 4xx (pas 500)
- OpenAI configuré (`ANALYZER_PROVIDER=openai` + clé présente)
- SMTP configuré
- Stripe clé `sk_test_*`

## Automatique (Playwright)

```bash
./scripts/e2e-start.sh
cd e2e && npm run test:staging-smoke
```

Couvre : health API, landing, register, login, refresh dashboard, billing, garde admin.

## Manuel (15 min)

| # | Étape | Attendu |
|---|--------|---------|
| 1 | Ouvrir landing | Navbar, pricing Solo 19€ / 1000 crédits |
| 2 | Register | Redirection dashboard |
| 3 | Email vérification | Lien reçu (SMTP) ou dev bypass |
| 4 | Login / logout / re-login | Session cookie OK |
| 5 | Dashboard refresh F5 | KPIs chargent, pas d'écran blanc |
| 6 | Créer client | Visible liste clients |
| 7 | Créer devis | Ligne devis visible |
| 8 | Import PDF | OpenAI analyse, document créé |
| 9 | Billing | Plans solo/pro/team, crédits |
| 10 | Stripe checkout test | Redirection success/cancel |
| 11 | Portail client | Token, accepter devis |
| 12 | Admin | Admin OK, user standard refusé |

## Critères d'échec

- 500 sur `/api/*`
- Dashboard bloqué au loader > 15s
- `ANALYZER_PROVIDER=mock` ou `EMAIL_PROVIDER=fake` en staging
- Crédits non débités sur import IA (`CREDITS_ENFORCED=false`)
