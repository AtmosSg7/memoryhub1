# Basera — Sauvegardes

## Ce qui est sauvegardé

| Composant | Script | Rétention V1 |
|-----------|--------|--------------|
| MongoDB | `deploy/scripts/backup-mongodb.sh` | 7 archives quotidiennes |
| Uploads | `deploy/scripts/backup-uploads.sh` | 7 archives quotidiennes |
| Complet | `deploy/scripts/backup-all.sh` | Les deux ci-dessus |

Archives stockées dans `deploy/backups/` (hors Git).

## Sauvegarde manuelle

```bash
cd /opt/memoryhub
./deploy/scripts/backup-all.sh
```

## Automatisation (cron)

```bash
sudo ./deploy/scripts/install-cron.sh /opt/memoryhub
```

Par défaut : tous les jours à **03:00 UTC**.

## Restauration MongoDB

```bash
./deploy/scripts/restore-mongodb.sh deploy/backups/mongo-YYYYMMDD-HHMMSS.archive.gz
```

⚠️ Écrase la base `DB_NAME` après confirmation `RESTORE`.

## Restauration uploads

```bash
./deploy/scripts/restore-uploads.sh deploy/backups/uploads-YYYYMMDD-HHMMSS.tar.gz
```

## Test de restauration (obligatoire avant production)

1. Copier les archives sur un environnement de test
2. `docker compose up -d`
3. Restaurer Mongo + uploads
4. Vérifier login, client, document uploadé
5. Documenter la date du test

## Bonnes pratiques

- Copier `deploy/backups/` hors du VPS (S3, autre serveur)
- Ne jamais versionner les dumps dans Git
- Chiffrer les archives hors-site si données sensibles
- Surveiller `deploy/backups/cron.log` pour échecs

## Vérification intégrité

```bash
# Taille non nulle
ls -lh deploy/backups/mongo-*.archive.gz

# Test mongorestore sur instance jetable (recommandé trimestriel)
```
