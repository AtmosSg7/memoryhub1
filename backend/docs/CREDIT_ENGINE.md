# MemoryHub — AI Credit Engine V1

> **Unité client unique : Crédits IA.**  
> Jamais d'euros, de dollars, ni de coût OpenAI exposé à l'utilisateur.

Ce document décrit l'architecture, les conventions et les points d'intégration du moteur de crédits IA.

---

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│  Application (import, email, search, …)                           │
│         │                                                         │
│         ▼                                                         │
│  AIUsageService          ← SEUL point d'entrée pour la conso IA   │
│         │                                                         │
│         ▼                                                         │
│  CreditService           ← mutations de solde (grant / consume)   │
│         │                                                         │
│    ┌────┴────┬──────────────────┐                                │
│    ▼         ▼                  ▼                                │
│ PlanService  CreditCostService  CreditTransactionService           │
│    │              │                    │                          │
│    ▼              ▼                    ▼                          │
│ credit_plans   credit_costs    credit_transactions                │
│                user_credit_accounts                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Stripe / paiement (futur)                                      │
│         │                                                         │
│         ▼                                                         │
│  BillingService          ← webhooks Stripe appellent ICI        │
└─────────────────────────────────────────────────────────────────┘
```

### Règles non négociables

1. **Toute consommation IA** passe par `AIUsageService` — jamais `CreditService.consume()` directement depuis le code métier.
2. **Tout coût** est résolu via `CreditCostService.resolve_cost()` — jamais de valeur en dur dans les composants.
3. **Tout crédit** (abonnement, achat, bonus, admin, remboursement) passe par `CreditService` ou `BillingService`.
4. **Priorité de consommation** : crédits mensuels d'abord, puis crédits permanents.
5. **Crédits mensuels** expirent à chaque période (`periodKey` = `YYYY-MM`). Les permanents n'expirent jamais.

---

## Collections MongoDB

### `credit_packs`

Catalogue des packs de crédits permanents (source de vérité unique).

| Champ | Type | Description |
|-------|------|-------------|
| `packKey` | string | Clé stable (`pack_1000`, …) |
| `name` | string | Nom affiché |
| `credits` | int | Crédits permanents accordés |
| `priceCents` | int | Prix TTC en centimes |
| `currency` | string | Devise ISO (`eur`) |
| `stripePriceId` | string? | Price ID Stripe (via env au seed) |
| `isActive` | bool | Pack visible / achetable |
| `sortOrder` | int | Ordre d'affichage |

**Index :** `packKey` (unique), `id` (unique)

Packs par défaut seedés au démarrage (`credit_pack_service.py`) — modifier `DEFAULT_CREDIT_PACKS` ou les documents MongoDB.

### `credit_purchases`

Historique des achats de packs (Stripe ou simulation dev).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | uuid | Identifiant achat |
| `userId` | string | Acheteur |
| `packKey` | string | Pack acheté |
| `credits` | int | Crédits accordés |
| `priceCents` / `currency` | | Montant facturé |
| `status` | string | `pending`, `completed`, `failed`, `cancelled` |
| `method` | string | `stripe` ou `development` |
| `idempotencyKey` | string? | Anti double-crédit |
| `stripeCheckoutSessionId` | string? | Session Checkout |
| `stripePaymentIntentId` | string? | Payment Intent |
| `stripeEventId` | string? | Event webhook traité |
| `creditTransactionId` | string? | Lien ledger |

**Index :** `id` (unique), `(userId, createdAt)`, `(userId, idempotencyKey)` (unique, partial)

### `credit_plans`

Catalogue des offres d'abonnement.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant stable (`solo`, `pro`, `team`) |
| `name` | string | Nom affiché |
| `monthlyCredits` | int | Allocation mensuelle |
| `isActive` | bool | Plan disponible |
| `sortOrder` | int | Ordre d'affichage |
| `createdAt` / `updatedAt` | ISO8601 | Audit |

**Index :** `id` (unique)

### `credit_costs`

Coûts configurables par action IA.

| Champ | Type | Description |
|-------|------|-------------|
| `actionKey` | string | Clé d'action (`IMPORT_DOCUMENT`, …) |
| `label` | string | Libellé humain |
| `defaultCost` | int | Coût par défaut |
| `supportsTiers` | bool | Coûts variables par tier |
| `tierCosts` | object | Ex. `{ "simple": 8, "complex": 20 }` |
| `isActive` | bool | Coût actif |

**Index :** `actionKey` (unique)

Modifier un coût = mettre à jour ce document. Aucun redéploiement applicatif requis.

> **Estimation import :** voir [AI_ENGINE.md](./AI_ENGINE.md) — service `ai_import_estimator.py`, tiers actifs en production.

### `user_credit_accounts`

Compte crédit par utilisateur (deux seaux).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | uuid | Identifiant document |
| `userId` | string | FK utilisateur (unique) |
| `planId` | string? | Plan actif |
| `periodKey` | string | Période courante `YYYY-MM` |
| `periodStart` / `periodEnd` | ISO8601 | Bornes de la période |
| `monthlyCreditsRemaining` | int | Solde mensuel (expire) |
| `monthlyCreditsAllocated` | int | Allocation de la période |
| `permanentCreditsRemaining` | int | Solde permanent |
| `version` | int | Verrou optimiste pour concurrence |
| `createdAt` / `updatedAt` | ISO8601 | Audit |

**Index :** `userId` (unique), `id` (unique)

### `credit_transactions`

Grand livre append-only (historique complet).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | uuid | Identifiant transaction |
| `userId` | string | Propriétaire |
| `type` | string | Voir types ci-dessous |
| `monthlyDelta` / `permanentDelta` | int | Variation par seau |
| `monthlyBalanceAfter` / `permanentBalanceAfter` | int | Soldes après opération |
| `actionKey` / `tierKey` | string? | Action IA (débits) |
| `costApplied` | int? | Coût effectivement débité |
| `source` | string? | `subscription`, `purchase`, `ai_usage`, … |
| `referenceType` / `referenceId` | string? | Lien métier |
| `idempotencyKey` | string? | Anti double-débit |
| `reversedTransactionId` | string? | Rollback |
| `label` / `metadata` | | Lisibilité + contexte |
| `createdAt` | ISO8601 | Horodatage |

**Types de transaction :** `debit`, `monthly_grant`, `permanent_grant`, `bonus`, `admin_grant`, `refund`, `rollback`, `monthly_expiry`

**Index :**
- `id` (unique)
- `(userId, createdAt)` — historique
- `(userId, type, createdAt)` — filtrage
- `(userId, idempotencyKey)` (unique, partial) — idempotence

---

## Services

### `PlanService` (`plan_service.py`)

- CRUD catalogue plans
- `seed_default_plans()` au démarrage

### `CreditCostService` (`credit_cost_service.py`)

- `resolve_cost(db, action_key, tier_key?, override_cost?)` — résolution centralisée
- `override_cost` permet un coût pré-calculé (futur estimateur d'import)
- `seed_default_costs()` au démarrage

### `CreditTransactionService` (`credit_transaction_service.py`)

- `append_transaction()` — écriture ledger
- `find_by_idempotency_key()` — replay sûr
- `list_transactions()` — historique paginé

### `CreditService` (`credit_service.py`) — cœur du moteur

| Méthode | Rôle |
|---------|------|
| `ensure_account()` | Crée le compte à la première interaction |
| `get_balance()` | Solde public + rollover automatique |
| `rollover_period_if_needed()` | Expire mensuel, ré-alloue si plan actif |
| `grant_monthly_credits()` | Allocation abonnement |
| `grant_permanent_credits()` | Achat / bonus / admin / refund |
| `can_consume()` | Pré-vol (avant appel OpenAI) |
| `consume()` | Débit atomique avec priorité mensuel → permanent |
| `rollback_debit()` | Annulation d'un débit IA |
| `refund_to_permanent()` | Remboursement en crédits permanents |

**Concurrence :** `consume()` utilise un verrou optimiste (`version` + retry, max 5). La condition `monthlyCreditsRemaining >= from_monthly AND permanentCreditsRemaining >= from_permanent` garantit l'atomicité.

**Idempotence :** si `idempotencyKey` existe déjà, retourne la transaction existante (`idempotentReplay: true`).

**Mode lancement :** `CREDITS_ENFORCED=false` (défaut) — les actions IA sont autorisées même sans solde ; le débit est partiel ou nul avec métadonnée `waived`. Passer à `true` en production pour bloquer (HTTP 402).

### `AIUsageService` (`ai_usage_service.py`)

**Point d'entrée obligatoire pour toute action IA.**

```python
# Avant OpenAI
cost = await require_credits_for_import(db, user_id, tier_key="standard")

# Après succès
result = await consume_for_import(db, user_id, session_id=session_id, tier_key="standard")

# En cas d'échec après débit
await rollback_usage(db, user_id, result.transactionId)
```

Helpers génériques : `check_before_action()`, `record_usage(AIUsageRequest)`.

### `BillingService` (`billing_service.py`)

**Point d'entrée futur pour Stripe.** Ne pas appeler Stripe depuis `CreditService`.

| Méthode | Déclencheur futur |
|---------|-------------------|
| `activate_subscription()` | Webhook `checkout.session.completed` / renouvellement |
| `record_credit_purchase()` | Achat pack crédits (webhook Stripe ou dev simulé) |
| `grant_bonus_credits()` | Campagne marketing |
| `grant_admin_credits()` | Opérateur / support |

---

## Actions IA (`credit_constants.py`)

| Clé | Usage |
|-----|-------|
| `IMPORT_DOCUMENT` | Analyse GPT à l'import (tiers supportés) |
| `EMAIL_GENERATION` | Génération d'e-mail |
| `SUMMARY` | Résumé client |
| `CLIENT_ANALYSIS` | Analyse client |
| `SEARCH_AI` | Recherche intelligente |

Ajouter une action = ajouter la clé dans `CreditActionKey`, seed un coût dans `credit_costs`, exposer via `AIUsageService`.

---

## API REST

### `/api/credits`

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /balance` | Oui | Solde utilisateur |
| `GET /transactions` | Oui | Historique (limit, type) |
| `GET /costs` | Non | Catalogue public des coûts |
| `GET /costs/import-preview?tier=` | Non | Preview coût import |
| `POST /dev/assign-plan?planId=` | Oui (dev only) | Assigner un plan sans Stripe |

### `/api/billing` — achats de crédits

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /credit-packs` | Oui | Packs actifs + flags dev/Stripe |
| `GET /credit-purchases` | Oui | Historique achats de l'utilisateur |
| `POST /credit-packs/dev-purchase` | Oui | Simulation locale (`packKey` uniquement) |
| `POST /credit-packs/checkout` | Oui | Crée session Stripe Checkout (`mode=payment`) |

**Mode dev local :** `ENV=development` (ou `test`) **et** `DEV_CREDIT_PURCHASES_ENABLED=true`. Refusé en staging/production même si la variable est mal configurée — la validation au démarrage échoue si activé hors dev/test.

**Parcours Stripe :** le frontend envoie uniquement `packKey`. Les crédits sont accordés **uniquement** après webhook `checkout.session.completed` validé (`purchaseType=credit_pack`). Header `Idempotency-Key` supporté sur l'achat dev.

---

## Intégration existante

- **`import_service.py`** : `require_credits_for_import()` avant analyse, `consume_for_import()` après succès (idempotency `import:{session_id}`).
- **`server.py`** : indexes, `seed_credit_catalog()` au startup, router `/credits`.

---

## Tests

```bash
cd backend
python3 -m pytest tests/test_credit_engine.py tests/test_credits_api.py tests/test_credit_purchases.py -q
python3 -m pytest tests/ -q   # suite complète
```

Couverture critique :
- Grant mensuel / permanent
- Priorité mensuel → permanent
- Insuffisance de crédits
- Idempotence
- Rollback
- Expiration mensuelle (rollover)
- Historique transactions
- Résolution tier
- BillingService (activate, purchase, bonus)
- Concurrence (3/5 débits sur solde 10)
- API balance / transactions

---

## Avant de brancher Stripe

> **Implémenté** — voir [`STRIPE_INTEGRATION.md`](./STRIPE_INTEGRATION.md).

1. ~~Webhooks Stripe~~ → `POST /api/stripe/webhook` → `BillingService`
2. **Mapper** `price_id` Stripe → `planId` MemoryHub
3. **Renouvellement mensuel** : webhook `invoice.paid` → `activate_subscription()` (rollover gère l'expiration)
4. **Achat crédits** : checkout one-shot → `record_credit_purchase()` — **implémenté** (voir ci-dessous)
5. **Activer** `CREDITS_ENFORCED=true` en production
6. **Frontend** : brancher `BillingPage` sur `/api/credits/balance` et `/api/credits/transactions`
7. **UI import** : gérer HTTP 402 (crédits insuffisants)
8. **Estimateur complexité import** : calculer tier → `consume_for_import(tier_key=...)`
9. **Admin** : endpoint sécurisé pour `grant_admin_credits()` (rôle opérateur)
10. **Monitoring** : alertes sur `CreditConcurrencyError`, ratio `waived` en mode soft

---

## Sécurité

- Isolation stricte par `userId` sur comptes et transactions
- Idempotence empêche le double-débit sur retry réseau
- Ledger append-only — audit trail complet
- Coûts publics (`/costs`) — transparence produit
- Endpoint dev `assign-plan` désactivé en `ENV=production`
- Pas de mutation directe des collections depuis l'API utilisateur (sauf dev helper)

---

## Scalabilité

- Compte par utilisateur = document unique, updates atomiques O(1)
- Ledger partitionné logiquement par `userId` — index `(userId, createdAt)`
- Pas de compteur global — pas de goulot d'étranglement
- Verrou optimiste adapté à des centaines de milliers d'utilisateurs (retry court)
- Coûts et plans en lecture cacheable (faible churn)
- Rollover lazy (à la première lecture du solde) — pas de cron global requis
