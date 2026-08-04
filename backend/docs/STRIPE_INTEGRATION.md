# Basera — Stripe Integration V1

> **Stripe = paiement uniquement.** Toute logique métier reste dans BillingService → SubscriptionService → CreditService.

---

## Architecture

```
Frontend BillingPage
    │  POST /api/billing/checkout
    │  POST /api/billing/portal
    │  POST /api/billing/change-plan
    │  GET  /api/billing/me
    ▼
billing.py (API)
    ▼
stripe_service.py          ← Customers, Checkout, Portal, plan mapping
    ▼
stripe_webhook_service.py  ← Signature + idempotence + dispatch
    ▼
BillingService             ← activate, renew, past_due, cancel, plan change
    ▼
SubscriptionService + CreditService
```

**Règle d'or :** l'activation d'abonnement ne se fait **jamais** via le retour navigateur seul — uniquement via webhooks signés.

---

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Clé secrète API (`sk_test_` ou `sk_live_`) — **uniquement** dans `backend/.env` / secrets deploy |
| `STRIPE_WEBHOOK_SECRET` | Secret endpoint webhook (`whsec_`) |
| `STRIPE_PRICE_SOLO` | Price ID Starter (API id `solo`) — `price_1U0ogXH44aox1nDPS97Gx7Vg` |
| `STRIPE_PRICE_PRO` | Price ID Pro — `price_1U0ogjH44aox1nDPsQvh4rgY` |
| `STRIPE_PRICE_TEAM` | Price ID Business (API id `team`) — `price_1U0ogwH44aox1nDPIqCVldxr` |
| `STRIPE_SUCCESS_URL` | Retour après paiement (ex. `.../billing?checkout=success`) |
| `STRIPE_CANCEL_URL` | Retour annulation checkout |

> Pas de clé publique (`pk_…`) dans le frontend : le Checkout Stripe est créé côté serveur.

Sans `STRIPE_SECRET_KEY` + prices + URLs, Basera **continue de fonctionner** — `stripeConfigured: false` dans `/api/billing/me`.

Catalogue public (UI) : Starter **4,90 €** · Pro **9,90 €** · Business **19,90 €** (`commercial_constants.py`).

Product IDs (référence Dashboard, non lus par le code) :
`prod_V0qNNdD2ykwbQk` (Starter) · `prod_V0qNzCQW7w0AJc` (Pro) · `prod_V0qNPuHEeAnv9s` (Business).

---

## Création produits Stripe

1. Dashboard Stripe → **Products**
2. Créer 3 produits récurrents mensuels : Starter, Pro, Business (montants 4,90 / 9,90 / 19,90 €)
3. Copier chaque **Price ID** (`price_...`) dans `STRIPE_PRICE_SOLO` / `PRO` / `TEAM`
4. Mode test d'abord (`sk_test_`, prices test) avant les Price Live ci-dessus

---

## Webhook

### Endpoint

`POST /api/stripe/webhook` (public, signé)

### Configuration Stripe Dashboard

1. Developers → Webhooks → Add endpoint
2. URL : `https://votre-domaine/api/stripe/webhook`
3. Événements :
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copier le **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### Test local (Stripe CLI)

```bash
stripe listen --forward-to localhost:8000/api/stripe/webhook
# Copier whsec_... affiché dans STRIPE_WEBHOOK_SECRET

stripe trigger checkout.session.completed
stripe trigger invoice.paid
```

---

## Événements traités

| Événement | Action Basera |
|-----------|----------------|
| `checkout.session.completed` | Crée/ active abonnement + crédits |
| `customer.subscription.created/updated` | Sync statut, plan, périodes Stripe |
| `customer.subscription.deleted` | Annulation |
| `invoice.paid` (cycle) | Renouvellement + nouveaux crédits mensuels |
| `invoice.payment_failed` | `past_due` |

Idempotence : collection `stripe_events` (`eventId` unique).

### E-mails transactionnels déclenchés

Après traitement métier réussi (non bloquant si l'e-mail échoue) :

| Événement | E-mail |
|-----------|--------|
| `checkout.session.completed` (trial) | `subscription_trial_started` |
| `checkout.session.completed` (paid) | `subscription_activated` |
| `customer.subscription.deleted` | `subscription_cancelled` |
| `customer.subscription.updated` (cancel at period end) | `subscription_cancellation_scheduled` |
| `invoice.paid` (cycle) | `subscription_renewed` |
| `invoice.payment_failed` | `subscription_payment_failed` |

Idempotence e-mail : `stripe-email:{eventId}:{template}` dans `email_events`. Voir `backend/docs/TRANSACTIONAL_EMAILS.md`.

---

## Essai gratuit (14 jours)

**Règle cohérente V1 :**

- Pas d'essai automatique à l'inscription
- Essai offert au **premier checkout** si l'utilisateur n'a jamais eu de trial (`trial_started` absent de l'historique)
- Stripe Checkout reçoit `trial_period_days=14`
- Webhook sync → statut interne `trial` + allocation crédits
- **Un seul trial par utilisateur**

---

## Upgrade / Downgrade

| Action | Comportement V1 |
|--------|-----------------|
| Upgrade | Immédiat via Stripe (`proration_behavior=create_prorations`) |
| Downgrade | Programmé fin de période via Subscription Schedule |
| Source de vérité | Webhook `customer.subscription.updated` |

API : `POST /api/billing/change-plan` `{ "planId": "pro" }`

---

## Customer Portal

`POST /api/billing/portal` → URL portail Stripe

Permet : moyen de paiement, factures, annulation, réactivation (selon config portail Stripe).

---

## Collections MongoDB

### `stripe_events`

| Champ | Description |
|-------|-------------|
| `eventId` | ID Stripe (unique) |
| `eventType` | Type événement |
| `status` | `processed`, `ignored`, `failed` |
| `userId` | Résolu si possible |
| `processedAt` | Horodatage |

### Champs Stripe sur `user_subscriptions`

- `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`
- `stripeCheckoutSessionId`, `stripeCurrentPeriodEnd`, `stripeStatus`
- `lastStripeEventId`

### `users.stripeCustomerId`

Index sparse unique — créé au premier checkout.

---

## Vérifier l'absence de double crédit

```bash
# Après renouvellement webhook
db.credit_transactions.find({ userId: "...", type: "monthly_grant" }).sort({ createdAt: -1 })

# Rejouer le même événement
stripe events resend evt_...
# → stripe_events.status = already_processed
# → pas de nouveau monthly_grant
```

---

## Sécurité

- Signature webhook obligatoire
- Aucun secret côté frontend
- `planId` validé via PlanService — pas de Price ID libre côté client
- Rate limit checkout / portal / change-plan
- Erreurs Stripe sanitizées (pas de fuite `sk_`)

---

## Packs de crédits permanents

Parcours complet pour l'achat de crédits IA supplémentaires (one-shot, `mode=payment`).

### Configuration

| Variable | Rôle |
|----------|------|
| `STRIPE_PRICE_CREDITS_1000` | Price ID pack 1 000 crédits |
| `STRIPE_PRICE_CREDITS_5000` | Price ID pack 5 000 crédits |
| `STRIPE_PRICE_CREDITS_15000` | Price ID pack 15 000 crédits |
| `DEV_CREDIT_PURCHASES_ENABLED` | Simulation locale sans Stripe (dev/test uniquement) |

Catalogue backend : `credit_pack_service.py` → collection `credit_packs`.

### Flux production (Stripe)

```
Frontend BillingPage
    │  POST /api/billing/credit-packs/checkout { packKey }
    ▼
stripe_service.create_credit_pack_checkout()
    │  metadata: userId, packKey, purchaseId, purchaseType=credit_pack
    │  enregistre credit_purchases status=pending
    ▼
Stripe Checkout (redirect)
    │  paiement réussi
    ▼
POST /api/stripe/webhook  checkout.session.completed
    ▼
stripe_webhook_service.handle_credit_pack_checkout_completed()
    ▼
BillingService.record_credit_purchase()  →  grant_permanent_credits()
```

**Règles :**
- Aucun crédit à la création de session Checkout
- Idempotence via `purchaseId` / `idempotencyKey` + index unique
- Webhook dupliqué → `stripe_events.status = already_processed`
- Metadata contrôlées côté backend (jamais de montant/credits depuis le client)

### Flux développement local

```
ENV=development
DEV_CREDIT_PURCHASES_ENABLED=true

POST /api/billing/credit-packs/dev-purchase { packKey }
Header Idempotency-Key (optionnel, anti double-clic)
    ▼
credit_purchase_service.simulate_dev_purchase()
    ▼
record_credit_purchase(method=development)
```

Désactiver ensuite : `DEV_CREDIT_PURCHASES_ENABLED=false` et configurer les `STRIPE_PRICE_CREDITS_*` pour le checkout réel.

### Tests

```bash
cd backend
python3 -m pytest tests/test_credit_purchases.py tests/test_stripe_integration.py -q
```

---

## Liens

- [Credit Engine](./CREDIT_ENGINE.md)
- [Subscription Engine](./SUBSCRIPTION_ENGINE.md)
