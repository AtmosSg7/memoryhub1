# Basera E2E (Playwright)

Documentation complète : [docs/E2E.md](../docs/E2E.md).

```bash
# depuis la racine du repo
npm run e2e:start          # ou npm run e2e:start:win
cd e2e && npm ci && npx playwright install chromium
npm run test:chromium
npx playwright test --project=mobile-chrome
cd .. && npm run e2e:stop  # ou npm run e2e:stop:win
```
