# MemoryHub V1 — Go Live

Guide opérationnel pour le **premier déploiement production** et les mises à jour suivantes.

> Prérequis : staging validé, `RELEASE_CHECKLIST.md` complété, secrets dans `deploy/.env` (jamais commités).

---

## 1. Ordre exact du déploiement

### Phase A — Préparation (J-2 à J-1)

1. **Taguer la release** sur `main` : `git tag v1.0.0-rc1 && git push origin v1.0.0-rc1`
2. **Remplir `deploy/.env`** depuis `deploy/.env.production.example` (voir `deploy/SECRETS_CHECKLIST.md`)
3. **Valider la config** (sur machine locale ou VPS) :
   ```bash
   ENV=production $(grep -v '^#' deploy/.env | xargs) \
     python3 -c "from env_validation import validate_production_env; validate_production_env()"
   ```
4. **DNS** : enregistrement A `app.votredomaine.fr` → IP du VPS
5. **Certificats TLS** : Let's Encrypt ou certificats fournis dans `deploy/certs/`
6. **Stripe Production** :
   - Clés live (`sk_live_`, `whsec_`)
   - Prix Solo / Pro / Team créés
   - Webhook `https://app.votredomaine.fr/api/stripe/webhook` (événements : checkout, invoice, subscription)
7. **SMTP** : SPF/DKIM configurés, email test envoyé
8. **Sentry** : `SENTRY_DSN` + `SENTRY_USER_SALT` uniques
9. **Backup test** : restaurer un dump sur instance isolée (voir `docs/BACKUPS.md`)

### Phase B — Déploiement (Jour J)

```bash
# 1. Connexion VPS
ssh deploy@votre-vps
cd /opt/memoryhub

# 2. Sauvegarde pré-déploiement
./deploy/scripts/backup-all.sh

# 3. Récupérer la release
git fetch --tags
git checkout v1.0.0-rc1   # ou commit SHA validé
export IMAGE_TAG=$(git rev-parse --short HEAD)

# 4. Build images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# 5. Démarrer la stack
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 6. Indexes MongoDB
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend \
  python scripts/migrate_indexes.py

# 7. Premier admin
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend \
  python scripts/promote_admin.py founder@votredomaine.fr

# 8. Cron backups (une fois)
sudo ./deploy/scripts/install-cron.sh /opt/memoryhub
```

### Phase C — Vérifications immédiates (T+15 min)

```bash
# Santé infrastructure
curl -fsS https://app.votredomaine.fr/health
curl -fsS https://app.votredomaine.fr/health/backend/ready
curl -fsS https://app.votredomaine.fr/api/health
curl -fsS https://app.votredomaine.fr/api/ready

# Logs (aucune erreur FATAL)
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 backend
```

### Phase D — Smoke manuel artisan (T+30 min)

| # | Action | Attendu |
|---|--------|---------|
| 1 | Ouvrir `/register`, créer compte | Dashboard, essai Solo actif |
| 2 | Créer un client | Fiche client visible |
| 3 | Créer un devis, l'envoyer | Lien portail copiable |
| 4 | Ouvrir portail (navigation privée) | Devis visible, PDF téléchargeable |
| 5 | Créer une facture | Liste factures OK |
| 6 | Import PDF (1 crédit) | Analyse + confirmation |
| 7 | Page `/dashboard/billing` | Plans affichés, Stripe configuré |
| 8 | Checkout test Stripe (montant minimal) | Webhook reçu, abonnement actif |
| 9 | `/admin` avec compte standard | Accès refusé |
| 10 | `/admin` avec compte promoteur | Vue d'ensemble OK |

### Phase E — Monitoring (T+24 h)

- Vérifier Sentry (0 erreur critique non traitée)
- Vérifier `deploy/backups/cron.log` (backup OK)
- Vérifier webhook Stripe (aucun échec dans Dashboard Stripe)
- Vérifier file emails (queue vide ou retries < seuil)

---

## 2. Rollback

### Rollback rapide (code uniquement, données intactes)

```bash
cd /opt/memoryhub
export IMAGE_TAG=<commit-sha-stable>
git checkout <commit-sha-stable>
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose exec backend python scripts/migrate_indexes.py
```

### Rollback avec restauration données

1. Mettre nginx en maintenance ou `docker compose stop nginx`
2. `docker compose stop backend scheduler`
3. `./deploy/scripts/restore-mongodb.sh deploy/backups/mongo-<timestamp>.archive.gz`
4. `./deploy/scripts/restore-uploads.sh deploy/backups/uploads-<timestamp>.tar.gz` (si nécessaire)
5. Checkout code stable + rebuild + `up -d`
6. Smoke : login + 1 client + 1 document

Voir `docs/ROLLBACK.md` pour le détail.

---

## 3. Vérifications post-déploiement

### Sécurité

- [ ] `/api/docs` → 404 (OpenAPI désactivé en prod/staging)
- [ ] `/api/dev/emails/preview` → 404
- [ ] `/api/subscriptions/dev/*` → 403 ou 404
- [ ] `E2E_DISABLE_RATE_LIMIT` absent de `deploy/.env`
- [ ] `DEV_CREDIT_PURCHASES_ENABLED` absent ou `false`
- [ ] MongoDB port 27017 **non exposé** publiquement

### Stripe

- [ ] Webhook signing secret correspond à `STRIPE_WEBHOOK_SECRET`
- [ ] Événement test `checkout.session.completed` → 200
- [ ] Customer Portal accessible depuis Billing

### Emails

- [ ] Email vérification reçu à l'inscription
- [ ] Email reset mot de passe reçu
- [ ] `SUPPORT_EMAIL` surveillé

### IA

- [ ] `ANALYZER_PROVIDER=openai`
- [ ] Import consomme des crédits (`CREDITS_ENFORCED=true`)
- [ ] Solde crédits visible sur dashboard

---

## 4. Premiers tests à effectuer (fondateur)

**Jour J (30 min)**  
Login → client → devis → portail → facture → import → billing

**Jour J+1**  
3 artisans pilotes : même parcours + retour UX mobile

**Jour J+3**  
Vérifier MRR Stripe, consommation crédits IA, taux d'erreur Sentry

**Jour J+7**  
Test restauration backup sur instance de test

---

## 5. Contacts & docs associées

| Sujet | Document |
|-------|----------|
| Checklist complète | `RELEASE_CHECKLIST.md` |
| Secrets | `deploy/SECRETS_CHECKLIST.md` |
| Déploiement Docker | `docs/PRODUCTION_DEPLOYMENT.md` |
| Staging | `docs/STAGING_GO_LIVE.md` |
| Backups | `docs/BACKUPS.md` |
| Rollback | `docs/ROLLBACK.md` |
| Incidents | `docs/INCIDENT_RESPONSE.md` |
| Observabilité | `docs/DAILY_OBSERVABILITY_CHECKLIST.md` |

---

## Règle finale

**Si un gate automatisé CI échoue ou si un item bloquant de `RELEASE_CHECKLIST.md` est décoché → pas de go live.**
