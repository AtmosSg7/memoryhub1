# MemoryHub — Déploiement production (VPS Ubuntu)

Guide pour déployer MemoryHub sur un VPS Ubuntu avec Docker Compose, HTTPS, sauvegardes MongoDB et observabilité.

## Prérequis VPS

- Ubuntu 22.04+ (ou 24.04)
- Docker Engine 24+ et Docker Compose v2
- Nom de domaine pointant vers le VPS (production)
- Ports 80 et 443 ouverts

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git logrotate
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Reconnectez-vous pour appliquer le groupe `docker`.

## Installation

```bash
git clone <votre-repo> /opt/memoryhub
cd /opt/memoryhub

cp deploy/.env.production.example deploy/.env
nano deploy/.env
```

Variables **obligatoires** en production (`ENV=production`) :

| Variable | Description |
|---|---|
| `PUBLIC_APP_URL` | URL publique (ex. `https://app.example.com`) |
| `FRONTEND_URL` | Même URL que `PUBLIC_APP_URL` |
| `CORS_ORIGINS` | Doit inclure l'origine de `FRONTEND_URL` |
| `JWT_SECRET` | Secret aléatoire ≥ 32 caractères |
| `SENTRY_USER_SALT` | Salt aléatoire (≠ valeur dev) |
| `DB_NAME` | Nom de la base MongoDB |
| `EMAIL_PROVIDER` | `smtp` en production |
| `SMTP_HOST`, `SMTP_FROM_EMAIL` | Envoi des e-mails transactionnels |

Configurer aussi `FRONTEND_PUBLIC_URL`, `SUPPORT_EMAIL` — voir `backend/docs/TRANSACTIONAL_EMAILS.md`.

Le backend **refuse de démarrer** si une variable obligatoire est manquante ou invalide.

## Certificats TLS (HTTPS)

### Staging / premier démarrage

```bash
chmod +x deploy/scripts/generate-self-signed-certs.sh
./deploy/scripts/generate-self-signed-certs.sh app.example.com
```

### Production (Let's Encrypt)

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d app.example.com
sudo cp /etc/letsencrypt/live/app.example.com/fullchain.pem deploy/certs/
sudo cp /etc/letsencrypt/live/app.example.com/privkey.pem deploy/certs/
sudo chown "$USER:$USER" deploy/certs/*.pem
```

Renouvelez puis recopiez les certificats avant expiration (cron certbot).

## Lancement

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file deploy/.env up -d --build
docker compose ps
```

Accès :

- **HTTPS** : `https://app.example.com` (port 80 → redirection HTTPS)
- **HTTP direct** (staging uniquement) : `http://<ip>:8080` — non exposé en production (`docker-compose.prod.yml`)

## Healthchecks

| Endpoint | Service |
|---|---|
| `GET /health` | Nginx (edge) |
| `GET /health/backend` | Backend liveness → `/api/health` |
| `GET /health/backend/ready` | Backend readiness → `/api/ready` (MongoDB) |
| `GET /health/frontend` | Frontend via Nginx |
| `GET /api/health` | Backend liveness (direct) |
| `GET /api/ready` | Backend readiness (direct) |

```bash
curl -fsS http://localhost:8080/health
curl -fsS http://localhost:8080/health/backend/ready
```

Documentation : `docs/PRODUCTION_DEPLOYMENT.md`, `docs/BACKUPS.md`, `docs/ROLLBACK.md`, `docs/INCIDENT_RESPONSE.md`.

Tous les conteneurs utilisent `restart: unless-stopped`.

## Compression & cache

- **Gzip** : activé sur Nginx edge et frontend
- **Brotli** : activé si le module Alpine est disponible dans l'image Nginx
- **Cache statique** : assets `/static/` (1 an, immutable) et fichiers statiques (30 jours) côté frontend

## Sécurité production

Headers appliqués par Nginx et le backend :

- `Strict-Transport-Security`
- `Content-Security-Policy` (production)
- `X-Frame-Options`, `X-Content-Type-Options`
- `Referrer-Policy`, `Permissions-Policy`
- `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`

Cookies JWT : `Secure` + `HttpOnly` en production.

## Logs & rotation

Docker limite la taille des logs par conteneur (10 Mo × 5 fichiers) via `docker-compose.yml`.

Rotation hôte (optionnelle) :

```bash
sudo cp deploy/logrotate/memoryhub /etc/logrotate.d/memoryhub
```

## Sauvegarde MongoDB

Sauvegarde manuelle :

```bash
chmod +x deploy/scripts/backup-mongodb.sh
./deploy/scripts/backup-mongodb.sh
```

Les archives sont stockées dans `deploy/backups/` (14 dernières conservées).

Cron quotidien recommandé :

```bash
crontab -e
# Sauvegarde MongoDB tous les jours à 3h
0 3 * * * /opt/memoryhub/deploy/scripts/backup-mongodb.sh >> /var/log/memoryhub-backup.log 2>&1
```

Restauration :

```bash
gunzip -c deploy/backups/mongo-YYYYMMDD-HHMMSS.archive.gz | \
  docker compose --env-file deploy/.env exec -T mongo \
  mongorestore --archive --gzip --drop --nsInclude="${DB_NAME}.*"
```

## Mise à jour

```bash
cd /opt/memoryhub
git pull
docker compose --env-file deploy/.env up -d --build
```

## Dépannage

```bash
docker compose --env-file deploy/.env logs -f backend
docker compose --env-file deploy/.env logs -f nginx
docker compose --env-file deploy/.env exec backend curl -fsS http://127.0.0.1:8000/api/health
```

Si Nginx ne démarre pas : vérifiez que `deploy/certs/fullchain.pem` et `privkey.pem` existent.
