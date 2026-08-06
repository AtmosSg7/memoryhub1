# Action Lifecycle — contrat produit

Référence courte de ce qui arrive aux actions Action Engine après les événements du parcours prospect ↔ client. Types concernés : `reply_to_prospect`, suggestions CI (ex. `prepare_quote`), `read_client_reply`.

## Après ingestion d’un prospect (e-mail inconnu inbound)

- Une action `reply_to_prospect` **est créée** (si Action Engine actif, message non bruit, prospect non ignoré).
- `clientId` est **absent**.
- Idempotence : même `communicationId` → **pas de doublon**.

## Après acceptation CI

- Une action issue de la suggestion CI **est créée** (ou réutilisée si déjà présente).
- `reply_to_prospect` pour la **même communication** est **supersédée / dismiss** (`superseded_by_ci_accept`).
- Résultat : **une seule** action pending active pour ce message.

## Après rejet CI

- Aucune action CI **n’est créée**.
- `reply_to_prospect` **reste** telle quelle.
- Aucune action supplémentaire.

## Après association (rattachement à un client existant)

- Communications liées : `clientId` renseigné.
- Actions ouvertes liées au prospect / communication : **`clientId` mis à jour** (réconciliation).
- Le prospect quitte « À traiter ».

## Après conversion prospect → client

- Même réconciliation que l’association : actions ouvertes **reçoivent le `clientId`** du nouveau client.
- Navigation produit vers la fiche client.
- Plus de `reply_to_prospect` « orpheline » sans client si la réconciliation s’applique.

## Après ignore

- Prospect retiré de « À traiter ».
- Actions pending liées (`reply_to_prospect`, etc.) **dismiss / plus actives**.
- Nouveaux messages du même expéditeur **ne recrée pas** d’action tant que le prospect reste ignoré (`prospectIgnored`).
- Conversion **bloquée** tant que le prospect est ignoré.

## Après restore

- Prospect revient dans « À traiter ».
- Les `reply_to_prospect` dismissées via ignore sont **réouvertes** (pending) ; à défaut, une réévaluation peut en créer une nouvelle.
- Ignore levé pour l’identité e-mail/téléphone.

## Après complete

- Action marquée **completed** ; disparaît des listes pending / badge.
- Ne recrée pas automatiquement une sœur pour la même clé d’idempotence.

## Après dismiss

- Action marquée **dismissed** ; disparaît des pending.
- Une nouvelle ingestion **distincte** peut créer une nouvelle action (nouvelle communication / nouvelle clé).

## Après snooze

- Action **reste** rattachée (`clientId` / `communicationId` inchangés).
- Hors liste « actives » jusqu’à la fin du snooze (selon `includeSnoozed`).
- Pas de supersession automatique.

## Tableau récapitulatif

| Événement | `reply_to_prospect` | Action CI | `clientId` |
|-----------|---------------------|-----------|------------|
| Ingest prospect | créée | — | null |
| CI accept | supersédée | créée (1) | inchangé |
| CI reject | inchangée | aucune | — |
| Associate / convert | mise à jour | mise à jour | → client |
| Ignore | dismiss | dismiss liée | — |
| Restore | peut revenir | — | null si non lié |
| Complete / dismiss | terminée | terminée | inchangé |
| Snooze | masquée temporairement | idem | inchangé |
