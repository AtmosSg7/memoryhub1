# Basera — Import Engine (Beta)

Pipeline d'import IA robuste pour artisans : dépôt PDF ou photos, prétraitement, analyse OpenAI, rattachement client et création devis/facture.

---

## Vue d'ensemble

```
ImportWizard (frontend)
    │  POST /api/imports/estimate
    │  POST /api/imports/analyze  (file | files[])
    ▼
import_service
    1. validate_upload_inputs (anti-abus)
    2. prepare_import_document (prétraitement)
    3. validate_prepared_limits
    4. estimate tier + require_credits_for_import
    5. OpenAI / Mock analyze (mono ou multi-pages)
    6. match_clients + persist session
    7. consume_for_import (1 analyse)
```

---

## Formats supportés

| Format | Usage |
|--------|--------|
| PDF | Document unique, multi-pages |
| JPG / JPEG | Photo ou scan |
| PNG | Photo ou scan |
| WEBP | Photo ou scan |
| Multi-images | Plusieurs photos = **un seul document**, une analyse, un fichier stocké |

**Règle** : ne pas mélanger PDF et images dans un même import.

---

## Configuration centralisée (`import_constants.py`)

Toutes les limites sont configurables par variables d'environnement — aucune valeur codée en dur dans les routes.

| Variable | Défaut | Description |
|----------|--------|-------------|
| `IMPORT_MAX_IMAGES` | 10 | Nombre max de photos par import |
| `IMPORT_MAX_PDF_PAGES` | 20 | Pages PDF max par import |
| `IMPORT_MAX_FILE_SIZE_BYTES` | 10 Mo | Taille max par fichier |
| `IMPORT_MAX_TOTAL_SIZE_BYTES` | 25 Mo | Taille totale max (fallback `MAX_UPLOAD_BYTES`) |
| `IMPORT_IMAGE_MAX_DIMENSION` | 2400 px | Redimensionnement max (qualité préservée) |
| `IMPORT_IMAGE_JPEG_QUALITY` | 85 | Compression JPEG raisonnable |
| `IMPORT_BLANK_PAGE_THRESHOLD` | 0.98 | Seuil page blanche ignorée |
| `IMPORT_BATCH_PAGE_LIMIT` | 5 | Pages envoyées en un seul appel OpenAI |

`0` sur une limite = non appliquée (sauf tailles où un défaut produit est utilisé).

---

## Messages utilisateur (anti-abus)

Quand une limite est dépassée, l'API renvoie **413** avec un message premium en français — jamais technique.

Exemples :
- Fichier trop grand → *« Votre document est trop volumineux. Découpez-le en plusieurs analyses. »*
- Trop de photos → *« Trop de photos pour une seule analyse… »*
- Trop de pages PDF → *« Ce PDF contient trop de pages… »*

---

## Prétraitement (`import_preprocessor.py`)

Avant l'appel OpenAI :

1. **Images** : rotation EXIF, redimensionnement, compression JPEG, suppression des images vides
2. **PDF** : extraction des pages, suppression des pages blanches, recomposition
3. **Multi-images** : fusion en un document unique (PDF multi-pages pour le stockage)

Métadonnées conservées : `sourceType`, `pageCount`, `imageCount`, `originalFileCount`.

---

## Classification (`import_classification.py`)

Types détectés (extensible via registre) :

| Clé | Libellé FR | Confirmable |
|-----|------------|-------------|
| `quote` | Devis | Oui |
| `invoice` | Facture | Oui |
| `supplier_invoice` | Facture fournisseur | Non |
| `delivery_note` | Bon de livraison | Non |
| `receipt` | Ticket | Non |
| `purchase_order` | Bon de commande | Non |
| `administrative_document` | Document administratif | Non |
| `contract` | Contrat | Non |
| `other` | Autre | Non |

Ajouter un type : étendre `DOCUMENT_TYPE_REGISTRY` + alias dans `normalize_detected_kind`.

---

## Résilience multi-pages

1. Tentative d'analyse groupée (≤ `IMPORT_BATCH_PAGE_LIMIT` pages)
2. Si échec : analyse page par page
3. Fusion des résultats (`import_analysis_merger.py`) — meilleure confiance par champ
4. Pages en échec signalées dans `warnings`, pas d'arrêt brutal si des pages ont réussi

---

## API

### `POST /api/imports/estimate`

```json
{
  "extension": "jpg",
  "sizeBytes": 120000,
  "files": [
    { "extension": "jpg", "sizeBytes": 60000 },
    { "extension": "jpg", "sizeBytes": 60000 }
  ]
}
```

### `POST /api/imports/analyze`

- Champ `file` : un fichier (rétrocompatible)
- Champ `files` : plusieurs fichiers (photos du même document)

---

## Tests

```bash
cd backend
pytest tests/test_import_engine.py tests/test_imports_api.py -q
```

Couverture : limites, prétraitement, fusion images, PDF multi-pages, classification, API.

---

## Dépendances

- `Pillow` — prétraitement images
- `pypdf` — manipulation PDF

---

## Fichiers clés

| Module | Rôle |
|--------|------|
| `import_constants.py` | Configuration centralisée |
| `import_limits.py` | Validation anti-abus |
| `import_preprocessor.py` | Prétraitement et fusion |
| `import_classification.py` | Registre des types |
| `import_analysis_merger.py` | Fusion multi-pages |
| `import_service.py` | Orchestration |
| `analysis/openai_analyzer.py` | Extraction IA multi-pages |
