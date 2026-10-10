# ADR-0016 — Modèle de données single-table Voting

- Statut : proposé
- Date : 2026-10-10
- Bloc : J1

## Contexte
Voting doit garantir en base « un seul vote » et « inscription idempotente » (ADR-0007, ADR-0008), et lister les élections d'une école. Le bulletin ne porte ni `voterId`, ni horodatage, ni ordre exploitable. Aucune PII. Volume : quelques centaines à 2 000 électeurs par élection. Détail : `docs/data-model.md`.

## Options
| Option | Pour | Contre |
|---|---|---|
| A. Une table `pk`/`sk`, collection par élection, 1 GSI sparse `SCHOOL#` | Une transaction couvre électeur + bulletin ; 1 seul rôle IAM ; 1 seul stream | Modèle à documenter, clés génériques moins lisibles |
| B. Une table par entité (election, voter, ballot) | Lisible, IAM fin par table | 3 tables à provisionner, 3 streams ; pas de lecture groupée |

## Décision
Option A : table `${stage}-election`, items `META`, `PARENT#`, `VOTER#`, `BALLOT#<uuid v4>` (partition `#BALLOTS` séparée), GSI `gsi1` pour les élections d'une école.

## Conséquences
- Facile : invariants par transaction et écritures conditionnelles ; comptage par `Query` + `COUNT`, sans compteur chaud.
- À surveiller : partition `#BALLOTS` au-delà d'environ 250 votes/s (sharding `#BALLOTS#<n>`) ; corrélation Voter/Ballot via les Streams, à auditer plus tard.
- Remise en cause : charge à l'échelle nationale, ou besoin d'IAM différent par entité.
