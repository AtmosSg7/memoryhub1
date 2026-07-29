# MemoryHub — Plan de tests Stripe (avant activation Live)

> **Objectif :** valider tous les parcours de paiement en **mode Test** (`sk_test_…`) avant de basculer les clés Live. Aucun test Live avec de l'argent réel tant que cette checklist n'est pas entièrement cochée.

**Environnement recommandé :** staging avec `ENV=staging`, `CREDITS_ENFORCED=true`, `STRIPE_SECRET_KEY=sk_test_…`

---

## 0. Préparation

### Variables d'environnement test

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...        # Stripe CLI ou endpoint test Dashboard
STRIPE_PRICE_SOLO=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...
STRIPE_PRICE_CREDITS_10=price_...
STRIPE_PRICE_CREDITS_25=price_...
STRIPE_PRICE_CREDITS_50=price_...
STRIPE_SUCCESS_URL=https://<staging>/dashboard/billing?checkout=success
STRIPE_CANCEL_URL=https://<staging>/dashboard/billing?checkout=cancel
DEV_CREDIT_PURCHASES_ENABLED=false
CREDITS_ENFORCED=true
```

### Outils

- [ ] Stripe CLI : `stripe listen --forward-to <url>/api/stripe/webhook`
- [ ] Cartes test Stripe : `4242 4242 4242 4242` (succès), `4000 0000 0000 0341` (échec)
- [ ] Accès Mongo staging pour vérifier collections

### Tests automatisés (gate CI)

```bash
cd backend
CREDITS_ENFORCED=0 python3 -m pytest tests/test_stripe_integration.py tests/test_credit_purchases.py tests/test_subscription_engine.py tests/test_rc_env_production.py -q
```

- [ ] Suite verte avant tests manuels

---

## 1. Checkout abonnement

| # | Scénario | Étapes | Résultat attendu | Collections / API |
|---|----------|--------|------------------|-------------------|
| 1.1 | Premier checkout Solo | Utilisateur sans abonnement → Billing → Solo → Checkout → carte 4242… | Redirection `?checkout=success` | Webhook `checkout.session.completed` |
| 1.2 | Activation via webhook | Attendre webhook (pas seulement refresh page) | `GET /api/billing/me` : `hasSubscription: true`, `planId: solo` | `user_subscriptions`, `subscription_history` (`trial_started` ou `activated`) |
| 1.3 | Essai 14 jours | Nouvel utilisateur, jamais eu de trial | Checkout avec trial Stripe ; statut interne `trial` | `trialEndsAt` renseigné, crédits mensuels alloués |
| 1.4 | Pas de second trial | Utilisateur ayant déjà eu un trial → nouveau checkout | Pas de `trial_period_days` dans Stripe | Statut `active` direct |
| 1.5 | Double checkout bloqué | Utilisateur déjà abonné → `POST /api/billing/checkout` | HTTP 409 | Pas de nouvelle session |
| 1.6 | Plan invalide | `planId: invalid` | HTTP 404 | — |
| 1.7 | Stripe non configuré | Sans `STRIPE_SECRET_KEY` | HTTP 503, `stripeConfigured: false` | — |

**Vérifications crédits :**
- [ ] Solo → 20 analyses mensuelles restantes (1000 crédits)
- [ ] `credit_transactions` contient `monthly_grant`

---

## 2. Checkout packs Analyses IA

| # | Scénario | Étapes | Résultat attendu | Collections |
|---|----------|--------|------------------|-------------|
| 2.1 | Liste packs | `GET /api/billing/credit-packs` | 3 packs, `stripeConfigured: true` chacun | `credit_packs` |
| 2.2 | Checkout pack_10 | Billing → acheter pack → Checkout → 4242… | Redirection `?credits=success` | `credit_purchases` `status: pending` puis `completed` |
| 2.3 | Crédits permanents | Après webhook | `permanentRemaining` +10 analyses | `credit_transactions` `permanent_grant` |
| 2.4 | Pas de crédit avant paiement | Session créée, abandon checkout | Aucun crédit accordé | `pending` seulement |
| 2.5 | Pack sans price env | Retirer `STRIPE_PRICE_CREDITS_10`, restart | `stripeConfigured: false` sur pack | Checkout HTTP 400/503 |
| 2.6 | Historique achats | `GET /api/billing/credit-purchases` | Achat listé avec `method: stripe` | — |

---

## 3. Upgrade

| # | Scénario | Étapes | Résultat attendu |
|---|----------|--------|------------------|
| 3.1 | Upgrade Solo → Pro | `POST /api/billing/change-plan` `{planId: pro}` | `effective: immediate` |
| 3.2 | Stripe proration | Vérifier Dashboard Stripe | Proration créée |
| 3.3 | Sync Mongo | Webhook `customer.subscription.updated` | `planId: pro`, crédits mensuels Pro (80 analyses) |
| 3.4 | Historique | `GET /api/subscriptions/history` | Événement `plan_changed` / `upgraded` |

---

## 4. Downgrade

| # | Scénario | Étapes | Résultat attendu |
|---|----------|--------|------------------|
| 4.1 | Downgrade Pro → Solo | `POST /api/billing/change-plan` `{planId: solo}` | `effective: next_period` |
| 4.2 | Subscription Schedule | Dashboard Stripe | Schedule créé, changement en fin de période |
| 4.3 | Plan inchangé avant échéance | Immédiatement après API | `planId` encore `pro` jusqu'au webhook |
| 4.4 | Sync fin de période | Simuler / attendre fin période + webhook | `planId: solo`, crédits ajustés |

---

## 5. Annulation

| # | Scénario | Étapes | Résultat attendu |
|---|----------|--------|------------------|
| 5.1 | Annulation fin de période | Customer Portal → annuler | Webhook `subscription.updated`, `cancel_at_period_end: true` |
| 5.2 | Statut MemoryHub | `GET /api/billing/me` | `cancelAtPeriodEnd: true` |
| 5.3 | Historique | — | `cancellation_scheduled` |
| 5.4 | E-mail | — | `subscription_cancellation_scheduled` (idempotent) |
| 5.5 | Fin de période | Après `currentPeriodEnd` | Statut `cancelled`, crédits plan retirés |
| 5.6 | Annulation immédiate | Portal ou Dashboard Stripe → delete sub | Webhook `subscription.deleted` → `cancelled` immédiat |

---

## 6. Renouvellement

| # | Scénario | Étapes | Résultat attendu |
|---|----------|--------|------------------|
| 6.1 | Cycle mensuel | `invoice.paid` avec `billing_reason: subscription_cycle` | `renew_subscription` appelé |
| 6.2 | Nouveaux crédits | — | Nouveau `monthly_grant` dans `credit_transactions` |
| 6.3 | Historique | — | Événement `renewed` |
| 6.4 | E-mail | — | `subscription_renewed` |
| 6.5 | Idempotence | Rejouer même `eventId` | `stripe_events.status: already_processed`, pas de double grant |

**Test automatisé :** `test_invoice_paid_renews_credits_once`

---

## 7. Paiement refusé

| # | Scénario | Étapes | Résultat attendu |
|---|----------|--------|------------------|
| 7.1 | Carte refusée renouvellement | Simuler `invoice.payment_failed` (CLI ou Dashboard) | Statut `past_due` |
| 7.2 | Historique | — | Événement `past_due` |
| 7.3 | E-mail | — | `subscription_payment_failed` |
| 7.4 | Accès crédits | — | `past_due` reste dans `CREDIT_ELIGIBLE_STATUSES` (crédits encore utilisables en V1) |

**Test automatisé :** `test_invoice_payment_failed_marks_past_due`

---

## 8. Expiration abonnement

| # | Scénario | Étapes | Résultat attendu |
|---|----------|--------|------------------|
| 8.1 | Fin d'essai sans paiement | Trial se termine (Stripe `trialing` → `canceled` ou sync lifecycle) | Statut `expired` |
| 8.2 | `sync_lifecycle` | Appel `GET /api/subscriptions/me` après date trial | Transition lazy `trial` → `expired` |
| 8.3 | Stripe `incomplete_expired` | Webhook subscription | Mapping → `expired` via `STRIPE_TO_SUBSCRIPTION_STATUS` |
| 8.4 | Crédits plan | — | `planId` retiré du compte crédits |

**Test dev :** `POST /api/subscriptions/dev/expire` (local uniquement)

---

## 9. Webhooks

| # | Scénario | Étapes | Résultat attendu |
|---|----------|--------|------------------|
| 9.1 | Signature invalide | POST sans signature ou mauvaise | HTTP 400 |
| 9.2 | Événement inconnu | `customer.created` | `status: ignored` |
| 9.3 | Idempotence globale | Même `eventId` 2× | 2e réponse `already_processed` |
| 9.4 | Metadata mismatch | `userId` metadata ≠ customer | HTTP 500, `stripe_events.status: failed` |
| 9.5 | Tous types gérés | Déclencher chaque type de `HANDLED_STRIPE_EVENT_TYPES` | Tous `processed` |

**Types gérés :**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

---

## 10. Idempotence (critique avant Live)

| # | Point de contrôle | Comment vérifier |
|---|-------------------|------------------|
| 10.1 | Webhook | `stripe_events.eventId` unique |
| 10.2 | Renouvellement | Re-send `invoice.paid` → pas de 2e `monthly_grant` |
| 10.3 | Checkout abonnement | Re-send `checkout.session.completed` → pas de double activation |
| 10.4 | Pack crédits | Re-send checkout pack → pas de double `permanent_grant` |
| 10.5 | Historique subscription | `subscription_history.idempotencyKey` déduplique |
| 10.6 | E-mails Stripe | `email_events.idempotencyKey` = `stripe-email:{eventId}:{template}` |

---

## 11. Historique & synchronisation Stripe ↔ Mongo

| # | Vérification | Source de vérité |
|---|--------------|------------------|
| 11.1 | Statut abonnement | Webhook Stripe → `apply_stripe_status` |
| 11.2 | Plan actif | `stripePriceId` → `price_id_to_plan_id` |
| 11.3 | Périodes | `currentPeriodStart/End` via `sync_periods_from_stripe` |
| 11.4 | Customer ID | `users.stripeCustomerId` créé au 1er checkout |
| 11.5 | Dernier événement | `user_subscriptions.lastStripeEventId` |
| 11.6 | Historique lisible | `GET /api/subscriptions/history` reflète tous les changements |
| 11.7 | Billing overview | `GET /api/billing/me` cohérent avec Mongo |

---

## 12. Customer Portal

| # | Scénario | Résultat attendu |
|---|----------|------------------|
| 12.1 | Sans abonnement | HTTP 400 |
| 12.2 | Avec abonnement | URL portail Stripe valide |
| 12.3 | Mise à jour CB | Visible dans Stripe Dashboard |
| 12.4 | Téléchargement facture | PDF disponible côté Stripe |

**Test automatisé :** `test_portal_requires_customer`

---

## 13. Sécurité & configuration

| # | Vérification | Méthode |
|---|--------------|---------|
| 13.1 | Aucune clé dans le frontend | Inspecter bundle JS |
| 13.2 | Aucune clé dans Git | `rg 'sk_live_|sk_test_|whsec_'` (CI le fait) |
| 13.3 | Rate limits | Spam checkout → HTTP 429 |
| 13.4 | `env_validation` prod | `sk_live_` requis, `DEV_CREDIT_PURCHASES_ENABLED` interdit |
| 13.5 | `env_validation` staging | `sk_test_` requis, `STRIPE_BACKEND` ≠ fake |
| 13.6 | HTTPS URLs prod | `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` en https |

---

## 14. E-mails transactionnels (smoke)

Pour chaque scénario déclencheur, vérifier une entrée dans `email_events` :

- [ ] Trial démarré
- [ ] Abonnement activé
- [ ] Renouvellement
- [ ] Paiement échoué
- [ ] Annulation programmée
- [ ] Abonnement annulé

Les échecs e-mail ne doivent **pas** faire échouer le webhook (non bloquant).

---

## 15. Matrice de couverture code ↔ scénario

| Scénario | Fichier principal | Test auto |
|----------|-------------------|-----------|
| Checkout abonnement | `stripe_service.create_subscription_checkout` | `test_checkout_creates_session` |
| Webhook checkout | `stripe_webhook_service.handle_checkout_completed` | `test_webhook_checkout_completed_activates_subscription` |
| Pack crédits | `stripe_webhook_service.handle_credit_pack_checkout_completed` | `test_credit_checkout_webhook_grants_credits` |
| Upgrade | `stripe_service.change_stripe_subscription_plan` | `test_change_plan_upgrade` |
| Downgrade | `schedule_downgrade_at_period_end` | Manuel |
| Renouvellement | `handle_invoice_paid` | `test_invoice_paid_renews_credits_once` |
| Paiement refusé | `handle_invoice_payment_failed` | `test_invoice_payment_failed_marks_past_due` |
| Annulation | `handle_subscription_event` (deleted) | `test_subscription_deleted_cancels` |
| Idempotence | `stripe_event_service.claim_event` | `test_webhook_idempotent_replay` |

---

## Critère de passage Live

**Go Live** uniquement si :

- [ ] Sections 1 à 14 cochées en staging (mode Test)
- [ ] Zéro `stripe_events.status: failed` non résolu sur 48 h
- [ ] `STRIPE_LIVE_CHECKLIST.md` préparé (produits Live créés, secrets prêts)
- [ ] Fenêtre de bascule et rollback définis

**No-Go** si :

- Double crédit détecté sur replay webhook
- Checkout active l'abonnement sans webhook
- Price ID mismatch (mauvais plan après paiement)
- Packs crédits sans `stripeConfigured: true` en prod

---

## Commandes utiles

```bash
# Écouter webhooks en local
stripe listen --forward-to localhost:8000/api/stripe/webhook

# Déclencher événements test
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted

# Rejouer un événement
stripe events resend evt_...

# Tests backend
cd backend && CREDITS_ENFORCED=0 pytest tests/test_stripe_integration.py tests/test_credit_purchases.py -v
```
