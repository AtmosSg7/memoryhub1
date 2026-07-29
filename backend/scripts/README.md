# Dev scripts

## One-shot local demo

From the repository root:

```bash
./scripts/setup-local-demo.sh
```

Creates the development user if missing, injects `demo_v2`, and prints login
credentials. Blocked when `ENV=production`.

## Seed dev admin user (empty MongoDB)

```bash
cd backend
python3 scripts/seed_dev_user.py
```

Creates `atmossg7@gmail.com` / `devpassword123` if missing. Idempotent.

## Seed realistic demo data

After the dev user exists:

```bash
cd backend
python3 scripts/seed_dev_user.py
python3 scripts/seed_dev_demo.py
```

Creates in MongoDB (dev-only, blocked if `ENV=production`):

- 20 fictitious French artisan clients (`@example.com` emails, fake companies,
  cities and phone numbers), spread over the last ~6 months, mixing statuses
  `active` / `pending` / `new` / `dormant`
- 12 devis: 2 brouillons, 3 envoyés, 3 acceptés, 2 refusés, 2 expirés
- 10 factures: en cours, payées, partiellement payées, et impayées depuis
  plus de 40 jours (éligibles au passage en retard)
- 8 notes (types général / téléphone / réunion / visite / rappel)
- 6 communications e-mail simulées (mock Gmail, entrant/sortant)
- 2 relances enregistrées sur des devis envoyés
- 2 portails clients activés

Idempotent via tag `demo_v2`. Re-run prints a summary if a seed already
exists for the dev user — it never duplicates data.

Use for testing dashboard, rappels, timeline, fiche client, communications
et portail.

## Clear demo data

```bash
cd backend
python3 scripts/clear_dev_demo.py
```

Deletes every document tagged with `devSeedTag` in `demo_v1` / `demo_v2`
(clients, devis, factures, notes, documents, communications, events,
follow-ups) for the dev user, plus their client portals. Idempotent — running
it again on an already-clean database reports nothing to delete. Blocked if
`ENV=production`.

## Reset local password (Mac)

Forgot-password in the UI does not send email yet (token is stored in MongoDB only). Use this script locally instead.

**Requirements:** `backend/.env` with `MONGO_URL`, `DB_NAME`, and `ENV` not set to `production`.

```bash
cd backend
python3 scripts/reset_dev_password.py atmossg7@gmail.com
```

Optional custom password:

```bash
python3 scripts/reset_dev_password.py atmossg7@gmail.com 'MyNewPass123'
```

Default password if omitted: `devpassword123`

Then start backend + frontend and log in at http://localhost:3000/login

**Safety:** The script exits immediately when `ENV=production`.
