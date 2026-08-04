# Basera — Architecture de déploiement

Domaine officiel : **basera.fr** (DNS / TLS à brancher uniquement après validation de la stack).

## Compatibilité Vercel

| Couche | Compatible ? | Détail |
|--------|--------------|--------|
| Frontend (SPA CRA) | Oui, avec travail | Build statique + rewrites SPA. Nécessite une URL API et une stratégie cookies/CORS si le backend n’est pas same-origin. |
| Backend FastAPI | **Non, sans réécriture majeure** | Processus ASGI durable, pool MongoDB (Motor), volume uploads, scheduler en boucle, dépendances lourdes (pandas/numpy/reportlab), rate-limit en mémoire, indexes au démarrage. Aucun adapter serverless (`vercel.json` / Mangum) dans le repo. |

## Architecture recommandée (chemin existant)

**VPS Ubuntu + Docker Compose** (déjà documenté) :

- `nginx` — TLS, SPA, reverse-proxy `/api`, body brut webhook Stripe
- `frontend` — image Nginx servant le build React
- `backend` — Uvicorn / FastAPI (`server:app`)
- `mongo` — volume persistant
- `scheduler` — `scripts/run_scheduled_tasks.py --loop` (prod)
- volumes : `mongo_data`, `uploads_data`

Same-origin `https://basera.fr` → cookies JWT `HttpOnly` + `SameSite=lax` fonctionnent sans refonte auth.

Commande type :

```bash
cp deploy/.env.production.example deploy/.env
# remplir CHANGE_ME…
./deploy/scripts/generate-self-signed-certs.sh basera.fr
docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env up -d --build
```

Guides : `deploy/OVH_VPS_DEPLOY.md`, `deploy/DEPLOY.md`, `GO_LIVE.md`, `deploy/SECRETS_CHECKLIST.md`.

## Alternative acceptable (plus tard)

| Service | Rôle |
|---------|------|
| Vercel | SPA uniquement |
| Railway / Render / Fly / VPS | Backend + scheduler |
| MongoDB Atlas | Base |
| S3 / R2 | `STORAGE_BACKEND=s3` |

Implique de modifier cookies (`SameSite=None; Secure`), CORS, et `REACT_APP_API_URL`. **Non nécessaire pour le premier go-live.**

## À ne pas faire pour le premier déploiement public

- Backend sur Vercel serverless
- Séparer FE/BE sans revoir l’auth cookie
- Brancher `basera.fr` avant healthchecks verts
- Oublier le scheduler (relances e-mail, échéances devis/factures)
