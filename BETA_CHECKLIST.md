# MemoryHub — Checklist bêta artisan

Parcours manuel complet (sans OpenAI). Cocher chaque étape après test UX.

**Prérequis Mac :** MongoDB, backend, frontend, compte seed :

```bash
cd backend && python3 scripts/seed_dev_user.py && python3 scripts/seed_dev_demo.py
```

## Scénario E2E

| # | Étape | Route / action | OK |
|---|--------|----------------|----|
| 1 | Connexion | `/login` → `atmossg7@gmail.com` / `devpassword123` | ☐ |
| 2 | Créer un client (avec email) | Dashboard → « Ajouter un client » | ☐ |
| 3 | Activer le portail client | `/dashboard/clients/:id` → « Activer le portail » → copier le lien | ☐ |
| 4 | Créer un devis (brouillon) | Client ou `/dashboard/quotes` → « Créer un devis » | ☐ |
| 5 | Envoi préparé | Devis → « Envoyer au client » → copier le message | ☐ |
| 6 | Vérifier statut **Envoyé** | Le devis passe en `sent` après copie du message | ☐ |
| 7 | Portail client | Onglet privé → `/portal/:token` → devis visible | ☐ |
| 8 | Acceptation devis | Portail → « Accepter le devis » → confirmer | ☐ |
| 9 | Créer la facture | App → devis accepté → « Créer la facture » | ☐ |
| 10 | Envoi facture préparé | Facture → « Envoyer au client » → copier | ☐ |
| 11 | Paiement partiel | Facture → « Encaisser » → montant partiel → valider | ☐ |
| 12 | Relance | Facture impayée → « Relancer » → copier le message | ☐ |
| 13 | Communications | `/dashboard/communications` → envoi, acceptation, paiement, relance visibles | ☐ |
| 14 | Timeline client | `/dashboard/clients/:id?section=timeline` → événements complets | ☐ |

## Points d'attention bêta

- Aucun e-mail n'est envoyé depuis MemoryHub — copier/coller dans votre messagerie.
- Le portail doit être activé **avant** l'envoi pour inclure le lien dans le message.
- L'import intelligent (OpenAI) est hors scope de cette checklist.

## Vérifications techniques

```bash
cd frontend && npm run build
cd backend && python3 -m py_compile server.py document_send_service.py
cd backend && source .venv/bin/activate && python -m uvicorn server:app --port 8000
```
