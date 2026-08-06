# Gmail auto-sync (scheduler)

## Purpose

Retrieve new Gmail messages automatically without a manual “Synchroniser” click.
Feeds `communications`, client timeline, prospects, and the unlinked inbox via the
existing import pipeline.

## Configuration

| Variable | Default | Notes |
|----------|---------|--------|
| `GMAIL_AUTO_SYNC_ENABLED` | `true` | Master switch |
| `GMAIL_AUTO_SYNC_INTERVAL_MINUTES` | `10` | Min enforced: **5** |
| `GMAIL_AUTO_SYNC_BATCH_SIZE` | `25` | Accounts per tick |
| `GMAIL_AUTO_SYNC_TIMEOUT_SECONDS` | `60` | Per-account timeout |

No secrets. Add to `backend/.env` (local) and `deploy/.env` (production).

## Behaviour

1. Select `connected_accounts` with `provider=gmail`, `status=connected`, due `nextSyncAt`.
2. For each account (up to batch size): call `run_gmail_sync_for_user` (incremental History).
3. Mongo distributed lock `gmail-sync:{accountId}` prevents concurrent syncs.
4. On failure: keep `status=connected`, increment `consecutiveSyncErrors`, set `nextSyncAt` (backoff).
5. On success: reset errors, set `nextSyncAt` = now + interval.

### Backoff

| consecutiveSyncErrors | Next attempt |
|----------------------|--------------|
| 0 (success) / 1 | normal interval |
| 2 | 30 minutes |
| 3 | 1 hour |
| ≥ 4 | 6 hours max |

## Mongo fields (on `connected_accounts`)

- `historyId`, `lastSuccessfulSyncAt`, `lastFullSyncAt`, `syncState`, `lastSyncError`
- `lastSyncAttemptAt`, `consecutiveSyncErrors`, `nextSyncAt`

Locks live in `distributed_locks` with TTL on `expiresAt`.

## Recreate scheduler only (production)

See `docs/PRODUCTION_DEPLOYMENT.md` — build backend image then:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env up -d --no-deps --force-recreate scheduler
```

## Out of scope

- Gmail Push / webhooks
- Polling under 5 minutes
- Frontend changes
