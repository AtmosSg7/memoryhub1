# Basera — Incident Response

Guide de diagnostic pour les incidents production courants.

## 1. Login impossible / spinner infini

**Symptômes** : frontend charge, login tourne indéfiniment.

**Vérifications** :
```bash
curl -fsS https://<domain>/health/backend/ready
docker compose logs backend --tail 100
```

**Causes fréquentes** :
- Backend down ou MongoDB inaccessible
- CORS : origine frontend absente de `CORS_ORIGINS`
- Certificat TLS invalide

**Actions** :
- Redémarrer backend : `docker compose restart backend`
- Vérifier `MONGO_URL` et credentials Mongo (compose prod)
- Vérifier que `CORS_ORIGINS` inclut l'origine exacte HTTPS

## 2. Backend down (503)

```bash
docker compose ps
docker compose logs backend --tail 200
```

- Erreur au démarrage → variables manquantes (`ENV=production` validation)
- Crash loop → lire traceback dans les logs
- Mongo down → `docker compose logs mongo`

## 3. MongoDB down

```bash
docker compose ps mongo
docker compose exec mongo mongosh --eval "db.runCommand('ping')"
```

- Espace disque plein : `df -h`
- Volume corrompu : restaurer depuis backup (voir BACKUPS.md)
- **Ne jamais** exposer le port 27017 publiquement

## 4. Stripe webhooks en échec

**Symptômes** : abonnements non activés après paiement.

**Vérifications** :
- Dashboard Stripe → Webhooks → logs
- `STRIPE_WEBHOOK_SECRET` correspond à l'endpoint
- URL webhook : `https://<domain>/api/stripe/webhook`
- Logs : `docker compose logs backend | grep -i stripe`

**Note** : nginx est configuré avec `proxy_request_buffering off` pour préserver le corps brut.

## 5. Emails non envoyés

```bash
docker compose exec backend python -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
async def q():
    c = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = c[os.environ['DB_NAME']]
    async for e in db.email_events.find({'status': {'\$in': ['failed','retrying']}}).limit(5):
        print(e.get('templateKey'), e.get('status'), e.get('lastErrorCode'))
asyncio.run(q())
"
```

- Vérifier `SMTP_*` dans `deploy/.env`
- Vérifier service `scheduler` actif (compose prod)
- Voir `backend/docs/TRANSACTIONAL_EMAILS.md`

## 6. Imports IA / crédits

- `CREDITS_ENFORCED=true` en production
- `OPENAI_API_KEY` si `ANALYZER_PROVIDER=openai`
- Logs crédits dans backend

## 7. Espace disque

```bash
df -h
docker system df
du -sh deploy/backups/
```

- Purger vieux backups manuellement si nécessaire
- `docker system prune` avec prudence (ne pas supprimer volumes nommés)

## 8. Changement de domaine

1. Mettre à jour DNS
2. Nouveau certificat TLS dans `deploy/certs/`
3. Mettre à jour `PUBLIC_APP_URL`, `FRONTEND_URL`, `CORS_ORIGINS`, URLs Stripe
4. Rebuild frontend (`REACT_APP_API_URL` vide = same-origin)
5. Redémarrer stack

## 9. Renouvellement certificat

```bash
sudo certbot renew
sudo cp /etc/letsencrypt/live/<domain>/fullchain.pem deploy/certs/
sudo cp /etc/letsencrypt/live/<domain>/privkey.pem deploy/certs/
docker compose restart nginx
```

## Escalade

1. Stabiliser (rollback si besoin — voir ROLLBACK.md)
2. Sauvegarder état actuel (`backup-all.sh`)
3. Documenter timeline + cause racine
4. Post-mortem interne
