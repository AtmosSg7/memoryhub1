# Basera — Staging

Environnement de pré-production isolé de la production.

## Objectifs staging

- Tester déploiements avant production
- Stripe **mode test** (`sk_test_…`)
- SMTP de test (Brevo sandbox, Mailtrap, etc.)
- Base MongoDB **distincte**
- Données non production

## Déploiement

```bash
cp deploy/.env.staging.example deploy/.env
# Renseigner domaine staging, clés Stripe test, SMTP test

docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build
```

## Différences vs production

| Aspect | Staging | Production |
|--------|---------|------------|
| `ENV` | `staging` | `production` |
| `DB_NAME` | `memoryhub_staging` | `memoryhub` |
| Port 8080 HTTP | Exposé (tests sans TLS) | **Non exposé** |
| Stripe | `sk_test_…` | `sk_live_…` |
| Mongo auth | Optionnel (compose base) | Obligatoire (`compose.prod`) |
| `CREDITS_ENFORCED` | Selon besoin | `true` |

## Accès

- HTTPS : `https://staging.example.com` (certificat staging)
- HTTP plain : `http://staging.example.com:8080` (tests internes uniquement)

## Protection accès (recommandé)

- Restreindre staging par IP (firewall nginx ou VPN)
- Ou basic auth nginx (non inclus V1 — à ajouter si besoin)

## Checklist staging

- [ ] Domaine staging distinct
- [ ] Webhook Stripe test pointant vers `https://staging…/api/stripe/webhook`
- [ ] Aucune clé `sk_live_` dans `deploy/.env` staging
- [ ] Aucune copie de dump production sur staging
