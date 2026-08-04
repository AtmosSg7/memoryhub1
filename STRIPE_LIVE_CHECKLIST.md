# Basera — Checklist passage Stripe Live

> **Objectif :** activer les paiements réels sans modifier le code. Toutes les valeurs Stripe passent par des variables d'environnement (`stripe_config.py`, `credit_pack_service.py`). **Ne jamais coller de clés Live dans le code, Git ou ce document.**

Référence technique : `backend/docs/STRIPE_INTEGRATION.md`

---

## Prérequis (avant toute bascule Live)

- [ ] Tous les scénarios de `STRIPE_TEST_PLAN.md` validés en **mode Test** (`sk_test_…`)
- [ ] Staging opérationnel avec `sk_test_…` et webhooks test pointant vers staging
- [ ] `ENV=production` + `CREDITS_ENFORCED=true` validés via `env_validation.validate_production_env()`
- [ ] `DEV_CREDIT_PURCHASES_ENABLED` **absent** ou `false` en production
- [ ] `STRIPE_BACKEND` absent ou `stripe` (jamais `fake` / `mock`)
- [ ] CI verte : `tests/test_stripe_integration.py`, `tests/test_credit_purchases.py`, `tests/test_subscription_engine.py`

---

## Étape 1 — Créer les produits Stripe (Dashboard **Live**)

Basculer le Dashboard Stripe en **mode Live** (interrupteur en haut à droite).

### 1.1 Abonnements récurrents (mensuels, EUR)

Créer **3 produits** récurrents, alignés sur le catalogue Basera (`commercial_constants.py`) :

| Plan Basera (API id) | Nom produit | Prix catalogue (UI) | Type Stripe | Price ID | Product ID |
|----------------------|-------------|---------------------|-------------|----------|------------|
| `solo` (Starter) | Basera Starter | 4,90 € / mois | Recurring monthly | `price_1U0ogXH44aox1nDPS97Gx7Vg` | `prod_V0qNNdD2ykwbQk` |
| `pro` (Pro) | Basera Pro | 9,90 € / mois | Recurring monthly | `price_1U0ogjH44aox1nDPsQvh4rgY` | `prod_V0qNzCQW7w0AJc` |
| `team` (Business) | Basera Business | 19,90 € / mois | Recurring monthly | `price_1U0ogwH44aox1nDPIqCVldxr` | `prod_V0qNPuHEeAnv9s` |

Variables d'environnement (dans `backend/.env` en local, `deploy/.env` en prod) :
- [ ] `STRIPE_PRICE_SOLO=price_1U0ogXH44aox1nDPS97Gx7Vg`
- [ ] `STRIPE_PRICE_PRO=price_1U0ogjH44aox1nDPsQvh4rgY`
- [ ] `STRIPE_PRICE_TEAM=price_1U0ogwH44aox1nDPIqCVldxr`
- [ ] Vérifier dans le Dashboard Stripe que chaque Price facture bien 4,90 / 9,90 / 19,90 €

> Les montants catalogue (`monthlyPriceEur` dans `commercial_constants.py` / `planConfig.js`) sont informatifs côté UI. **Stripe facture le montant du Price ID**, pas Mongo.

### 1.2 Packs Analyses IA (one-shot, EUR)

Créer **3 produits** à paiement unique, alignés sur `credit_pack_service.DEFAULT_CREDIT_PACKS` :

| Pack Basera | Nom produit suggéré | Prix catalogue (référence UI) | Crédits internes |
|----------------|---------------------|-------------------------------|------------------|
| `pack_10` | 10 analyses IA | 9,90 € | 500 |
| `pack_25` | 25 analyses IA | 39,00 € | 1 250 |
| `pack_50` | 50 analyses IA | 99,00 € | 2 500 |

Pour chaque pack :
- [ ] Créer un **Price** one-time en EUR
- [ ] Copier le **Price ID** (`price_…`)

> Affichage utilisateur : « analyses » (= crédits ÷ 50). Le backend accorde les crédits définis en base, pas le montant Stripe.

---

## Étape 2 — Variables d'environnement Live

Renseigner dans `deploy/.env` (jamais commité). Voir aussi `deploy/SECRETS_CHECKLIST.md`.

### 2.1 Clés API Live

| Variable | Valeur attendue | Notes |
|----------|-----------------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_…` | **Live uniquement** en production (`env_validation` refuse `sk_test_`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Secret de l'endpoint webhook **Live** (étape 3) |

### 2.2 Price IDs abonnements

| Variable | Plan | Price ID actuel |
|----------|------|-----------------|
| `STRIPE_PRICE_SOLO` | Starter (`solo`) | `price_1U0ogXH44aox1nDPS97Gx7Vg` |
| `STRIPE_PRICE_PRO` | Pro (`pro`) | `price_1U0ogjH44aox1nDPsQvh4rgY` |
| `STRIPE_PRICE_TEAM` | Business (`team`) | `price_1U0ogwH44aox1nDPIqCVldxr` |

### 2.3 Price IDs packs crédits

| Variable | Pack |
|----------|------|
| `STRIPE_PRICE_CREDITS_10` | Price ID Live pack_10 |
| `STRIPE_PRICE_CREDITS_25` | Price ID Live pack_25 |
| `STRIPE_PRICE_CREDITS_50` | Price ID Live pack_50 |

> **Note :** `env_validation` exige les 3 prices abonnement au démarrage staging/prod, mais **pas** les prices packs. Vérifier manuellement que les 3 packs ont `stripeConfigured: true` via `GET /api/billing/credit-packs`.

### 2.4 URLs de retour Checkout

| Variable | Exemple production |
|----------|-------------------|
| `STRIPE_SUCCESS_URL` | `https://app.votredomaine.fr/dashboard/billing?checkout=success` |
| `STRIPE_CANCEL_URL` | `https://app.votredomaine.fr/dashboard/billing?checkout=cancel` |

Règles :
- [ ] HTTPS obligatoire (`FRONTEND_PUBLIC_URL` / `STRIPE_*_URL` validés en prod)
- [ ] Le frontend gère aussi `?credits=success` / `?credits=cancel` pour les packs (suffixe ajouté automatiquement par `stripe_service.create_credit_pack_checkout`)

### 2.5 URLs publiques associées

| Variable | Rôle |
|----------|------|
| `BACKEND_PUBLIC_URL` | Base URL API — webhook = `{BACKEND_PUBLIC_URL}/api/stripe/webhook` |
| `FRONTEND_PUBLIC_URL` | Liens e-mails / portail retour |

---

## Étape 3 — Webhook Live

### 3.1 Créer l'endpoint (Dashboard Live → Developers → Webhooks)

- [ ] URL : `https://<domaine-production>/api/stripe/webhook`
- [ ] Événements à activer (liste exacte du code — `stripe_constants.HANDLED_STRIPE_EVENT_TYPES`) :
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- [ ] Copier le **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### 3.2 Vérifications post-création

- [ ] Envoyer un événement test depuis le Dashboard → statut 200
- [ ] Vérifier entrée dans Mongo `stripe_events` (`status: processed` ou `ignored`)
- [ ] Aucune clé `sk_` dans les logs (`stripe_event_service` sanitize les erreurs)

### 3.3 Idempotence

- [ ] Rejouer le même `eventId` → réponse `already_processed`
- [ ] Pas de double `monthly_grant` dans `credit_transactions`
- [ ] Pas de double achat pack dans `credit_purchases`

---

## Étape 4 — Customer Portal Stripe (Live)

`POST /api/billing/portal` ouvre le portail Stripe.

Dans Dashboard Live → **Settings → Billing → Customer portal** :

- [ ] Activer : mise à jour moyen de paiement, historique factures
- [ ] Activer : annulation d'abonnement (fin de période recommandé)
- [ ] Activer : réactivation si souhaité
- [ ] URL de retour : domaine production (`/dashboard/billing`)
- [ ] L'annulation passe par le portail → webhook `customer.subscription.updated` (`cancel_at_period_end`) ou `customer.subscription.deleted`

---

## Étape 5 — Seed base production

Au premier démarrage (`server.py` startup) :

- [ ] Plans Mongo seedés (`plan_service.seed_default_plans`) : solo / pro / team
- [ ] Packs Mongo seedés (`credit_pack_service.seed_default_credit_packs`) avec `stripePriceId` lu depuis l'env
- [ ] Redémarrer le backend **après** avoir renseigné les `STRIPE_PRICE_CREDITS_*` pour peupler `credit_packs.stripePriceId`

Commande de vérification :
```bash
# Dans le conteneur backend
python -c "from env_validation import validate_production_env; validate_production_env(); print('OK')"
```

---

## Étape 6 — Ordre exact de migration Test → Live

**Ne pas sauter d'étape. Ne pas activer Live avant la fin de l'étape 5 en staging.**

| # | Action | Environnement |
|---|--------|---------------|
| 1 | Valider tous les tests `STRIPE_TEST_PLAN.md` | Local + Test keys |
| 2 | Déployer staging avec `sk_test_…` + webhook test → URL staging | Staging |
| 3 | Smoke test complet staging (checkout, webhook, portal, pack) | Staging |
| 4 | Créer produits + prices **Live** dans Dashboard Live | Stripe Live |
| 5 | Créer webhook endpoint **Live** (ne pas réutiliser l'URL test) | Stripe Live |
| 6 | Configurer Customer Portal Live | Stripe Live |
| 7 | Préparer `deploy/.env` production avec toutes les variables §2 | Secrets |
| 8 | **Maintenance fenêtre courte** (optionnel) ou bascule directe | Production |
| 9 | Mettre à jour `deploy/.env` : `sk_live_…`, `whsec_…` Live, Price IDs Live | Production |
| 10 | Redéployer backend (`docker-compose.production.yml`) | Production |
| 11 | Vérifier `GET /api/billing/me` → `stripeConfigured: true`, `stripeTestMode: false` | Production |
| 12 | Checkout **réel** interne (carte test Live si disponible, sinon premier client pilote) | Production |
| 13 | Confirmer webhook reçu + `user_subscriptions` + `subscription_history` + crédits | Production |
| 14 | Tester pack crédits Live (montant faible) | Production |
| 15 | Monitorer `stripe_events` (aucun `failed`) pendant 24 h | Production |

### Rollback rapide

1. Repasser `STRIPE_SECRET_KEY` sur `sk_test_…` **uniquement si** l'objectif est désactiver les paiements (pas un rollback métier)
2. Ou retirer `STRIPE_SECRET_KEY` → `stripeConfigured: false`, checkout désactivé, app fonctionnelle
3. Les abonnements déjà actifs restent dans Stripe — gérer manuellement dans le Dashboard

---

## Étape 7 — Contrôles post-bascule

### MongoDB

| Collection | Vérification |
|------------|--------------|
| `user_subscriptions` | `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeStatus` renseignés |
| `subscription_history` | Événements `trial_started`, `activated`, `renewed`, `plan_changed`, etc. |
| `stripe_events` | `eventId` unique, pas de `failed` non traité |
| `credit_purchases` | Packs `status: completed`, `method: stripe` |
| `credit_transactions` | `monthly_grant` au renouvellement, `permanent_grant` à l'achat pack |
| `users` | `stripeCustomerId` sparse unique |

### API

```bash
curl -s https://<domaine>/api/billing/me -H "Cookie: ..." | jq '.stripeConfigured, .stripeTestMode'
```

- [ ] `stripeConfigured: true`
- [ ] `stripeTestMode: false` en production Live

### E-mails transactionnels (non bloquants)

| Webhook | Template |
|---------|----------|
| Checkout trial | `subscription_trial_started` |
| Checkout paid | `subscription_activated` |
| `invoice.paid` (cycle) | `subscription_renewed` |
| `invoice.payment_failed` | `subscription_payment_failed` |
| `subscription.deleted` | `subscription_cancelled` |
| Cancel at period end | `subscription_cancellation_scheduled` |

Idempotence e-mail : `stripe-email:{eventId}:{template}`

---

## Architecture rappel (aucun secret en code)

```
Frontend → POST /api/billing/checkout|portal|change-plan|credit-packs/checkout
         → stripe_service (LiveStripeBackend)
         → Stripe API

Stripe   → POST /api/stripe/webhook (signature whsec_)
         → stripe_webhook_service (claim_event idempotent)
         → billing_service → subscription_service + credit_service
```

**Règle d'or :** l'activation d'abonnement ne se fait **jamais** via le retour navigateur seul — uniquement via webhooks signés.

---

## Écarts connus à surveiller (pas bloquants code)

| Point | Détail |
|-------|--------|
| Prices packs | Non validés au boot par `env_validation` — vérifier manuellement |
| `STRIPE_INTEGRATION.md` | Anciens noms `STRIPE_PRICE_CREDITS_1000` — utiliser `STRIPE_PRICE_CREDITS_10/25/50` |
| Change-plan downgrade | Mongo mis à jour au webhook `subscription.updated`, pas à l'appel API immédiat |
| Annulation | Via Customer Portal Stripe, pas d'endpoint `/billing/cancel` dédié |
| Essai gratuit | 14 jours au **premier** checkout uniquement (`user_has_trial_history`) |

---

## Contacts / ressources

- Dashboard Stripe Live : https://dashboard.stripe.com
- Logs webhook : Dashboard → Developers → Webhooks → endpoint → Recent deliveries
- Doc interne : `backend/docs/STRIPE_INTEGRATION.md`, `backend/docs/SUBSCRIPTION_ENGINE.md`, `backend/docs/CREDIT_ENGINE.md`
- Secrets : `deploy/SECRETS_CHECKLIST.md`, `deploy/DEPLOY.md`
