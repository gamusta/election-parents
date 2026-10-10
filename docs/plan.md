# Plan — prépa test archi PayFit (7 jours × 8 h)

Objectif : savoir **concevoir, justifier et diagnostiquer** une architecture DDD + event-driven sur AWS, en anglais, au tableau.
Test PayFit : fin de semaine prochaine, design au tableau + un peu de live coding. Sujets annoncés : **from scratch, SQS, event-driven, webhooks / double paiement**. ECS gardé (autres entretiens tech).
Calendrier : J1 = sam. 10/10 → J5 = mer. 14/10 (10 demi-journées en rotation) ; J6 = jeu. 15/10 (tampon + webhooks) ; J7 = ven. 16/10 (simulations whiteboard). Outil de dessin : Excalidraw.

Cycle infra : déployer → observer → modifier → casser → diagnostiquer → corriger.
Critère de réussite : « je sais expliquer la panne » **et** « je sais justifier le choix en 2 minutes, en anglais ».

## Demi-journée type J1–J5 (4 h) : 4 pistes en rotation, jamais plus d'1 h 20 sur le même sujet
| Créneau | Matin | Après-midi |
|---|---|---|
| 0:00–0:40 | 🎙 Mock archi en anglais | 🧠 Domaine (DDD/TDD/BDD/CQRS) |
| 0:40–1:40 | 🧠 Domaine (DDD/TDD/BDD/CQRS) | ☁️ Infra (cdktn + AWS, casser/diagnostiquer) |
| 1:40–3:00 | ☁️ Infra (cdktn + AWS, casser/diagnostiquer) | ⚛️ React / TanStack |
| 3:00–3:40 | ⚛️ React / TanStack | 🎙 Test cumulatif (en anglais) |
| 3:40–4:00 | ⚡ Atelier réflexes (5 gestes pratiqués) + notes | ⚡ Atelier réflexes (5 gestes) + clôture |

Après-midi : le domaine dure 40 min (suite directe du matin), l'infra 1 h 20. Si une piste déborde, on coupe et on reprend à la demi-journée suivante (ou en J6 A) : la rotation prime.

**Exception J5 A** (cycles de déploiement Fargate lents), 240 min :
| Créneau | Contenu |
|---|---|
| 0:00–0:30 | 🧠 ADR-0014 Lambda vs ECS pour consommer une file SQS |
| 0:30–2:10 | ☁️ ECS : build `linux/amd64`, push ECR, service SQS (export), 3 pannes (1 h 40) |
| 2:10–2:30 | ☁️ Marge déploiement (stabilisation du service, re-push) |
| 2:30–3:00 | ⚛️ Revue best practices React |
| 3:00–3:40 | 🎙 Test cumulatif |
| 3:40–4:00 | ⚡ Top 10 de la semaine |

## Grille J1–J5
| | 🧠 Domaine | ☁️ Infra | ⚛️ React | ⚡ Réflexes | 🎙 Mock / test |
|---|---|---|---|---|---|
| **J1 M** | Context Map → ADR-0008 | Stack `data` : DynamoDB single-table | ⏭ reporté en J1 A (retard) | Terminal (Ghostty, zsh) | Mock : payroll run ✅ |
| **J1 A** | `election.feature` (acceptation) ; kernel `DomainEvent` + `AggregateRoot` | Lambda `get-election` + IAM `LeadingKeys` + **CORS** + Logs Insights | 🏗 **Init `apps/web` from scratch** (1 h 20, moi) | Remplir `from-scratch.md` | Test : DDD, BDD |
| **J2 M** | Agrégat `Election` en TDD | Lambda `cast-vote` + route + IAM + EMF | Router file-based + shadcn + job CI web | Cursor | Mock : double paiement |
| **J2 A** | Repository + fake, verrou optimiste ; CQRS lecture | Pannes DynamoDB + dashboard CloudWatch | Query (`queryKey`) + Form + Zod | Git | Test : + idempotence, TDD |
| **J3 M** | `cast-vote.feature` outside-in → `CastVote` ; ADR-0009 | SQS + DLQ + event source mapping | Mutation + clé d'idempotence | AWS CLI | Mock : 50k virements |
| **J3 A** | `SeatAllocator` en kata TDD ; ADR-0007 | Alarmes → SNS ; SES simulateur ; redrive | Zustand | Debug Node/TS | Test : + SQS, DLQ, SNS |
| **J4 M** | 🏗 `packages/school` from scratch (20 min chrono) ; agrégat `Invitation` | Handler School de bout en bout ; SES → SNS → SQS → Lambda + inbox ; ADR-0010 | Polling, hooks custom, error boundaries | pnpm / mise, HTTP, `jq` | Mock : webhooks Stripe |
| **J4 A** | Outbox (ADR-0011) + projection `ElectionResults` (ADR-0013) | Streams → Pipes → EventBridge → projection | Optimistic update, prefetch | Cursor avancé / IA | Test : + outbox, CQRS |
| **J5 M** | `CloseElection` ; ADR-0012 orchestration vs chorégraphie | Scheduler → Step Functions | Testing Library + MSW | 🏗 Code worker + Dockerfile (remplace whiteboarding) | Mock : saga de clôture de paie |
| **J5 A** | ADR-0014 Lambda vs ECS (30 min) | 🏗 Worker ECS : ECR + service + 3 pannes (1 h 40 + 20 min marge) | Revue best practices (30 min) | Top 10 de la semaine | Test : + ECS |

## Grille J6–J7
| | Matin (4 h) | Après-midi (4 h) |
|---|---|---|
| **J6** | 🔗 Bloc webhooks entrants | Tampon : débordements J1–J5, bonus ECS, 🏗 init service backend au chrono |
| **J7** | 🎙 Simulation a) *payment service* (45 min) + débrief ; ⌨️ live coding (45 min) | 🎙 Simulation b) *webhooks / intégration externe* (45 min) + débrief |

---

## 🧠 Piste Domaine — détail
Pratiques : example mapping + `.feature` avant chaque agrégat (BDD, exécuté par Vitest via `@amiceli/vitest-cucumber`) ; red → green → refactor (TDD) ; fakes plutôt que mocks pour les ports ; lecture séparée de l'écriture (CQRS ≠ event sourcing).
- **J1 M** : Context Map School Management / Voting / Reporting (relations, langage publié, ACL) → ADR-0008 ; ADR-0005 marqué « remplacé ». ADR-0008 tranche aussi **l'événement d'intégration School → Voting** (électeur invité) : nom, version, contenu (identifiants seulement), qui le consomme.
- **J1 A** : `Election` déjà commencé en code → `election.feature` (ouverture, listes figées, clôture) écrit ensuite comme **test d'acceptation** ; `kernel` : `DomainEvent`, `AggregateRoot` (`pullEvents()`).
- **J2 M** : agrégat `Election` en TDD, `draft → open → closed`, événements `ElectionOpened` / `ElectionClosed`. Autonomie : un invariant ajouté sans IA, scénario d'abord.
- **J2 A** : port `ElectionRepository` + fake en mémoire + adapter DynamoDB (verrou optimiste `version`) ; `get-election` devient un query service sans agrégat.
- **J3 M** : outside-in : `cast-vote.feature` rouge → `CastVote` → vert ; adapter `TransactWriteItems` + `ClientRequestToken` ; contrainte en base vs check applicatif → ADR-0009.
- **J3 A** : `SeatAllocator` en kata (plus fort reste, égalités, triangulation) ; ADR-0007 finalisé.
- **J4 M** : 🏗 `packages/school` from scratch, **20 min chrono** (structure domain/application/infrastructure, tsconfig, lint de frontières, tests) ; `invitation.feature` → agrégat `Invitation` (`PENDING → SENT → DELIVERED | BOUNCED`, transitions monotones).
- **J4 A** : publication des domain events, ADR-0011 (outbox vs direct) ; projection `ElectionResults` + query `get-results`, ADR-0013 (read model, cohérence à terme).
- **J5 M** : application service `CloseElection` ; ADR-0012 (orchestration vs chorégraphie).
- **J5 A** : ADR-0014 Lambda vs ECS pour consommer une file SQS : durée max, cold start, coût au repos, autoscaling, concurrence, idempotence.

## ☁️ Piste Infra — détail (je code, l'IA relit ; chaque panne → `diagnostic.md`)
- **J1 M** : stack `data` : table single-table, access patterns → clés avant le code, GSI.
- **J1 A** : Lambda `get-election` réelle, rôle IAM ciblé (`dynamodb:LeadingKeys`), **CORS sur API Gateway** (origine du front local), première requête Logs Insights. Panne : lecture GSI juste après écriture ; préflight `OPTIONS` refusé.
- **J2 M** : Lambda `cast-vote`, route, policy sans wildcard, logs JSON + métrique EMF `VoteCast` / `VoteRejected`.
- **J2 A** : pannes : deux sauvegardes concurrentes (`ConditionalCheckFailedException`), double vote concurrent (`TransactionCanceledException`, `CancellationReasons`), même token avec paramètres différents ; dashboard CloudWatch.
- **J3 M** : file + DLQ (`maxReceiveCount`), event source mapping (batch, fenêtre, `ReportBatchItemFailures`, `maximumConcurrency`), visibility timeout vs timeout Lambda. Pannes : message poison → DLQ ; visibility trop courte → double traitement ; lot sans `ReportBatchItemFailures`.
- **J3 A** : alarmes (DLQ > 0, `ApproximateAgeOfOldestMessage`) → topic **SNS** → email ; consumer `invitation-sender` → SES simulateur. Pannes : consumer non idempotent → double email ; redrive depuis la DLQ.
- **J4 M** :
  - 🏗 **walking skeleton backend** : handler Lambda School minimal (`create-invitation`) de bout en bout (route → Lambda → DynamoDB), idempotence par **put conditionnel** (`attribute_not_exists` sur la clé d'idempotence).
  - **Inbox** : configuration set SES → **SNS** → SQS → Lambda `invitation-status` ; DLQ, retries (`maxReceiveCount`), visibility timeout ≥ 6 × timeout Lambda, consumer idempotent (inbox = put conditionnel sur l'ID de message). ADR-0010 (Standard + inbox vs FIFO). Filter policy / file d'audit : bonus J6.
  - Pannes : événement dupliqué, désordre.
- **J4 A** : DynamoDB Streams → EventBridge Pipes (filtre) → bus → règle → Lambda projection ; `correlationId` de bout en bout. Pannes : filtre trop large (un `BALLOT#` sur le bus), enregistrement poison qui bloque le shard, projection en retard. Bonus : archive + replay.
- **J5 M** : EventBridge Scheduler → Step Functions Standard (nom d'exécution = `electionId`), Retry/Catch, redrive, `ElectionClosed` en intégration directe. Pannes : double déclenchement, échec transitoire puis permanent, état non idempotent rejoué. Réflexes : 🏗 code du worker (long polling, `SIGTERM`, idempotence) + Dockerfile multi-stage, utilisateur non root, `.dockerignore`.
- **J5 A** : 🏗 `docker buildx --platform linux/amd64` (Mac Intel, Fargate x86_64), push **ECR**, **service ECS Fargate** (VPC par défaut, IP publique) consommant une file SQS (export). 3 pannes provoquées : sans IP publique (pull ECR impossible), rôle d'exécution vs rôle de tâche, `exec format error` (image arm64 sur tâche x86_64).
- **J6 A (bonus)** : autoscaling min 0 sur la profondeur de file ; export dans **S3** (SSE, versioning, presigned GET).
- Fin : `destroy` app après le test ; supprimer les images ECR.

## ⚛️ Piste React — détail (`apps/web` : init faite par moi, ensuite l'IA génère les écrans et je pratique)
Front **local uniquement**, qui appelle l'API déployée (pas de CloudFront).
- **J1 A** : 🏗 init from scratch, 1 h 20 (voir checklist) : Vite + React + TS strict, Biome, Vitest, alias, structure par feature, variables d'env validées par Zod, `pnpm dev/build/test` verts.
- **J2 M** : TanStack Router (file-based, routes typées) + shadcn ; job CI web (lint, typecheck, test, build) ; premier écran.
- **J2 A** : TanStack Query (`useQuery`, fabrique de `queryKey`, `staleTime` vs `gcTime`) ; TanStack Form + Zod (schéma partagé `packages/contracts`).
- **J3 M** : `useMutation` vote, clé d'idempotence stable côté client, 409 → message métier.
- **J3 A** : Zustand : store d'import CSV, sélecteurs, éviter les re-renders.
- **J4 M** : polling des statuts (`refetchInterval`), hooks custom, pièges de `useEffect`, error boundaries.
- **J4 A** : optimistic update + invalidation ; loader de route + `ensureQueryData`.
- **J5 M** : tests : Testing Library + MSW.
- **J5 A** : revue des best practices (mémoïsation, découpage, état serveur vs état client).

## 🔗 J6 M — Bloc webhooks entrants (sujet annoncé)
Fournisseur de paiement simulé (script qui signe et envoie, rejoue, envoie dans le désordre).
- **Design (40 min, en anglais)** : flux au tableau, ADR-0015 (accusé de réception rapide + traitement asynchrone).
- **Réception** : `POST /webhooks/<provider>` → vérification de signature HMAC sur le **corps brut**, comparaison à temps constant, tolérance d'horodatage (anti-rejeu) → `200` rapide → message SQS (identifiants seulement).
- **Traitement** : consumer SQS idempotent (put conditionnel sur l'ID d'événement du fournisseur) ; DLQ, `ReportBatchItemFailures`.
- **Double paiement** : idempotence métier (clé = référence de paiement, pas l'ID de livraison), transitions monotones, événements dans le désordre.
- Pannes : signature invalide, rejeu d'un ancien événement, même paiement via deux événements différents, traitement lent → timeout du fournisseur et renvoi.

## J6 A — Tampon
1. Ce qui a débordé de J1–J5 (priorité aux sujets annoncés : SQS, event-driven).
2. Bonus ECS : autoscaling min 0, S3 + presigned URL ; filter policy SNS.
3. 🏗 **Refaire l'init d'un service backend au chrono** (package + handler + walking skeleton + CI), comparer avec J4 M dans `from-scratch.md`.

## 🎙 J7 — Simulations whiteboard
2 simulations, l'IA joue l'intervieweur : énoncé imposé, 45 min chrono, relances sur les compromis, sans aide.
- **a) Payment service** (from scratch : jour 0, contextes, idempotence, SQS, opérabilité).
- **b) Système de webhooks / intégration externe** (signature, ack rapide, async, double paiement, DLQ, replay).
- **Live coding (45 min chrono, à voix haute, en anglais)** : énoncé imposé par l'IA, sans aide, ex. consumer SQS idempotent (lot, `ReportBatchItemFailures`) ou vérification de signature de webhook, tests d'abord.

Débrief écrit dans `from-scratch.md` ; le reste de la journée : retravailler les points faibles relevés, relire `diagnostic.md` et les ADR.

## 🏗 Fil rouge « from scratch » (PayFit attend quelqu'un d'autonome sur un projet vierge)
Pratiqué 4 fois, en autonomie (l'IA relit après) : **`apps/web`** (J1 A), **`packages/school` + handler** (J4 M), **worker ECS** (J5), **service backend au chrono** (J6 A). Chaque fois, je chronomètre et je complète `docs/from-scratch.md` (checklist personnelle, réutilisable en mission).

Checklist « jour 0 » à savoir dérouler et justifier :
1. **Décider avant de coder** : objectif, contraintes, un ADR-0001 (stack), README de 10 lignes (lancer, tester, déployer).
2. **Outillage reproductible** : versions épinglées (`mise.toml`, `packageManager`), lockfile commité, `.editorconfig`, `.gitignore` dès le 1er commit.
3. **Qualité dès le 1er fichier** : TS `strict` (+ `noUncheckedIndexedAccess`), Biome, Vitest, scripts uniformes (`dev`, `build`, `test`, `lint`, `typecheck`), hook pre-commit léger.
4. **Walking skeleton** : le chemin le plus fin de bout en bout (UI → API → base → déployé) **avant** les fonctionnalités ; CI verte dès le jour 1.
5. **Infra dès le jour 1** : 1 environnement déployé par IaC (ressources préfixées par `stage`) ; alerte budget.
6. **Frontières** : structure par feature / bounded context, règle de dépendance outillée (lint d'imports), alias.
7. **Configuration** : variables d'env validées au démarrage (Zod), `.env.example`, aucun secret commité.
8. **Opérabilité dès le début** : logs JSON, `correlationId`, health check, gestion d'erreur centrale.
9. **Conventions** : Conventional Commits, petits commits, PR courtes, ADR au fil de l'eau.
10. **Dette assumée** : ce qu'on ne fait pas tout de suite est écrit (README « Not yet »), pas oublié.

Question récurrente des tests cumulatifs : *« You start a new payment service from scratch on Monday. What do you set up in the first two days, and what do you deliberately postpone? »*

## ⚡ Piste Réflexes — 5 gestes pratiqués par demi-journée → `docs/reflexes.md`
Seulement ce que les meilleurs ingénieurs font et que les devs moyens ignorent ; chaque geste est essayé, pas seulement lu.
J1 M terminal (Ghostty, zsh, fzf, zoxide, ripgrep) · J1 A remplir `from-scratch.md` · J2 M Cursor · J2 A Git (worktrees, fixup/autosquash, bisect) · J3 M AWS CLI (`--query`, `logs tail`, profils) · J3 A debug Node/TS · J4 M pnpm/mise, HTTP + `jq` · J4 A Cursor avancé / IA · J5 M 🏗 code worker + Dockerfile · J5 A top 10.

## 🎙 Mocks et tests cumulatifs
- **Mock (matin, 40 min)** : un cas PayFit, relances, challenge ; corrections d'anglais et note à la fin → `docs/mock.md`.
- **Test cumulatif (après-midi, 40 min)** sur **tout ce qui a été vu depuis J1** : design au tableau (20 min), 5 questions rapides (10 min), 1 debug à voix haute (10 min) ; note sur 4 axes (modélisation, garanties de livraison, opérabilité, communication) + 3 points → `docs/mock.md`.
- **J7** : 2 simulations de 45 min (voir ci-dessus), en remplacement de la répétition générale.

## Couverture AWS
| Service | Demi-journées |
|---|---|
| DynamoDB | J1 M → J2 A, J4 M (put conditionnel), J4 A (Streams), J6 M |
| Lambda + IAM | J1 A → J4 A, J6 M |
| API Gateway (CORS) | J1 A, J6 M (webhook) |
| CloudWatch | J1 A (Logs Insights), J2 M (EMF), J2 A (dashboard), J3 A (alarmes), J5 A (`awslogs`) |
| SQS | J3 M, J3 A, J4 M (inbox), J5 A (ECS), J6 M (webhooks) |
| SNS | J3 A (alarmes), J4 M (SES → SNS → SQS) |
| SES | J3 A, J4 M |
| EventBridge (Pipes, bus, Scheduler) | J4 A, J5 M |
| Step Functions | J5 M |
| ECR + ECS Fargate | J5 A, J6 A (autoscaling) |
| S3 | J6 A (bonus) |

## Fils rouges
- `docs/diagnostic.md` : une fiche par panne (je vois → qui dit non → je regarde → je répare).
- `docs/adr/` : un ADR par décision, à savoir défendre à l'oral.
- `docs/mock.md` : cas joués, relances ratées, corrections d'anglais.
- `docs/from-scratch.md` : chronos, corrections de la relecture IA, débriefs J7.
- Observabilité d'abord ; règle des 15 min sur le boilerplate généré.

## Hors périmètre (bonus éventuels)
VPC sur mesure/NAT/endpoints, CloudFront (front local uniquement), CI apply (le CI reste en `diff`), Cognito + authorizer + magic link KMS (identité électeur stubbée), envelope encryption du bulletin.
