# Basera — Production Deployment

Guide complet pour déployer Basera sur un VPS Linux avec Docker Compose.

## Architecture

```
Internet → nginx (TLS, 80/443)
              ├── /api/*  → backend:8000 (FastAPI / Uvicorn)
              └── /*      → frontend:80 (Nginx static SPA)

backend ↔ mongo:27017 (réseau interne uniquement)
backend ↔ uploads_data:/app/uploads
scheduler → retries emails (compose prod)
```

**Fichiers compose**

| Fichier | Usage |
|---------|-------|
| `docker-compose.yml` | Stack de base |
| `docker-compose.production.yml` | Production (OVH) : MongoDB auth, scheduler, limites mémoire |
| `docker-compose.prod.yml` | Alias de `docker-compose.production.yml` |
| `docker-compose.staging.yml` | Staging : HTTP 8080, DB séparée |
| `docker-compose.local-prod.yml` | Test local avec TLS auto-signé + 8080 |

## Prérequis VPS

- Ubuntu 22.04+ / Debian 12+
- Docker Engine 24+ et Compose v2
- Domaine DNS → IP du VPS (A record)
- Ports **80** et **443** ouverts
- 2 Go RAM minimum (4 Go recommandé)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

## Premier déploiement

```bash
git clone <repo> /opt/memoryhub
cd /opt/memoryhub

cp deploy/.env.production.example deploy/.env
nano deploy/.env   # voir deploy/SECRETS_CHECKLIST.md

# Certificats TLS (staging local)
chmod +x deploy/scripts/generate-self-signed-certs.sh
./deploy/scripts/generate-self-signed-certs.sh basera.fr

# Production Let's Encrypt — seulement après DNS (voir deploy/scripts/issue-letsencrypt.sh)
# sudo ./deploy/scripts/issue-letsencrypt.sh basera.fr www.basera.fr

docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env build
docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env up -d

# Vérifications
curl -kfsS https://127.0.0.1/health
curl -kfsS https://127.0.0.1/health/backend/ready
docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env ps
```

Guide OVH : `deploy/OVH_VPS_DEPLOY.md`.

## Variables obligatoires

Voir `deploy/SECRETS_CHECKLIST.md` et `deploy/.env.production.example`.

Le backend **refuse de démarrer** si `ENV=production` et qu'une variable critique manque (JWT, CORS, Stripe live, SMTP, Mongo auth, etc.).

## Mise à jour

```bash
cd /opt/memoryhub
git pull
export IMAGE_TAG=$(git rev-parse --short HEAD)
docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env build
docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env up -d
docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env exec backend python scripts/migrate_indexes.py
```

## Health & readiness

| Endpoint | Rôle |
|----------|------|
| `GET /health` | Edge nginx vivant |
| `GET /health/backend` | Backend liveness (`/api/health`) |
| `GET /health/backend/ready` | Backend readiness (`/api/ready`, MongoDB) |
| `GET /health/frontend` | Frontend static |

## Stockage fichiers (V1 local)

- Volume Docker `uploads_data` monté sur `/app/uploads`
- Accès uniquement via API backend (pas d'URL publique directe)
- Sauvegarde : `deploy/scripts/backup-uploads.sh`
- Migration future S3 : définir `STORAGE_BACKEND=s3` + variables AWS (non requis V1)

## Tâches planifiées

Le service `scheduler` (compose prod) exécute :
- Retries emails transactionnels (`process_pending_email_retries`)
- Expiration devis / factures en retard
- Relances factures planifiées
- **Gmail auto-sync** (`run_gmail_auto_sync`) — incrémental via `historyId`, verrou Mongo, backoff

Variables (dans `deploy/.env`, sans secrets) :

```bash
GMAIL_AUTO_SYNC_ENABLED=true
GMAIL_AUTO_SYNC_INTERVAL_MINUTES=10
GMAIL_AUTO_SYNC_BATCH_SIZE=25
GMAIL_AUTO_SYNC_TIMEOUT_SECONDS=60
```

### Recréer uniquement le scheduler (après git pull + vars)

```bash
cd /opt/memoryhub
git pull
export IMAGE_TAG=$(git rev-parse --short HEAD)
docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env build backend
docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env up -d --no-deps --force-recreate scheduler
docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env logs --tail=80 scheduler
```

Sauvegardes via cron hôte : `sudo deploy/scripts/install-cron.sh /opt/memoryhub`

## Monitoring minimal

- **Sentry** : `SENTRY_DSN` (optionnel mais recommandé)
- **Logs** : `docker compose logs -f backend nginx`
- **Santé** : cron externe sur `/health/backend/ready` (UptimeRobot, etc.)
- **Disque** : surveiller `deploy/backups/` et volumes Docker

## Documents associés

- [STAGING.md](./STAGING.md)
- [BACKUPS.md](./BACKUPS.md)
- [ROLLBACK.md](./ROLLBACK.md)
- [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)
- `deploy/DEPLOY.md` — guide VPS détaillé
- `deploy/SECRETS_CHECKLIST.md`
