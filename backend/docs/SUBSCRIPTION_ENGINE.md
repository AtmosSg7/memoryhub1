# MemoryHub — Subscription Engine V1

> **Indépendant de Stripe.** Le moteur gère la logique métier des abonnements ; les webhooks Stripe appelleront `BillingService` plus tard.

---

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│  Stripe webhooks (futur)                                         │
│         │                                                        │
│         ▼                                                        │
│  BillingService          ← seul point d'entrée paiement          │
│         │                                                        │
│         ▼                                                        │
│  SubscriptionService     ← machine à états abonnement           │
│         │                                                        │
│    ┌────┴────────────────┐                                      │
│    ▼                     ▼                                      │
│ SubscriptionHistory   CreditService                             │
│ Service               (crédits mensuels)                        │
└─────────────────────────────────────────────────────────────────┘
```

### Plans supportés

| Plan | Crédits mensuels |
|------|------------------|
| Solo | 1 000 |
| Pro | 5 000 |
| Team | 15 000 |

### États

| État | Description |
|------|-------------|
| `trial` | Essai 14 jours — crédits alloués |
| `active` | Abonnement payant actif |
| `past_due` | Paiement en échec — crédits conservés (grace) |
| `cancelled` | Annulé |
| `expired` | Trial ou période terminée sans renouvellement |
| `suspended` | Suspension admin — pas de crédits |

---

## Collections MongoDB

### `user_subscriptions`

Un document par utilisateur (`userId` unique).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | uuid | Identifiant abonnement |
| `userId` | string | Propriétaire (unique) |
| `status` | string | État courant |
| `planId` | string | `solo` / `pro` / `team` |
| `trialStartedAt` / `trialEndsAt` | ISO8601? | Fenêtre d'essai |
| `currentPeriodStart` / `currentPeriodEnd` | ISO8601 | Période de facturation |
| `periodKey` | string | Clé alignée crédits (`sub-{id}-{YYYYMMDD}`) |
| `cancelAtPeriodEnd` | bool | Annulation programmée |
| `cancelledAt` / `activatedAt` / `expiredAt` | ISO8601? | Horodatages |
| `suspendedAt` / `pastDueAt` | ISO8601? | Horodatages |
| `version` | int | Verrou optimiste |

### `subscription_history`

Grand livre append-only des événements.

| Champ | Type | Description |
|-------|------|-------------|
| `event` | string | `trial_started`, `activated`, `renewed`, `upgraded`, … |
| `previousStatus` / `newStatus` | string | Transition |
| `previousPlanId` / `newPlanId` | string? | Changement d'offre |
| `idempotencyKey` | string? | Anti-replay webhooks |

---

## Services

### `SubscriptionService`

| Méthode | Rôle |
|---------|------|
| `create_subscription()` | Création avec ou sans trial 14j |
| `activate_subscription()` | Trial → Active |
| `activate_paid_subscription()` | Checkout / dev helper |
| `renew_subscription()` | Nouvelle période + crédits |
| `change_plan()` | Upgrade / downgrade immédiat |
| `upgrade_subscription()` / `downgrade_subscription()` | Wrappers avec validation tier |
| `cancel_subscription()` | Immédiat ou fin de période |
| `reactivate_subscription()` | Depuis cancelled / expired |
| `mark_past_due()` | Paiement échoué |
| `suspend_subscription()` / `resume_subscription()` | Admin |
| `expire_subscription()` | Expiration forcée |
| `sync_lifecycle()` | Expiration lazy (trial, fin période) |

### `SubscriptionHistoryService`

- `append_event()` — audit
- `list_history()` — historique paginé
- `find_by_idempotency_key()` — replay webhooks

### `BillingService` (façade Stripe)

| Handler futur | Appelle |
|---------------|---------|
| `activate_subscription()` | `activate_paid_subscription()` |
| `handle_subscription_renewed()` | `renew_subscription()` |
| `handle_payment_failed()` | `mark_past_due()` |
| `handle_subscription_cancelled()` | `cancel_subscription()` |
| `handle_plan_changed()` | `change_plan()` |
| `start_subscription()` | `create_subscription()` avec trial |

---

## Intégration Credit Engine

1. **Période d'abonnement** : `periodKey` préfixé `sub-` — le rollover calendaire est désactivé
2. **Activation / renouvellement** : `grant_monthly_credits()` avec période explicite
3. **Idempotence crédits** : `sub-grant:{subscriptionId}:{periodKey}:{planId}`
4. **Priorité consommation** : inchangée (mensuel → permanent)
5. **Expiration / suspension** : `planId` retiré du compte crédit

---

## API REST (`/api/subscriptions`)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /me` | Oui | Abonnement courant |
| `GET /history` | Oui | Historique événements |
| `GET /plans` | Non | Catalogue Solo/Pro/Team |
| `POST /dev/start-trial` | Oui (dev) | Démarrer trial |
| `POST /dev/activate` | Oui (dev) | Trial → Active |
| `POST /dev/activate-paid` | Oui (dev) | Active direct (remplace assign-plan) |
| `POST /dev/renew` | Oui (dev) | Simuler renouvellement |
| `POST /dev/change-plan` | Oui (dev) | Changer d'offre |
| `POST /dev/upgrade` / `/downgrade` | Oui (dev) | |
| `POST /dev/cancel` | Oui (dev) | Annulation |
| `POST /dev/reactivate` | Oui (dev) | Réactivation |
| `POST /dev/expire` | Oui (dev) | Expiration forcée |
| `POST /dev/past-due` | Oui (dev) | Simuler échec paiement |
| `POST /dev/suspend` / `/resume` | Oui (dev) | Suspension admin |

---

## Tests

```bash
cd backend
python3 -m pytest tests/test_subscription_engine.py tests/test_subscriptions_api.py -q
python3 -m pytest tests/ -q   # suite complète (95 tests)
```

---

## Avant de brancher Stripe

> **Implémenté** — voir [`STRIPE_INTEGRATION.md`](./STRIPE_INTEGRATION.md).

1. ~~`stripeCustomerId` / `stripeSubscriptionId`~~ → champs sur `user_subscriptions` + `users`
2. Mapper `price_id` → `planId` sur `credit_plans`
3. Router webhooks signés → `BillingService`
4. Idempotence événements Stripe via `idempotencyKey` sur history + crédits
5. Renouvellement auto : `invoice.paid` → `handle_subscription_renewed()`
6. Échec paiement : `invoice.payment_failed` → `handle_payment_failed()`
7. Annulation : `customer.subscription.deleted` → `handle_subscription_cancelled()`
8. Changement plan : `customer.subscription.updated` → `handle_plan_changed()`
9. Retirer endpoints `/dev/*` en production (déjà masqués si `ENV=production`)
10. Brancher `BillingPage.jsx` sur `/subscriptions/me` + `/credits/balance`

---

## Sécurité

- Un abonnement actif par utilisateur
- Transitions validées (impossible d'activer un non-trial)
- Historique immuable
- Endpoints dev invisibles en production
- Isolation stricte par `userId`

---

## Scalabilité

- Document unique par utilisateur — O(1) reads/writes
- Expiration lazy à la lecture (`sync_lifecycle`) — pas de cron global
- Historique indexé par `userId` + `createdAt`
- Verrou optimiste `version` sur transitions
- Alignement période crédits/abonnement sans recalcul global
