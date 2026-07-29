# Checklist observabilité quotidienne (staging)

Cocher chaque matin sur l'environnement staging.

## Santé

- [ ] `curl -sf $BASE/api/health` → `{"status":"ok"}`
- [ ] `curl -sf $BASE/api/ready` → mongo ok
- [ ] `docker compose ps` — tous les services `Up`
- [ ] Pas de restart loop nginx/backend (vérifier `docker compose ps` / uptime)

## Logs & erreurs

- [ ] `docker compose logs --since 24h backend | rg -i "error|exception"` — investiguer nouveautés
- [ ] Aucun spike 5xx nginx (si metrics disponibles)
- [ ] Scheduler actif si configuré (`run_scheduled_tasks.py`)

## Providers

- [ ] Import IA test (1 PDF) — OpenAI OK
- [ ] Email test (register ou preview) — SMTP OK
- [ ] Stripe dashboard — webhooks récents 2xx

## Données

- [ ] Backup Mongo dernière nuit (`deploy/backups/`) si cron installé
- [ ] Espace disque uploads suffisant

## Crédits & billing

- [ ] `CREDITS_ENFORCED=true` toujours actif
- [ ] Compte test : solde crédits cohérent après import

## Sécurité

- [ ] Certificat TLS > 14 jours avant expiration (prod/staging HTTPS)
- [ ] Aucune clé live Stripe en staging

Durée estimée : **5–10 minutes**.
