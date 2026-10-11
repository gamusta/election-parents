# ADR-0017 — Une Lambda HTTP par profil de droits IAM

- Statut : accepté
- Date : 2026-10-11
- Bloc : J1

## Contexte
Voting expose 7 à 8 routes HTTP, pour 3 profils de droits seulement : lecture (`GetItem`, `Query`), administration de l'élection (écriture de l'item Election), vote (transaction Voter + Ballot). Une Lambda par route multiplie rôles, log groups, cold starts et code infra (méthode, intégration, permission, trigger) sans gain de sécurité entre deux lectures. Hono route déjà dans chaque handler.

## Options
| Option | Pour | Contre |
|---|---|---|
| A. Une Lambda par route | IAM au plus juste, réglages par route | ~8 rôles et fonctions pour 3 profils ; infra verbeuse |
| B. Une Lambda par profil IAM : `voting-read`, `voting-admin`, `cast-vote` | Moindre privilège là où il compte ; moins d'infra ; pattern courant en entreprise | Une faille dans une lecture expose toutes les lectures |
| C. Une seule Lambda (Lambdalith) | Infra minimale | Un rôle avec tous les droits, y compris l'écriture des bulletins |

## Décision
Option B. Les routes de mêmes droits partagent une Lambda ; `cast-vote` reste seule à écrire un `BALLOT#`. Tout consumer, worker, webhook ou job planifié garde sa propre Lambda.

## Conséquences
- Facile : ajouter une route de lecture = une route Hono + un `LambdaRoute`, sans nouveau rôle.
- À surveiller : un profil qui grossit (une lecture qui demande un nouveau droit) → nouvelle Lambda plutôt qu'élargir le rôle ; concurrence réservée réglée par profil, pas par route.
- Remise en cause : une route au profil de charge très différent (ex. lecture lourde) → Lambda dédiée.
