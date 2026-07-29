# MemoryHub — Rollback

Procédure pour revenir à une version précédente après un déploiement problématique.

## Rollback rapide (images Docker)

```bash
cd /opt/memoryhub

# Identifier le tag/commit précédent stable
export IMAGE_TAG=<commit-sha-stable>

git checkout <commit-sha-stable>

docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Rollback avec restauration données

Si le déploiement a corrompu des données :

1. Mettre l'application en maintenance (arrêter nginx ou afficher page statique)
2. `docker compose -f docker-compose.yml -f docker-compose.prod.yml stop backend scheduler`
3. Restaurer MongoDB : `deploy/scripts/restore-mongodb.sh <archive>`
4. Restaurer uploads si nécessaire : `deploy/scripts/restore-uploads.sh <archive>`
5. Checkout code stable + rebuild + `up -d`
6. Vérifier `/health/backend/ready` et smoke test login

## Rollback partiel (backend seul)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --build backend
```

## Indexes après rollback

```bash
docker compose exec backend python scripts/migrate_indexes.py
```

## Ce qu'il ne faut pas faire

- `git reset --hard` sur le VPS sans sauvegarde préalable
- Restaurer un dump production sur staging
- Supprimer les volumes Docker sans backup

## Prévention

- Tagguer chaque release : `IMAGE_TAG=$(git rev-parse --short HEAD)`
- Backup automatique avant chaque déploiement majeur
- Tester sur staging d'abord
