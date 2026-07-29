# MemoryHub — AI Engine (Import, Credits, Observability)

Architecture du moteur IA production-ready : estimation, consommation, mesure OpenAI, historique et métriques.

---

## Vue d'ensemble

```
ImportWizard (frontend)
    │  POST /api/imports/estimate   → ai_import_estimator
    │  POST /api/imports/analyze    → import_service
    ▼
import_service
    1. estimate tier + credits (ai_import_estimator)
    2. require_credits_for_import (AIUsageService)
    3. OpenAI / Mock analyze
    4. reject if analysis.errors (no debit)
    5. persist session
    6. consume_for_import (idempotent import:{sessionId})
    7. record_import_ai_usage → ai_usage_events
```

---

## Services

| Module | Rôle |
|--------|------|
| `ai_import_estimator.py` | Estimation tier (simple → very_complex) et crédits avant analyse |
| `ai_usage_service.py` | **Seul** point d'entrée consommation crédits IA |
| `ai_usage_event_service.py` | Audit tokens, coût USD, crédits, durée, succès/erreur |
| `ai_usage_history_service.py` | Historique utilisateur (sans contenu sensible) |
| `ai_metrics_service.py` | Agrégats ops (latence, échecs, coût moyen) |
| `ai_cost_config.py` | Tarifs OpenAI USD/1M tokens (interne admin) |

---

## Import document

Voir [IMPORT_ENGINE.md](./IMPORT_ENGINE.md) pour le pipeline complet (prétraitement, limites, fusion images, classification).

## Estimation import

Entrées : extension, taille, pages PDF (heuristique sans dépendance externe).

Tiers configurés dans `credit_costs.tierCosts` :

| Tier | Crédits (défaut) |
|------|------------------|
| simple | 8 |
| standard | 12 |
| complex | 20 |
| very_complex | 35 |

API :
- `POST /api/imports/estimate` — body `{ extension, sizeBytes, mimeType? }`
- `GET /api/credits/costs/import-preview?extension=pdf&sizeBytes=…`

---

## Événements `ai_usage_events`

Champs enregistrés par analyse :

- `model`, `inputTokens`, `outputTokens`, `totalTokens`
- `durationMs`, `success`, `errorMessage` (sanitized)
- `estimatedCostUsd`, `costKnown` (interne)
- `creditsConsumed`, `creditTransactionId`, `tierKey`
- `documentType`, `referenceId` (session import)
- `metadata` : extension, sizeBytes, pageCountEstimate, detectedKind (jamais de contenu document)

Idempotence : `ai-usage:import:{sessionId}`

---

## Fiabilité crédits

- **Idempotence** : `import:{sessionId}` empêche double débit
- **Optimistic locking** : version sur `user_credit_accounts`
- **Pas de débit** si `analysis.errors` non vide
- **Rollback** : `CreditService.rollback_debit()` disponible via `AIUsageService.rollback_usage`
- **402** : crédits insuffisants avec `creditsRequired` / `creditsAvailable`

---

## Frontend

| Composant | Usage |
|-----------|--------|
| `CreditBalanceBadge` | Topbar, Billing, historique |
| `AiCreditsEstimate` | Import wizard avant lancement |
| `useCredits` | Solde partagé + refresh |
| `creditsApi.js` | `/api/credits/*`, estimate |

Routes : `/dashboard/billing/ai-history`

---

## Observabilité

- Logs structurés : `import.analyze.completed`, `import.analyze.failed`
- Admin : `GET /api/admin/ai-engine/metrics?period=30d`
- Métriques : taux d'échec, durée moyenne, crédits moyens, analyses lentes (>30s), coûteuses (>0.05 USD)

---

## Tests

```bash
cd backend
pytest tests/test_ai_import_estimator.py tests/test_ai_engine.py tests/test_credit_engine.py tests/test_credits_api.py -q
```

---

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `ANALYZER_PROVIDER` | mock | openai en prod |
| `CREDITS_ENFORCED` | false | true en production |
| `OPENAI_MODEL` | gpt-4o-mini | Modèle extraction |
| `OPENAI_*_USD_PER_1M_*` | voir ai_cost_config | Override tarifs |

Voir aussi : [CREDIT_ENGINE.md](./CREDIT_ENGINE.md), [ADMIN_ANALYTICS.md](./ADMIN_ANALYTICS.md).
