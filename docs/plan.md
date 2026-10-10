# Plan — prépa test archi PayFit (5 jours × 8 h)

Objectif : savoir **concevoir, justifier et diagnostiquer** une architecture DDD + event-driven sur AWS, en anglais, au tableau.
Calendrier : J1 = sam. 10/10 → J5 = mer. 14/10 ; test PayFit jeu. 15/10. Outil de dessin : Excalidraw (mocks, tests cumulatifs, répétition).

Cycle de chaque bloc : déployer → observer → modifier → casser → diagnostiquer → corriger.
Critère de réussite : « je sais expliquer la panne » **et** « je sais justifier le choix en 2 minutes, en anglais ».

## Journée type (8 h)
| Créneau | Contenu |
|---|---|
| 0:00–0:45 | Mock archi en anglais (Claude = architecte PayFit) : un cas, relances, challenge ; corrections d'anglais à la fin |
| 0:45–5:30 | Socle du jour (je code le nouveau, l'IA génère le boilerplate) |
| 5:30–6:30 | Piste React (TanStack Router/Query/Form, Zustand, hooks) sur `apps/web` |
| 6:30–7:30 | **Test cumulatif du jour** (30-60 min) puis rattrapage |
| 7:30–8:00 | `diagnostic.md`, ADR du jour, résumé de clôture |
| Au fil de l'eau | 10 réflexes d'expert → `docs/reflexes.md` |

## Test cumulatif quotidien (30-60 min, en fin de journée)
Simulation du test PayFit sur **tout ce qui a été vu depuis J1**, pas seulement le jour même. Format, à la façon d'un entretien réel :
1. Design (20-30 min) : un cas nouveau, au tableau, en anglais ; je pose les contextes, les flux, les garanties.
2. Questions rapides (10 min) : 5 questions de fond tirées des jours précédents (ex. « pourquoi pas FIFO ? », « que se passe-t-il au redrive ? »).
3. Debug (10-15 min) : un symptôme (log, métrique, comportement) à diagnostiquer à voix haute.
4. Débrief (5 min) : note sur 4 axes (modélisation, garanties de livraison, opérabilité, communication), 3 points à retravailler, reportés dans `docs/mock.md`.

| Jour | Périmètre du test |
|---|---|
| J1 | DDD, agrégats, BDD |
| J2 | J1 + idempotence, transactions, TDD |
| J3 | J1-J2 + SQS, DLQ, SNS, alarmes |
| J4 | J1-J3 + at-least-once, outbox, EventBridge, CQRS |
| J5 | Tout, en condition réelle (remplacé par la répétition générale de 2 h) |

## Pratiques transverses
| Pratique | Où | Ce que je dois savoir défendre |
|---|---|---|
| **BDD** | Example mapping (règles → exemples → questions) avant chaque agrégat ; scénarios Gherkin `*.feature` pour les règles non négociables, exécutés par Vitest (`@amiceli/vitest-cucumber`) au niveau application service | BDD = langage partagé avec le métier, pas un outil de test ; scénario = critère d'acceptation |
| **TDD** | Domaine en red → green → refactor ; `SeatAllocator` en kata (triangulation) ; outside-in sur `CastVote` (scénario BDD rouge → tests unitaires → vert) | Inside-out vs outside-in ; fakes plutôt que mocks pour les ports ; pyramide de tests |
| **CQRS** | Écriture = agrégats + repository ; lecture = query services sans domaine (`get-election`) puis projection Reporting alimentée par événements (`get-results`) | CQRS ≠ event sourcing ; cohérence à terme côté lecture ; quand **ne pas** le faire |

## Couverture AWS
| Service | Jour | Usage |
|---|---|---|
| Lambda | J1–J5 | Handlers HTTP, consumers SQS/stream, étapes Step Functions |
| SQS | J3, J4 | File d'invitations + DLQ ; file des retours SES |
| SNS | J3, J4 | Topic d'alarmes → email ; SES → SNS → SQS (fan-out, filter policy) |
| CloudWatch | J2–J5 | Logs Insights, métriques EMF, alarmes (DLQ, âge du plus vieux message, erreurs), dashboard |
| S3 | J5 | PV de dépouillement (chiffré, versionné), presigned GET |
| ECR + ECS Fargate (ARM64) | J5 | Service worker Reporting qui consomme une file SQS (scale-to-zero sur le backlog), génère le PV ; comparaison Lambda vs ECS |
| DynamoDB, EventBridge (Pipes, Scheduler), Step Functions, SES, IAM | J1–J5 | Voir les jours |

## Fils rouges
- `docs/diagnostic.md` : une fiche par panne (je vois → qui dit non → je regarde → je répare).
- `docs/adr/` : un ADR par décision, à savoir défendre à l'oral.
- `docs/mock.md` : cas joués, relances ratées, corrections d'anglais.
- Observabilité d'abord ; règle des 15 min sur le boilerplate généré.

## Hors périmètre (bonus éventuels)
VPC sur mesure/NAT/endpoints (ECS tourne dans le VPC par défaut, IP publique, sans NAT), CloudFront, CI apply (le CI reste en `diff`), Cognito + authorizer + magic link KMS (identité électeur stubbée).

---

## J1 — DDD + BDD : Context Map, agrégat `Election`, stack data
Critère : je sais dire où passe la frontière d'un agrégat et pourquoi tel invariant y vit.
- Socle :
  - Context Map School Management / Voting / Reporting (relations, langage publié, ACL) → ADR-0008.
  - Example mapping de `Election` → `election.feature` (ouverture, listes figées, clôture).
  - `kernel` : `DomainEvent`, `AggregateRoot` (événements collectés, `pullEvents()`).
  - Agrégat `Election` en TDD : `draft → open → closed`, événements `ElectionOpened` / `ElectionClosed`.
  - Port `ElectionRepository` + fake en mémoire (tests) + adapter DynamoDB, verrou optimiste (`version`).
  - CQRS côté lecture : `get-election` devient un query service qui lit DynamoDB sans passer par l'agrégat.
  - Stack `data` (cdktn) : table single-table, access patterns → clés avant le code.
- Pannes : deux sauvegardes concurrentes de l'agrégat (`ConditionalCheckFailedException`) ; lecture GSI juste après écriture.
- Mock : *Payroll payment run — identify bounded contexts and aggregates.*
- React : Vite + shadcn + TanStack Router (file-based), liste d'élections via Query.
- Autonomie : ajouter un invariant à `Election` sans IA (scénario d'abord).
- Réflexes : terminal et shell.

## J2 — Vote synchrone, idempotence garantie par la base, TDD outside-in
Critère : je sais prouver qu'un double clic, un retry réseau et deux onglets ne produisent qu'un vote.
- Socle :
  - Outside-in : `cast-vote.feature` (un seul vote, vote hors période refusé, retry idempotent) rouge → application service `CastVote` → vert.
  - Adapter `TransactWriteItems` (PARTICIPATION `attribute_not_exists` + BALLOT) + `ClientRequestToken`.
  - Idempotence : contrainte en base vs check applicatif (démontrer la race du read-then-write) ; clé d'idempotence (à la Stripe `Idempotency-Key`).
  - `SeatAllocator` en kata TDD (plus fort reste, égalités, triangulation).
  - Handler `cast-vote`, route, rôle IAM ciblé ; logs JSON + métrique EMF `VoteCast` / `VoteRejected`.
  - ADR-0007 (vote synchrone) et ADR-0009 (idempotence).
- Pannes : double vote concurrent (`TransactionCanceledException`, `CancellationReasons`) ; même token, paramètres différents ; check applicatif sous concurrence (preuve par Logs Insights).
- Bonus : envelope encryption du bulletin (KMS) ; fuite du secret par horodatage ou ordre.
- Mock : *Prevent double payment of a salary when the bank API times out.*
- React : TanStack Form + Zod, mutation Query avec clé d'idempotence générée côté client.
- Autonomie : écrire la policy IAM de `cast-vote` sans wildcard.
- Réflexes : Cursor.

## J3 — SQS + SNS + CloudWatch : invitations asynchrones (School Management)
Critère : devant un message traité deux fois ou bloqué, je sais dire si c'est la file, le consumer ou la config.
- Socle :
  - ADR-0010 (SQS Standard vs FIFO).
  - `invitation.feature` puis agrégat `Invitation` (`PENDING → SENT → DELIVERED | BOUNCED`) ; `RequestInvitations` émet `InvitationsRequested`.
  - Infra : file + DLQ (`maxReceiveCount`), event source mapping (batch, fenêtre, `ReportBatchItemFailures`, `maximumConcurrency`), visibility timeout vs timeout Lambda.
  - Consumer `invitation-sender` idempotent par `invitationId` (écriture conditionnelle), envoi SES vers le simulateur.
  - CloudWatch : alarmes `ApproximateNumberOfMessagesVisible` (DLQ > 0) et `ApproximateAgeOfOldestMessage` → **topic SNS** → email ; dashboard file + consumer.
- Pannes : message poison → DLQ ; visibility timeout trop court → double traitement ; consumer non idempotent → double email ; lot sans `ReportBatchItemFailures` → lot entier rejoué ; redrive depuis la DLQ.
- Bonus : comparatif FIFO (`MessageGroupId` par école) ; backpressure face au débit SES.
- Mock : *Pay 50k employees through a bank API limited to 100 req/s.*
- React : import CSV (état local Zustand), suivi des statuts par polling Query.
- Autonomie : ajouter une alarme et expliquer le plan.
- Réflexes : Git.

## J4 — Événements externes at-least-once + domain events (chorégraphie) + CQRS lecture
Critère : je sais rendre idempotent un consumer qui reçoit doublons et désordre, et publier un événement sans le perdre.
- Matin — retours SES (analogue webhooks Stripe) :
  - Configuration set → **SNS** → SQS → Lambda ; SNS en fan-out vers une 2e file (audit) avec filter policy ; comparer avec SES → EventBridge.
  - Inbox de dédoublonnage (event ID, `attribute_not_exists`, TTL) ; transitions monotones (scénarios BDD : doublon, désordre).
- Après-midi — publication des domain events et projection :
  - ADR-0011 (outbox vs direct) ; DynamoDB Streams → EventBridge Pipes (filtre) → bus → règle → consumer Reporting.
  - CQRS : projection `ElectionResults` (read model dénormalisé) + query `get-results` ; ADR-0013 (read model et cohérence à terme).
  - Traçabilité : `correlationId` propagé de la requête HTTP aux consumers, requête Logs Insights de bout en bout.
- Pannes : événement SES dupliqué ; événements dans le désordre ; filtre Pipes trop large (un `BALLOT#` sur le bus) ; enregistrement de stream poison qui bloque le shard ; projection en retard (lecture juste après écriture).
- Bonus : archive + replay EventBridge pour reconstruire la projection.
- Mock : *Ingest Stripe webhooks: at-least-once, out-of-order, respond fast.*
- React : Query avancé (invalidation, optimistic update, `staleTime`), hooks custom.
- Autonomie : ajouter une règle EventBridge et son consumer.
- Réflexes : observabilité en CLI.

## J5 — Orchestration + chorégraphie sur ECS, S3 + répétition générale
Critère : je sais justifier orchestration vs chorégraphie et Lambda vs ECS sur un cas donné, et dire ce qui est rejoué après un échec.
- Matin (4 h) — les deux styles dans le même flux :
  - **Orchestration** (Voting, 2 h) : EventBridge Scheduler → Step Functions Standard (nom d'exécution = `electionId`) : `CloseElection` → comptage → `SeatAllocator` (Lambda) → résultats en base → `ElectionClosed` (intégration directe EventBridge). Retry/Catch, redrive.
  - **Chorégraphie** (Reporting, 2 h) : règle EventBridge → SQS → **service ECS Fargate** (ARM64, image ECR construite par `docker buildx --platform linux/arm64`) : long polling, extension de visibilité, arrêt propre sur `SIGTERM`, idempotence par `electionId` → PV dans **S3** (SSE, versioning, presigned GET). Autoscaling sur le backlog SQS, min 0 ; logs `awslogs` dans CloudWatch.
  - ADR-0012 (orchestration vs chorégraphie) et ADR-0014 (Lambda vs ECS Fargate pour un consumer).
- Pannes : double déclenchement ; échec transitoire puis permanent ; état non idempotent rejoué au redrive ; tâche ECS sans IP publique (pull ECR impossible) ; rôle d'exécution vs rôle de tâche ; image x86 sur tâche ARM64 (`exec format error`) ; tâche tuée pendant un traitement (message réapparu).
- Après-midi : répétition générale 2 h en anglais (*payment webhook processing* au tableau, 2 tours + débrief) ; 30 min relecture ADR + diagnostic.
- Réflexes : top 10 de la semaine + raccourcis de l'outil de dessin.
- Fin : `destroy` app après le test (data gardée si utile) ; supprimer les images ECR.
