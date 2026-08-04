# Basera — Déploiement VPS OVH (Ubuntu + Docker Compose)

Guide **étape par étape** pour le premier déploiement public.

> Domaine : **basera.fr** (à brancher seulement après validation de la stack).  
> Webhook Stripe : **à configurer après** HTTPS public.  
> Ne modifie aucune fonctionnalité métier — opérations d’infra uniquement.

Architecture : `docs/DEPLOYMENT_ARCHITECTURE.md`  
Secrets : `deploy/SECRETS_CHECKLIST.md`  
Template env : `deploy/.env.production.example`

---

## 0. Ce qui est déjà prêt dans le repo

| Élément | Fichier / statut |
|---------|------------------|
| Stack de base | `docker-compose.yml` — mongo, backend, frontend, nginx |
| Overlay production | `docker-compose.production.yml` (+ alias `docker-compose.prod.yml`) |
| Scheduler | inclus dans l’overlay production |
| Volumes | `mongo_data`, `uploads_data` |
| Nginx TLS + `/api` + webhook raw body | `deploy/nginx/` |
| Certs auto-signés (bootstrap) | `deploy/scripts/generate-self-signed-certs.sh` |
| Let's Encrypt (plus tard) | `deploy/scripts/issue-letsencrypt.sh` |
| Validation env | `deploy/scripts/validate-production-env.sh` |
| Backups Mongo/uploads | `deploy/scripts/backup-*.sh` (auth Mongo prise en charge) |

**Commande compose production (à mémoriser) :**

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  --env-file deploy/.env \
  up -d --build
```

`--env-file deploy/.env` est **obligatoire** pour interpoler `MONGO_ROOT_USERNAME` / `MONGO_ROOT_PASSWORD` dans Compose.

---

## 1. Préparer le VPS Ubuntu (OVH)

Recommandé : **Ubuntu 22.04 ou 24.04 LTS**, **4 Go RAM** (2 Go minimum), disque ≥ 40 Go.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git ufw openssl

# Docker Engine + Compose v2
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# Déconnexion / reconnexion SSH pour le groupe docker

# Pare-feu
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

Ne pas ouvrir MongoDB (27017) sur Internet.

---

## 2. Récupérer le code

```bash
sudo mkdir -p /opt
sudo chown "$USER:$USER" /opt
git clone <URL_DU_REPO> /opt/memoryhub
cd /opt/memoryhub
```

---

## 3. Variables d’environnement production

```bash
cp deploy/.env.production.example deploy/.env
nano deploy/.env   # remplacer tous les CHANGE_ME
```

### Obligatoire avant démarrage

- `ENV=production`
- URLs same-origin (`PUBLIC_APP_URL`, `FRONTEND_URL`, `BACKEND_PUBLIC_URL`, `CORS_ORIGINS`, …)
- `JWT_SECRET` ≥ 32 caractères aléatoires
- `SENTRY_USER_SALT` ≠ valeur de dev
- `MONGO_ROOT_USERNAME` / `MONGO_ROOT_PASSWORD` / `DB_NAME`
- `STORAGE_BACKEND=local` + `LOCAL_UPLOAD_DIR=/app/uploads`
- `CREDITS_ENFORCED=true`
- `ANALYZER_PROVIDER=openai` + `OPENAI_API_KEY`
- SMTP complet (`EMAIL_PROVIDER=smtp`, host, from, support)
- Stripe Live : `STRIPE_SECRET_KEY=sk_live_…`, Price IDs, success/cancel URLs
- `STRIPE_WEBHOOK_SECRET` : placeholder temporaire autorisé pour **démarrer** le backend  
  (`whsec_pending_configure_after_https`) — **remplacer** dès que le webhook Live est créé  
  (ne pas créer le webhook tant que `basera.fr` n’est pas en HTTPS)

Générer des secrets :

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 24   # SENTRY_USER_SALT / mots de passe
```

Valider (host) :

```bash
chmod +x deploy/scripts/*.sh
./deploy/scripts/validate-production-env.sh
```

---

## 4. Certificats TLS (bootstrap, sans DNS public)

Nginx **exige** `deploy/certs/fullchain.pem` + `privkey.pem` (volume monté en lecture seule).  
Sans fichiers, le conteneur nginx ne démarre pas correctement sur 443.

**Pour le premier boot OVH (avant de brancher basera.fr) :**

```bash
./deploy/scripts/generate-self-signed-certs.sh basera.fr
```

Plus tard (DNS prêt) — **ne pas exécuter maintenant** :

```bash
sudo ./deploy/scripts/issue-letsencrypt.sh basera.fr www.basera.fr
```

---

## 5. Lancer la stack

```bash
cd /opt/memoryhub
export IMAGE_TAG=$(git rev-parse --short HEAD)

docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  --env-file deploy/.env \
  up -d --build

docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  --env-file deploy/.env \
  ps
```

Services attendus : `mongo`, `backend`, `frontend`, `nginx`, `scheduler`.

### Volumes persistants

| Volume Docker | Contenu |
|---------------|---------|
| `memoryhub_mongo_data` (nom projet `memoryhub`) | Base MongoDB |
| `memoryhub_uploads_data` | Fichiers uploadés (`/app/uploads`) |

Vérifier :

```bash
docker volume ls | grep -E 'mongo_data|uploads_data'
```

---

## 6. Post-démarrage

```bash
# Indexes
docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env \
  exec backend python scripts/migrate_indexes.py

# Premier admin (remplacer l’e-mail)
docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env \
  exec backend python scripts/promote_admin.py vous@exemple.fr

# Validation env dans le conteneur
docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env \
  exec backend python -c "from env_validation import validate_production_env; validate_production_env(); print('OK')"
```

### Healthchecks (depuis le VPS)

```bash
curl -kfsS https://127.0.0.1/health
curl -kfsS https://127.0.0.1/health/backend/ready
curl -kfsS https://127.0.0.1/health/frontend
```

(`-k` tant que le certificat est auto-signé.)

---

## 7. Backups (cron)

```bash
./deploy/scripts/backup-all.sh
sudo ./deploy/scripts/install-cron.sh /opt/memoryhub
```

---

## 8. Étapes volontairement reportées

| Étape | Quand |
|-------|--------|
| DNS A/AAAA `basera.fr` → IP OVH | Après healthchecks verts en auto-signé |
| Let's Encrypt | Juste après DNS |
| Webhook Stripe `https://basera.fr/api/stripe/webhook` | Après HTTPS valide |
| Remplacer `STRIPE_WEBHOOK_SECRET` + recreate backend | Après création du endpoint Stripe |

---

## 9. Checklist de préparation

- [ ] VPS Ubuntu + Docker + UFW 22/80/443
- [ ] Repo cloné dans `/opt/memoryhub`
- [ ] `deploy/.env` rempli (plus de `CHANGE_ME` critiques)
- [ ] `./deploy/scripts/validate-production-env.sh` OK
- [ ] Certs dans `deploy/certs/` (auto-signés OK pour bootstrap)
- [ ] `docker compose …production… up -d --build` OK
- [ ] 5 services up + healthy
- [ ] Volumes mongo + uploads présents
- [ ] `/health/backend/ready` OK
- [ ] Indexes + admin créés
- [ ] Backup manuel OK
- [ ] DNS / Let's Encrypt / webhook Stripe — **pas encore**

---

## Dépannage rapide

| Symptôme | Piste |
|----------|--------|
| nginx unhealthy / restart loop | Certs absents → `generate-self-signed-certs.sh` |
| backend exit immédiat | Lire logs ; souvent env_validation (Stripe/SMTP/JWT) |
| mongo unhealthy | `MONGO_ROOT_*` absents du `--env-file` |
| 502 sur `/api` | backend pas ready ; `docker compose … logs backend` |
| mongodump échoue | scripts mis à jour avec auth ; relancer `backup-mongodb.sh` |
