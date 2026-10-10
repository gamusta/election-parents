# Modèle de données — Voting (DynamoDB single-table)

Table `${stage}-election`, contexte Voting uniquement. Voir ADR-0007 (vote synchrone), ADR-0008 (context map).

## 1. Access patterns

Volume de référence : une école ≈ 200 à 2 000 électeurs, quelques élections par an.

| # | Pattern | Handler | L/E | Volume | Cohérence requise | GSI (à terme) toléré ? |
|---|---|---|---|---|---|---|
| AP1 | Créer une élection | `create-election` | E | ~1 / école / an | Forte : put conditionnel (`attribute_not_exists`) | — |
| AP2 | Lire une élection avec ses listes | `get-election` (affichage), `cast-vote`, `tally` | L | 1 par affichage + 1 par vote | Affichage : à terme OK. Vote : forte (statut `open` vérifié **dans** la transaction, `ConditionCheck`) | ✅ affichage seulement |
| AP3 | Changer de statut `draft → open → closed`, verrou optimiste `version` | `open-election`, `close-election` | E | 2 / élection | Forte : condition `version = :expected` | — |
| AP4 | Élections d'une école, triées par date d'ouverture | `list-school-elections` | L | Faible (back-office) | Une élection créée à l'instant peut manquer 1 s | ✅ |
| AP5 | Inscrire un électeur (put conditionnel, idempotent) | `register-voter` (ACL, consomme `ParentInvited` v1) | E | N par élection, en rafale à l'envoi des invitations | Forte : doublon at-least-once → condition échoue → ignoré | — |
| AP6 | Retrouver le `voterId` depuis `(electionId, parentId)` | `register-voter` (ACL) ; vérif. magic link (question ouverte ADR-0008) | L | 1 par invitation / ré-invitation | Forte : deux `ParentInvited` concurrents ne doivent pas créer deux électeurs → unicité portée par une **clé de table**, pas par un GSI | ❌ |
| AP7 | Passer l'électeur `REGISTERED → VOTED` | `cast-vote` | E | 1 / électeur, pics à l'ouverture et avant la clôture | Forte : condition `status = REGISTERED` dans `TransactWriteItems` | — |
| AP8 | Écrire `BALLOT#uuid` dans la même transaction | `cast-vote` | E | 1 / votant | Forte : atomique avec AP7 | — |
| AP9 | Lire tous les bulletins d'une élection | `tally` (clôture, J5) | L | 1 fois, N bulletins | Forte : `Query` `ConsistentRead` sur la table, après `closed` (un GSI pourrait omettre les derniers bulletins) | ❌ |
| AP10 | Compter inscrits et votants | `get-turnout` (affichage), `tally` (procès-verbal) | L | Affichage : fréquent si participation en direct | Affichage : à terme OK. Procès-verbal : exact, lu après `closed` | ✅ affichage seulement |

À noter :
- AP4 exige `schoolId` et la date d'ouverture sur l'élection : l'agrégat `Election` n'a pas encore `schoolId` (à ajouter côté domaine).
- Les écritures « commande » (AP1, AP3, AP5, AP7, AP8) sont toutes conditionnelles : l'invariant est garanti par la base, jamais par un check applicatif.

## 2. Clés, items, GSI

Clés génériques `pk` / `sk` (string). Un seul GSI : `gsi1` (`gsi1pk` / `gsi1sk`), sparse.

| Item | `pk` | `sk` | Attributs | Patterns |
|---|---|---|---|---|
| Election | `ELECTION#<electionId>` | `META` | `schoolId`, `opensAt`, `closesAt`, `seats`, `status`, `version`, `lists` (embarquées), `gsi1pk`, `gsi1sk`, `expiresAt` | AP1–AP4 |
| ParentLink (mapping ACL) | `ELECTION#<electionId>` | `PARENT#<parentId>` | `voterId` | AP5, AP6 |
| Voter (émargement) | `ELECTION#<electionId>` | `VOTER#<voterId>` | `status` (`REGISTERED` \| `VOTED`), `expiresAt` | AP5, AP7, AP10 |
| Ballot | `ELECTION#<electionId>#BALLOTS` | `BALLOT#<uuid v4>` | `listId`, `expiresAt` | AP8, AP9, AP10 |

GSI `gsi1` (AP4) : `gsi1pk = SCHOOL#<schoolId>`, `gsi1sk = <opensAt ISO 8601>#<electionId>`, projection `ALL`. Seuls les items Election portent ces attributs : index sparse, donc peu coûteux.

Exemples :

```json
{ "pk": "ELECTION#7c1e…", "sk": "META", "schoolId": "3f9a…", "opensAt": "2026-11-02T08:00:00Z", "closesAt": "2026-11-02T18:00:00Z",
  "seats": 5, "status": "draft", "version": 3, "lists": [{ "id": "a1…", "name": "Liste A" }],
  "gsi1pk": "SCHOOL#3f9a…", "gsi1sk": "2026-11-02T08:00:00Z#7c1e…", "expiresAt": 1825228800 }
{ "pk": "ELECTION#7c1e…", "sk": "PARENT#p-42…", "voterId": "v-9d0b…" }
{ "pk": "ELECTION#7c1e…", "sk": "VOTER#v-9d0b…", "status": "REGISTERED", "expiresAt": 1825228800 }
{ "pk": "ELECTION#7c1e…#BALLOTS", "sk": "BALLOT#e3b4c2f0-…", "listId": "a1…", "expiresAt": 1825228800 }
```

Écritures :
- **Inscription (AP5)** : `TransactWriteItems` = `ParentLink` + `Voter`, tous deux `attribute_not_exists(pk)`, + `ConditionCheck` Election `status <> closed`. Doublon → `ConditionalCheckFailed` sur `ParentLink` → lire le `voterId` existant, ignorer.
- **Vote (AP7 + AP8)** : `TransactWriteItems` = `ConditionCheck` Election `status = open` + `Update` Voter `status = REGISTERED → VOTED` + `Put` Ballot `attribute_not_exists(pk)`, `ClientRequestToken` pour l'idempotence.
- **Statut (AP3)** : `Update` Election, condition `version = :expected`, `SET version = version + 1`.

### Vote secret
- Ballot : ni `voterId`, ni horodatage, ni compteur. Sort key = UUID v4 (aléatoire) : l'ordre d'une `Query` ne reflète pas l'ordre des votes (un ULID ou un UUID v7 le révélerait).
- `expiresAt` est dérivé de `closesAt` (identique pour tous les items d'une élection), jamais de `now()` : un TTL calculé au moment du vote serait un horodatage.
- Voter : pas de `votedAt` (inutile, et corrélable).
- Aucune PII : `schoolId`, `parentId`, `voterId` sont des identifiants opaques. Pas de nom, d'email ni de hash de token.
- Ballots dans une partition distincte de celle des électeurs : le dépouillement ne lit que des bulletins.

### Hors périmètre
Corrélation possible via les Streams (`MODIFY` Voter + `INSERT` Ballot dans la même transaction) : à traiter lors d'un audit sécurité ultérieur.

### Partition chaude au dépouillement
Limites par partition : 1 000 WCU/s et 3 000 RCU/s. Un vote (transaction de 3 items, ~1 Ko) coûte environ 2 WCU par item écrit, en mode transactionnel.
- **2 000 bulletins** : même si 2 000 votes tombent en 10 min, on reste sous 4 votes/s. Le dépouillement fait une `Query` d'environ 200 Ko, soit une page. Aucun risque.
- **2 millions** : au pic (×10 la moyenne sur 8 h, environ 700 votes/s), la partition `#BALLOTS` dépasse 1 000 WCU/s → throttling. Le dépouillement fait environ 200 pages lues l'une après l'autre. Le *split for heat* (possible car il n'y a pas de LSI) arrive trop tard pour un pic soudain.
- **Position** : pas de sharding (YAGNI à l'échelle d'une école). Chemin de migration : `pk = ELECTION#<id>#BALLOTS#<n>` avec `n = hash(uuid) mod N`, où `N` est figé sur l'item Election à la création. Le dépouillement lance alors N `Query` en parallèle.

### Compteurs (AP10)
| | `Query` + `Select: COUNT` | Compteur `ADD` dans la transaction de vote |
|---|---|---|
| Coût en lecture | Lit toute la collection : 2 000 × ~100 o ≈ 50 RCU | 1 `GetItem` |
| Écriture | Rien de plus | Tous les votes écrivent le **même item** : clé chaude, et surtout `TransactionConflict` entre votes concurrents → annulations et retries |
| Exactitude | Exacte (`ConsistentRead`) | Exacte |

Recommandation : **`Query` + `COUNT`**. Inscrits = `begins_with(sk, VOTER#)`, votants = nombre de bulletins (égal par transaction), avec `ConsistentRead` pour le procès-verbal. À 2 millions d'électeurs : compteur agrégé de façon asynchrone, hors du chemin du vote.

### Pitch (oral)
1. *"Every write that protects an invariant is a conditional write or a transaction, so uniqueness and the single vote are enforced by DynamoDB, not by application checks."*
2. *"Ballots carry no voter id, no timestamp and a random v4 key, so nothing in the ballot item links it to a voter."*
3. *"At school scale one partition per election is two orders of magnitude below DynamoDB limits, so I count with a query instead of a hot counter, and I know the sharding path if we ever hit national scale."*
