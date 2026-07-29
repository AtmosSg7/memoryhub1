# MemoryHub — Staging Go-Live V1

Guide opérationnel pour mettre en ligne l'environnement **staging** exploitable.

## Prérequis VPS

- Docker + Docker Compose v2
- MongoDB via compose (volume `mongo_staging_data`)
- Nom de domaine staging (HTTPS recommandé ; HTTP plain port 8080 pour tests locaux)
- Clés **Stripe test** (`sk_test_`, `whsec_`, price IDs test)
- **OpenAI** API key (analyse documents obligatoire)
- **SMTP** réel (transactionnel)

## Checklist rapide

1. Copier `deploy/.env.staging.example` → `deploy/.env`
2. Renseigner toutes les variables (aucun `fake` / `mock`)
3. `ENV=staging`, `DB_NAME=memoryhub_staging`
4. `ANALYZER_PROVIDER=openai`, `EMAIL_PROVIDER=smtp`, `CREDITS_ENFORCED=true`
5. `./deploy/scripts/validate-staging-env.sh`
6. `./deploy/scripts/deploy-staging.sh`
7. `./deploy/scripts/smoke-staging.sh`
8. Promouvoir admin : `docker compose exec backend python scripts/promote_admin.py founder@example.com`
9. Parcours manuel : register → email → login → client → devis → import → billing → portail → admin

## Plans commerciaux (source unique)

| Plan | Prix | Crédits/mois |
|------|------|--------------|
| Solo | 19 € | 1 000 |
| Pro  | 49 € | 5 000 |
| Team | 99 € | 15 000 |

Essai : **14 jours**

Backend : `backend/commercial_constants.py`  
Frontend : `frontend/src/constants/planConfig.js` + `translations.js` (affichage landing)

Les montants Stripe réels sont configurés via `STRIPE_PRICE_*` — doivent correspondre aux prix publics.

## Scripts

| Script | Rôle |
|--------|------|
| `deploy/scripts/validate-staging-env.sh` | Valide `.env` staging sans afficher les secrets |
| `deploy/scripts/deploy-staging.sh` | Build + up idempotent |
| `deploy/scripts/smoke-staging.sh` | Smoke HTTP (health, landing, providers) |
| `deploy/scripts/reset-staging.sh` | Reset DB staging (`CONFIRM_STAGING_RESET=yes`) |

Tous refusent `ENV=production`.

## Tests automatisés avant go-live

```bash
# Backend
cd backend && pytest -q

# E2E local
./scripts/e2e-start.sh
cd e2e && npm ci && npx playwright install --with-deps chromium
npm run test:chromium          # smoke CI
E2E_ALL_SPECS=1 npm run test:all  # suite complète
npm run test:accessibility
./scripts/e2e-stop.sh
```

## Observabilité

- `/api/health` — liveness
- `/api/ready` — Mongo ping
- Logs : `docker compose logs -f backend nginx`
- Checklist quotidienne : `docs/DAILY_OBSERVABILITY_CHECKLIST.md`

## Rollback

Voir `docs/ROLLBACK.md` — repoint image tag précédent, restaurer backup Mongo si nécessaire.

## Blocages connus

- **Mentions légales** : placeholders `[À RENSEIGNER]` dans `legalConfig.js` — à compléter avant production publique
- **Landing SearchDemo** : animation marketing (données fictives Didier Martin) — intentionnel pour la démo
- **Intégrations Gmail/Drive/Notion** : page Intégrations en attente — copy landing à ajuster si besoin avant prod
