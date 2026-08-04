# Basera V1 — Release Checklist

Checklist finale avant **staging**, **bêta fermée** et **production**.

Cochez chaque item. Les sections marquées **(bloquant)** doivent être 100 % vertes.

---

## Gates automatisés CI (bloquant)

- [ ] Backend pytest : `cd backend && EMAIL_PROVIDER=fake ANALYZER_PROVIDER=mock pytest -q`
- [ ] Frontend build : `cd frontend && CI=true npm run build`
- [ ] Scan secrets (pas de `sk_live_` / `sk-` OpenAI dans le repo)
- [ ] Docker build : backend, frontend, nginx
- [ ] E2E smoke Chromium : `cd e2e && npm run test:chromium`
- [ ] E2E beta V1 : `cd e2e && npm run test:beta-smoke`
- [ ] Accessibilité axe : `cd e2e && npm run test:accessibility`

```bash
# Commandes locales complètes
cd backend && EMAIL_PROVIDER=fake ANALYZER_PROVIDER=mock pytest -q
cd frontend && CI=true npm run build
./scripts/e2e-start.sh
cd e2e && npm ci && npx playwright install chromium && npm run test:chromium && npm run test:beta-smoke
./scripts/e2e-stop.sh
```

---

## Variables d'environnement (bloquant)

### Production (`ENV=production`)

- [ ] `JWT_SECRET` — aléatoire ≥ 32 caractères (≠ dev default)
- [ ] `SENTRY_USER_SALT` — changé (≠ `memoryhub-dev-sentry-salt`)
- [ ] `MONGO_URL` — avec credentials (`user:pass@mongo`)
- [ ] `DB_NAME` — nom production
- [ ] `FRONTEND_URL` / `FRONTEND_PUBLIC_URL` — HTTPS
- [ ] `BACKEND_PUBLIC_URL` — HTTPS (webhooks, liens API)
- [ ] `PORTAL_BASE_URL` — HTTPS
- [ ] `CORS_ORIGINS` — origine(s) HTTPS exacte(s), pas `*`
- [ ] `LOCAL_UPLOAD_DIR=/app/uploads` (chemin absolu)
- [ ] `CREDITS_ENFORCED=true`
- [ ] `ANALYZER_PROVIDER=openai` + `OPENAI_API_KEY`
- [ ] `EMAIL_PROVIDER=smtp` + SMTP complet + `SUPPORT_EMAIL`
- [ ] `DEV_CREDIT_PURCHASES_ENABLED` — absent ou `false`
- [ ] `E2E_DISABLE_RATE_LIMIT` — absent
- [ ] `ALLOW_E2E_SEED` — absent
- [ ] Validation : `python3 -c "import os; os.environ.update({...}); from env_validation import validate_production_env; validate_production_env()"`

### Staging (`ENV=staging`)

- [ ] Mêmes garde-fous sauf Stripe `sk_test_...`
- [ ] `STRIPE_BACKEND` ≠ `fake` / `mock`
- [ ] `EMAIL_PROVIDER` ≠ `fake` / `console`
- [ ] `./deploy/scripts/validate-staging-env.sh` OK

---

## Stripe Production (bloquant prod)

- [ ] Compte Stripe activé (paiements live)
- [ ] `STRIPE_SECRET_KEY=sk_live_...`
- [ ] `STRIPE_WEBHOOK_SECRET=whsec_...`
- [ ] Prix créés : Starter / Pro / Business (4,90 / 9,90 / 19,90 €) → `STRIPE_PRICE_SOLO` / `PRO` / `TEAM`
- [ ] URLs checkout : `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`
- [ ] Webhook endpoint : `https://<domaine>/api/stripe/webhook`
- [ ] Événements webhook : `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
- [ ] Customer Portal activé dans Stripe Dashboard
- [ ] Test paiement réel (petit montant) + remboursement

---

## Webhooks (bloquant prod)

- [ ] Endpoint accessible depuis Internet (HTTPS)
- [ ] Signature vérifiée (`STRIPE_WEBHOOK_SECRET`)
- [ ] Replay idempotent testé (pytest `test_stripe_integration`)
- [ ] Logs webhook sans 4xx/5xx après checkout test

---

## Domaine & réseau (bloquant prod)

- [ ] Domaine enregistré (ex. `app.memoryhub.fr`)
- [ ] DNS A record → IP VPS
- [ ] **HTTPS** actif (Let's Encrypt ou certificat fourni)
- [ ] Redirection HTTP → HTTPS
- [ ] Ports 80/443 ouverts ; **27017 fermé** publiquement
- [ ] Certificats dans `deploy/certs/fullchain.pem` + `privkey.pem`

---

## MongoDB (bloquant prod)

- [ ] Authentification activée (`docker-compose.production.yml`)
- [ ] Volume persistant `mongo_data`
- [ ] Indexes migrés : `python scripts/migrate_indexes.py`
- [ ] `./deploy/scripts/check-database.sh` OK
- [ ] Pas de données de test/dev en production

---

## Mongo Backup (bloquant prod)

- [ ] `deploy/scripts/backup-mongodb.sh` testé manuellement
- [ ] `deploy/scripts/backup-uploads.sh` testé
- [ ] Cron installé : `sudo ./deploy/scripts/install-cron.sh /opt/memoryhub`
- [ ] Restauration testée sur instance isolée (`docs/BACKUPS.md`)
- [ ] Copies hors-site (S3 / autre serveur) configurées
- [ ] `deploy/backups/cron.log` surveillé

---

## Monitoring & logs (bloquant prod)

- [ ] `SENTRY_DSN` configuré
- [ ] Erreurs backend visibles dans Sentry
- [ ] Log rotation : `deploy/logrotate/memoryhub`
- [ ] Logs Docker limités (`max-size: 10m`, `max-file: 5`)
- [ ] Health checks : `/health`, `/api/health`, `/api/ready`
- [ ] Checklist quotidienne : `docs/DAILY_OBSERVABILITY_CHECKLIST.md`

---

## Sentry (bloquant prod)

- [ ] Projet Sentry créé
- [ ] `SENTRY_DSN` dans `deploy/.env`
- [ ] `SENTRY_USER_SALT` unique
- [ ] Frontend `REACT_APP_SENTRY_DSN` au build (si utilisé)
- [ ] Alerte email sur erreurs critiques

---

## Cron & tâches planifiées (bloquant prod)

- [ ] Service `scheduler` actif (relances, emails, expiration devis)
- [ ] Backup quotidien 03:00 UTC
- [ ] `run_scheduled_tasks.py --loop` sans erreur dans les logs

---

## Emails (bloquant prod)

- [ ] `EMAIL_PROVIDER=smtp`
- [ ] SMTP testé : vérification email, reset password
- [ ] `SMTP_FROM_EMAIL` = domaine autorisé (SPF/DKIM)
- [ ] `SUPPORT_EMAIL` monitoré par l'équipe
- [ ] Pas de `fake` / `console` provider

---

## IA & crédits (bloquant prod)

- [ ] `ANALYZER_PROVIDER=openai` (pas `mock`)
- [ ] `OPENAI_API_KEY` valide avec quota suffisant
- [ ] `CREDITS_ENFORCED=true`
- [ ] Essai 14 jours à l'inscription (plan Solo)
- [ ] Import bloqué proprement si 0 crédit (message + lien billing)
- [ ] Métriques admin IA : `/admin/ai`

---

## Docker & CI/CD (bloquant)

- [ ] Images buildées avec `IMAGE_TAG=<git-sha>`
- [ ] `docker-compose.production.yml` : limites mémoire, Mongo auth, scheduler
- [ ] Nginx : TLS, security headers, cache static
- [ ] GitHub Actions CI verte sur `main`
- [ ] Pas de secrets dans le repo

---

## Sécurité applicative (bloquant prod)

- [ ] OpenAPI `/api/docs` désactivé (staging + prod)
- [ ] Routes dev désactivées : `/api/subscriptions/dev/*`, `/api/credits/dev/*`, `/api/dev/emails/*`
- [ ] Rate limits actifs (`E2E_DISABLE_RATE_LIMIT` absent)
- [ ] Admin protégé (`ADMIN_EMAILS` + `promote_admin.py`)
- [ ] Isolation utilisateur (pytest `test_isolation_api`)
- [ ] Portail : token scoping, double accept 409 (pytest `test_portal_api`)
- [ ] Comptes suspendus → 403

---

## Tests (bloquant)

| Domaine | Couverture auto |
|---------|-----------------|
| Auth | `test_auth_api`, `test_rc_critical_paths` |
| Devis / factures | `test_commercial_api`, `test_rc_commercial_totals` |
| Portail | `test_portal_api`, `test_commercial_lifecycle` |
| Stripe | `test_stripe_integration` |
| Crédits / IA | `test_credit_engine`, `test_imports_api` |
| Emails | `test_transactional_emails` |
| Admin | `test_admin_api` |
| Env prod | `test_rc_env_production` |
| UI smoke | `e2e/tests/beta-v1-smoke.spec.js`, `rc-smoke.spec.ts` |

---

## Build & déploiement (bloquant)

- [ ] `npm run build` frontend sans erreur
- [ ] Backend démarre avec `ENV=production` + `.env` rempli
- [ ] `./deploy/scripts/deploy-staging.sh` OK (staging)
- [ ] `./deploy/scripts/smoke-staging.sh` OK (staging)
- [ ] `GO_LIVE.md` lu et compris par l'opérateur

---

## Smoke tests manuels (bloquant bêta)

- [ ] Register → login → logout
- [ ] Client → note → devis → facture
- [ ] Devis envoyé → portail → acceptation → PDF
- [ ] Facture → paiement partiel → paiement total
- [ ] Import PDF réel (OpenAI)
- [ ] Billing → checkout Stripe → abonnement actif
- [ ] Page Entreprise → profil sauvegardé → PDF devis
- [ ] Mobile : dashboard + fiche client utilisables
- [ ] Admin : overview, utilisateurs (compte admin uniquement)

---

## Rollback (bloquant prod)

- [ ] Procédure documentée : `docs/ROLLBACK.md` + `GO_LIVE.md`
- [ ] `IMAGE_TAG` du commit stable identifié
- [ ] Backup pré-déploiement obligatoire
- [ ] Test rollback sur staging effectué au moins une fois

---

## Contenu & légal (bloquant bêta publique)

- [ ] `frontend/src/constants/legalConfig.js` — infos réelles (SIRET, adresse)
- [ ] CGU / politique confidentialité relues
- [ ] Tarifs page = prix Stripe live
- [ ] Email support réel
- [ ] Pas de « coming soon » sur billing / import / portail

---

## Verdict release

| Environnement | Prêt ? | Date | Responsable | Blockers |
|---------------|--------|------|-------------|----------|
| Staging | ☐ | | | |
| Bêta fermée | ☐ | | | |
| Production | ☐ | | | |

**Règle :** un seul gate automatisé en échec = **pas de release**.
