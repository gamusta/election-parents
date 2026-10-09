# Plan — prépa test archi PayFit (5 jours × 8 h)

Objectif : savoir **concevoir, justifier et diagnostiquer** une architecture DDD + event-driven sur AWS, en anglais, au tableau.
Hypothèse de calendrier : J1 = lundi 12/10, J5 = vendredi 16/10. Si le test tombe avant, J5 remonte à la veille du test.

Cycle de chaque bloc : déployer → observer → modifier → casser → diagnostiquer → corriger.
Critère de réussite : « je sais expliquer la panne » **et** « je sais justifier le choix en 2 minutes, en anglais ».

## Journée type (8 h)
| Créneau | Contenu |
|---|---|
| 0:00–0:45 | Mock archi en anglais (Claude = architecte PayFit) : un cas, relances, challenge ; corrections d'anglais à la fin |
| 0:45–5:15 | Socle du jour (je code le nouveau, l'IA génère le boilerplate) |
| 5:15–6:15 | Piste React (TanStack Router/Query/Form, Zustand, hooks) sur `apps/web` |
| 6:15–7:30 | Bonus ou rattrapage |
| 7:30–8:00 | `diagnostic.md`, ADR du jour, résumé de clôture |
| Au fil de l'eau | 10 réflexes d'expert → `docs/reflexes.md` |

## Fils rouges
- `docs/diagnostic.md` : une fiche par panne (je vois → qui dit non → je regarde → je répare).
- `docs/adr/` : un ADR par décision, à savoir défendre à l'oral.
- `docs/mock.md` : cas joués, relances ratées, corrections d'anglais.
- Observabilité d'abord ; règle des 15 min sur le boilerplate généré.

## Hors périmètre (bonus éventuels)
VPC/NAT/endpoints, CloudFront, CI apply (le CI reste en `diff`), Cognito + authorizer + magic link KMS (identité électeur stubbée).

---

## J1 — DDD : Context Map, agrégat `Election`, stack data
Critère : je sais dire où passe la frontière d'un agrégat et pourquoi tel invariant y vit.
- Socle :
  - Context Map School Management / Voting / Reporting (relations, langage publié, ACL) → ADR-0008.
  - `kernel` : `DomainEvent`, `AggregateRoot` (événements collectés, `pullEvents()`).
  - Agrégat `Election` en TDD : `draft → open → closed`, listes figées à l'ouverture, événements `ElectionOpened` / `ElectionClosed`.
  - Port `ElectionRepository` + adapter DynamoDB, verrou optimiste (`version`).
  - Stack `data` (cdktn) : table single-table, access patterns → clés avant le code.
- Pannes : deux sauvegardes concurrentes de l'agrégat (`ConditionalCheckFailedException`) ; lecture GSI juste après écriture.
- Mock : *Payroll payment run — identify bounded contexts and aggregates.*
- React : Vite + shadcn + TanStack Router (file-based), liste d'élections via Query.
- Autonomie : ajouter un invariant à `Election` sans IA.
- Réflexes : terminal et shell.

## J2 — Vote synchrone, idempotence garantie par la base, `SeatAllocator`
Critère : je sais prouver qu'un double clic, un retry réseau et deux onglets ne produisent qu'un vote.
- Socle :
  - Application service `CastVote` ; adapter `TransactWriteItems` (PARTICIPATION `attribute_not_exists` + BALLOT) + `ClientRequestToken`.
  - Idempotence : contrainte en base vs check applicatif (démontrer la race du read-then-write) ; pattern clé d'idempotence (à la Stripe `Idempotency-Key`).
  - `SeatAllocator` en TDD (plus fort reste, égalités).
  - Handler `cast-vote`, route, rôle IAM ciblé.
  - ADR-0007 (vote synchrone) et ADR-0009 (idempotence).
- Pannes : double vote concurrent (`TransactionCanceledException`, `CancellationReasons`) ; même token, paramètres différents ; check applicatif sous concurrence.
- Bonus : envelope encryption du bulletin (KMS) ; fuite du secret par horodatage ou ordre.
- Mock : *Prevent double payment of a salary when the bank API times out.*
- React : TanStack Form + Zod, mutation Query avec clé d'idempotence générée côté client.
- Autonomie : écrire la policy IAM de `cast-vote` sans wildcard.
- Réflexes : Cursor.

## J3 — SQS : invitations asynchrones (School Management)
Critère : devant un message traité deux fois ou bloqué, je sais dire si c'est la file, le consumer ou la config.
- Socle :
  - ADR-0010 (SQS Standard vs FIFO).
  - Agrégat `Invitation` (`PENDING → SENT → DELIVERED | BOUNCED`) ; `RequestInvitations` émet `InvitationsRequested`.
  - Infra : file + DLQ (`maxReceiveCount`), event source mapping (batch, fenêtre, `ReportBatchItemFailures`, `maximumConcurrency`), visibility timeout vs timeout Lambda, alarme sur la DLQ.
  - Consumer `invitation-sender` idempotent par `invitationId` (écriture conditionnelle), envoi SES vers le simulateur.
- Pannes : message poison → DLQ ; visibility timeout trop court → double traitement ; consumer non idempotent → double email ; lot sans `ReportBatchItemFailures` → lot entier rejoué ; redrive depuis la DLQ.
- Bonus : comparatif FIFO (`MessageGroupId` par école) ; backpressure face au débit SES.
- Mock : *Pay 50k employees through a bank API limited to 100 req/s.*
- React : import CSV (état local Zustand), suivi des statuts par polling Query.
- Autonomie : ajouter l'alarme DLQ et expliquer le plan.
- Réflexes : Git.

## J4 — Événements externes at-least-once + domain events (chorégraphie)
Critère : je sais rendre idempotent un consumer qui reçoit doublons et désordre, et publier un événement sans le perdre.
- Matin — retours SES (analogue webhooks Stripe) : configuration set → SNS → SQS → Lambda (comparer avec SES → EventBridge) ; inbox de dédoublonnage (event ID, `attribute_not_exists`, TTL) ; transitions monotones.
- Après-midi — publication des domain events : ADR-0011 (outbox vs direct) ; DynamoDB Streams → EventBridge Pipes (filtre) → bus → règle → consumer Reporting (projection).
- Pannes : événement SES dupliqué ; événements dans le désordre ; filtre Pipes trop large (un `BALLOT#` sur le bus) ; enregistrement de stream poison qui bloque le shard ; schéma d'événement modifié.
- Bonus : archive + replay EventBridge.
- Mock : *Ingest Stripe webhooks: at-least-once, out-of-order, respond fast.*
- React : Query avancé (invalidation, optimistic update, `staleTime`), hooks custom.
- Autonomie : ajouter une règle EventBridge et son consumer.
- Réflexes : observabilité en CLI.

## J5 — Orchestration + répétition générale
Critère : je sais justifier orchestration vs chorégraphie sur un cas donné et dire ce qui est rejoué après un échec.
- Matin (3 h 30) : EventBridge Scheduler → Step Functions Standard (nom d'exécution = `electionId`) : `CloseElection` → comptage → `SeatAllocator` → PV S3 → `ElectionClosed` (intégration directe). Retry/Catch, redrive. ADR-0012.
- Pannes : double déclenchement ; échec transitoire puis permanent ; état non idempotent rejoué au redrive.
- Après-midi : répétition générale 2 h en anglais (*payment webhook processing* au tableau, 2 tours + débrief) ; 30 min relecture ADR + diagnostic.
- Réflexes : top 10 de la semaine + raccourcis de l'outil de dessin.
- Fin : `destroy` app après le test (data gardée si utile).
