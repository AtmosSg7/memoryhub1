# E2E Playwright — Basera

Suite navigateur pour le parcours produit principal : e-mail inconnu → prospect → Communication Intelligence → client → Timeline V2 → recherche → réponse auto-liée.

## Prérequis

- MongoDB local (`mongodb://localhost:27017`)
- Python 3.11+ avec dépendances `backend/requirements.txt`
- Node 20+ (frontend + dossier `e2e/`)
- Ports libres pour E2E : `8001` (API), `3001` (CRA) — **distincts** du stack local `8000` / `3000`
- Base Mongo E2E : `memoryhub_e2e` uniquement (jamais `memoryhub`)

Ne jamais pointer vers la production. Les seeds et routes `/api/e2e/*` sont refusés si `IS_DEPLOYED` / `ENV=production`, ou si `ALLOW_E2E_SEED` est absent.

Les scripts `e2e-start` **n’écrivent pas** `backend/.env` / `frontend/.env`, injectent un env isolé dans les processus enfants, et restaurent le shell appelant. Le stack local continue d’utiliser `DB_NAME=memoryhub` sur `:8000` / `:3000`.

## Installation Playwright

```bash
cd e2e
npm ci
npx playwright install chromium
# optionnel : navigateurs complets
npx playwright install
```

## Lancement local (stack + tests)

### Linux / macOS / Git Bash

```bash
npm run e2e:start
cd e2e && npm run test:chromium
npm run e2e:stop
```

### Windows (PowerShell)

```powershell
.\scripts\e2e-start.ps1
cd e2e; $env:E2E_BASE_URL='http://127.0.0.1:3001'; npm run test:chromium
.\scripts\e2e-stop.ps1
```

Stack local (compte réel, DB `memoryhub`) — ne pas mélanger avec E2E :

```powershell
.\scripts\dev-start.ps1
# login: http://localhost:3000/login
```

Variables importantes injectées **uniquement** dans les processus E2E :

| Variable | Valeur E2E |
|----------|------------|
| `DB_NAME` / `E2E_DB_NAME` | `memoryhub_e2e` |
| Ports | API `8001`, CRA `3001` (`E2E_PROXY_TARGET`) |
| `ALLOW_E2E_SEED` | `1` |
| `INTEGRATIONS_GMAIL_PROVIDER` | `mock` |
| `ACTION_ENGINE_ENABLED` | `true` |
| `COMMUNICATION_INTELLIGENCE_ENABLED` | `true` |
| `COMMUNICATION_INTELLIGENCE_PROVIDER` | `mock` |
| `E2E_DISABLE_RATE_LIMIT` | `1` |

Compte seed : `artisan-a@e2e.example.com` / `E2ePassw0rd!A`

## Headless

Par défaut Playwright tourne headless.

```bash
cd e2e
npx playwright test --project=chromium
```

Mode visible :

```bash
npm run test:headed
```

## Un seul scénario

```bash
cd e2e
npx playwright test tests/prospect-to-client.spec.js --project=chromium
npx playwright test tests/prospect-ignore.spec.js --project=chromium
npx playwright test tests/ci-suggestions.spec.js --project=chromium
npx playwright test tests/sync-idempotence.spec.js --project=chromium
```

## Mobile (3 viewports)

```bash
cd e2e
npm run test:mobile
# équivalent :
npx playwright test --project=mobile-360 --project=mobile-390 --project=mobile-412
```

Couvre `prospect-mobile` + `artisan-mobile` (dashboard, action, recherche, clients, note, documents, overflow).

## Nettoyage des données

Chaque scénario appelle `POST /api/e2e/scenario/seed-unknown` (purge + mock Gmail + sync) ou `POST /api/e2e/scenario/reset`.

Reset complet de la base E2E :

```bash
ALLOW_E2E_SEED=1 ENV=development DB_NAME=memoryhub_e2e \
  python backend/scripts/clean_e2e_db.py
ALLOW_E2E_SEED=1 ENV=development DB_NAME=memoryhub_e2e \
  python backend/scripts/seed_e2e.py
```

## Diagnostic en cas d’échec

1. Vérifier la santé harness : `GET http://127.0.0.1:3001/api/e2e/health` (via proxy E2E) — doit répondre `ok: true`.
2. Logs stack : `e2e/.backend.log`, `e2e/.frontend.log`.
3. Artefacts Playwright (échecs seulement) : `e2e/test-results/`, `e2e/playwright-report/`.
4. Relancer un seul spec avec `--headed` et `--debug` si besoin.
5. Confirmer `INTEGRATIONS_GMAIL_PROVIDER=mock` et `ALLOW_E2E_SEED=1` sur le backend.

## Architecture

- **Stack isolée** : DB `memoryhub_e2e`, ports `8001`/`3001`, providers mock (Gmail, CI, e-mail). Le local reste sur `memoryhub` + `8000`/`3000`.
- **Harness** : `backend/e2e_harness.py` monté uniquement si `not IS_DEPLOYED`.
- **UI** : sélecteurs `data-testid` / rôles déjà présents ; pas de sleeps fixes.
- **Docs contrat actions** : [ACTION_LIFECYCLE.md](./ACTION_LIFECYCLE.md).
