# Browser QA — Basera V1

Voir aussi [E2E.md](./E2E.md) (prérequis, harness mock Gmail, parcours prospect→client) et [ACTION_LIFECYCLE.md](./ACTION_LIFECYCLE.md).

## Matrice exécutée (local E2E)

| Navigateur | Projet Playwright | Résultat typique |
|------------|-------------------|------------------|
| Chromium | `chromium` | Suite complète 49/49 pass |
| Firefox | `firefox` | ~45/50 (flaky timing quote send) |
| WebKit | `webkit` | ~48/50 |
| Mobile Chrome | `mobile-chrome` | ~47/50 |
| Mobile Safari | `mobile-safari` | ~44/50 |
| Tablette | `tablet` (iPad) | Inclus mobile run |

Lancer :

```bash
cd e2e
E2E_ALL_SPECS=1 npx playwright test --project=chromium
E2E_ALL_SPECS=1 npx playwright test --project=firefox
E2E_ALL_SPECS=1 npx playwright test --project=webkit
E2E_ALL_SPECS=1 npx playwright test --project=mobile-chrome --project=tablet
E2E_ALL_SPECS=1 npx playwright test --project=mobile-safari
```

## Parcours manuel obligatoire

1. **Landing** — scroll, pricing, langue FR/EN
2. **Register → Login** — cookies, redirect dashboard
3. **Refresh** — F5 sur `/dashboard`, `/dashboard/clients`, `/dashboard/billing`
4. **Navigation sidebar** — clients, notes, documents, communications, settings
5. **Modales** — add client, quote, invoice, Escape ferme
6. **Admin** — `/admin` refus user, accès admin
7. **Mobile 390px** — menu hamburger, touch targets

## Accessibilité (axe)

```bash
cd e2e && npm run test:accessibility
```

Règles : violations **critical** uniquement (color-contrast exclu volontairement en CI).

Corrections prioritaires : labels formulaires auth, focus clavier login, type button sur CTA dashboard.

## Régressions connues corrigées V1

- Dashboard sans auth E2E → `globalSetup` + `storageState`
- `DocumentSendModal` clipboard headless → enregistrement même si clipboard bloqué
- Import wizard step 3 → bouton « Confirmer la création »
- Paiement partiel → testid `invoice-partial-{id}`
- Note rappel UI → « Plus d'options » avant toggle

## CI

- **PR/push** : Chromium smoke + accessibilité
- **Nightly** : Firefox, WebKit, mobile (`.github/workflows/e2e-nightly.yml`)
