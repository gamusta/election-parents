# ADR-0008 — Context map : School Management, Voting, Reporting

- Statut : accepté
- Date : 2026-10-10
- Bloc : J1
- Remplace : ADR-0005

## Contexte
Trois contextes se partagent l'élection : l'école crée l'élection et invite les parents, Voting garantit le vote secret et unique, Reporting publie les résultats. Contraintes d'AGENTS.md : aucun lien électeur ↔ bulletin, `BallotCast` ne sort pas de Voting, aucune PII ni token dans un message, livraison at-least-once et dans le désordre. Le code met déjà l'agrégat `Election` dans `packages/voting`.

## Contextes

| | School Management | Voting | Reporting |
|---|---|---|---|
| Responsabilité | Gère l'annuaire (parents, classes) et invite les parents éligibles | Garantit que chaque électeur inscrit vote une fois, en secret, pendant la période ; dépouille à la clôture (plus fort reste) | Met à disposition résultats et participation après dépouillement ; procès-verbal, archivage |
| Langage | Parent (nom, email, enfants), Classe, Invitation | Électeur (id opaque, aucune PII), Liste de candidats, Bulletin | Résultat (sièges par liste), Taux de participation, Procès-verbal |
| Agrégats | `Invitation` (`PENDING → SENT → DELIVERED \| BOUNCED`, monotone) | `Election` (`draft → open → closed`), `Voter` (`REGISTERED → VOTED`) | Aucun : projection en lecture seule |
| Publie | `ParentInvited` v1 | `ElectionTallied` v1 | — |
| Consomme | — | `ParentInvited` v1 | `ElectionTallied` v1 |

Interne à Voting, ne sort jamais : `BallotCast`, `ElectionOpened`, `ElectionClosed` (aucun consommateur nommé, YAGNI).

Unicité garantie par la base, pas par un agrégat :
- School : « email unique par école » est une règle entre agrégats → item `EMAIL#` écrit sous condition.
- Voting : un seul item `Voter` par électeur ; voter = mise à jour conditionnelle `REGISTERED → VOTED` + `BALLOT#uuid` dans la même transaction. Ce `Voter` est le registre d'émargement.

## Relations

| Flux | Upstream | Downstream | Pourquoi |
|---|---|---|---|
| Cycle de vie de l'élection (créer, gérer les listes, ouvrir) | Voting [OHS] : API synchrone | School : ne garde que l'`electionId`, opaque | Voting protège les invariants vérifiés au moment du vote ; l'école demande, Voting accepte ou refuse. Commande synchrone, pas un événement |
| Annuaire → électeurs | School [OHS/PL] : `ParentInvited` v1 | Voting [ACL] : parent → électeur | Voting protège le vote secret : il ne dépend ni du vocabulaire ni des PII de School |
| Résultats | Voting [OHS/PL] : `ElectionTallied` v1 | Reporting [Conformist] | Vue en lecture seule, aucun modèle à protéger : traduire n'apporterait rien |

Le sens dépend du flux : Voting est amont pour le cycle de vie de l'élection, School est amont pour l'annuaire. Pas de dépendance circulaire.

Systèmes externes (pas des contextes) :
- SES : derrière un port `Notifier` de School, avec un ACL : les notifications de livraison SES sont traduites en `DELIVERED` / `BOUNCED`, le vocabulaire SES n'entre pas dans le domaine.
- Annuaire d'école (futur) : ACL côté School, modèle non maîtrisé.

## Contrat `ParentInvited` v1

```
type        : ParentInvited
version     : 1
payload     : { eventId, type, version, occurredAt, schoolId, electionId, parentId }
producteur  : School Management
consommateur: Voting
```

- Aucun nom, email, token ni hash de token.
- Le `voterId` est attribué par l'ACL de Voting : opaque, stable par `(electionId, parentId)`. Mapping écrit sous condition (`attribute_not_exists`), indexé par `(electionId, parentId)`.
  - Une ré-invitation (parent `BOUNCED`, nouvelle `Invitation`) retrouve le même électeur → pas de double vote. D'où : jamais `voterId = invitationId`.
  - Jamais `voterId = parentId` brut : corrélation de l'électeur entre deux élections.
  - Ce mapping est légitime : le secret repose sur l'isolement du bulletin, pas sur l'anonymat de l'émargement.
- Doublon (at-least-once) : put conditionnel, ignoré silencieusement.
- Élection `closed` : l'ACL refuse l'inscription. Voting est l'autorité.
- Version inconnue : ignorée.

## Options pour `ElectionTallied`
| Option | Pour | Contre |
|---|---|---|
| A. `{ electionId }` seul, Reporting lit une API de Voting | Aucune donnée de vote dans un message | Couplage synchrone Reporting → Voting |
| B. Totaux agrégés : sièges et voix par liste, votants, inscrits | Reporting autonome ; chiffres publics après clôture | Exception à « aucune donnée de vote dans un message » |

## Décision
Context map ci-dessus. `ElectionTallied` suit l'option B : publié une seule fois, après dépouillement, avec des totaux agrégés uniquement, jamais d'événement par électeur ou par bulletin.

## Conséquences
- Pas de résultat partiel avant la clôture : voix par liste + horodatage d'un vote révèleraient un bulletin. Un taux de participation en direct ne révèle aucun contenu de bulletin ; s'en priver est un choix de prudence, pas une obligation. *No partial results before closing; turnout alone doesn't leak ballot content.*
- Reporting est un contexte séparé, et non le côté lecture de Voting, parce que son cycle de vie diffère : procès-verbal, archivage, consultation après la fin de l'élection.
- Le modèle `Voter` (`REGISTERED → VOTED`) remplace `PARTICIPATION#voter` (`attribute_not_exists`) d'AGENTS.md et d'ADR-0007 : à mettre à jour. ADR-0007 cite `ElectionClosed` pour Reporting : désormais `ElectionTallied`.
- Question ouverte : qui vérifie le magic link au moment du vote ? School (consomme le token puis donne accès à Voting) ou Voting (devrait connaître le hash, interdit dans un message).
- Remise en cause : un second consommateur de `ElectionOpened` / `ElectionClosed` (ex. School grise le bouton d'invitation) → les publier en v1.
