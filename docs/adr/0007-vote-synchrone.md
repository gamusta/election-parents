# ADR-0007 — Vote synchrone, sans file de messages

- Statut : proposé
- Date : 2026-10-09
- Bloc : J2

## Contexte
Deux règles non négociables : vote secret (aucun lien électeur ↔ bulletin) et un seul vote par électeur. Elles tiennent aujourd'hui dans une seule transaction DynamoDB (`PARTICIPATION#voter` + `BALLOT#uuid`). Charge : quelques centaines d'électeurs par école, pas de pic justifiant un tampon. L'électeur attend une confirmation immédiate.

## Options
| Option | Pour | Contre |
|---|---|---|
| A. Synchrone : `TransactWriteItems` dans la Lambda HTTP | Atomicité ; réponse définitive ; le lien électeur ↔ choix n'existe qu'en mémoire, le temps de la requête | Pic absorbé directement par Lambda et DynamoDB |
| B. Un message SQS `{voterId, choix}`, écriture par un consumer | Lissage de charge, retries gratuits | Le lien électeur ↔ choix est persisté dans SQS, la DLQ, les logs et le redrive ; réponse « accepté », pas « voté » |
| C. Deux messages séparés (participation, bulletin) | Pas de lien dans un même message | Atomicité perdue : bulletin sans participation ou l'inverse ; corrélables par l'horodatage d'envoi |

## Décision
Option A.

## Conséquences
- Facile : l'invariant « un seul vote » est garanti par la base (condition + transaction), le retry client est sûr (`ClientRequestToken`).
- Aucun événement inter-contextes n'est publié au moment du vote : `BallotCast` reste interne à Voting. Reporting n'apprend les résultats que par `ElectionClosed`.
- À surveiller : throttling (stage API Gateway ≤ concurrence Lambda), `TransactionCanceledException` à traduire en 409.
- Remise en cause : charge sans commune mesure (élection nationale) ou dépendance externe lente dans le chemin du vote.
