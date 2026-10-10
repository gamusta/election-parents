# Plan — prépa test archi PayFit (5 jours × 8 h, 10 demi-journées variées)

Objectif : savoir **concevoir, justifier et diagnostiquer** une architecture DDD + event-driven sur AWS, en anglais, au tableau.
Calendrier : J1 = sam. 10/10 → J5 = mer. 14/10 ; test PayFit jeu. 15/10. Outil de dessin : Excalidraw (mocks, tests cumulatifs, répétition).

Cycle infra : déployer → observer → modifier → casser → diagnostiquer → corriger.
Critère de réussite : « je sais expliquer la panne » **et** « je sais justifier le choix en 2 minutes, en anglais ».

## Demi-journée type (4 h) : 4 pistes en rotation, jamais plus d'1 h 20 sur le même sujet
| Créneau | Matin | Après-midi |
|---|---|---|
| 0:00–0:40 | 🎙 Mock archi en anglais | 🧠 Domaine (DDD/TDD/BDD/CQRS) |
| 0:40–1:40 | 🧠 Domaine (DDD/TDD/BDD/CQRS) | ☁️ Infra (cdktn + AWS, casser/diagnostiquer) |
| 1:40–3:00 | ☁️ Infra (cdktn + AWS, casser/diagnostiquer) | ⚛️ React / TanStack |
| 3:00–3:40 | ⚛️ React / TanStack | 🎙 Test cumulatif (en anglais) |
| 3:40–4:00 | ⚡ Atelier réflexes (5 gestes pratiqués) + notes | ⚡ Atelier réflexes (5 gestes) + clôture |

Après-midi : le domaine dure 40 min (suite directe du matin), l'infra 1 h 20. Si une piste déborde, on coupe et on reprend à la demi-journée suivante : la rotation prime.

## Grille des 10 demi-journées
| | 🧠 Domaine | ☁️ Infra | ⚛️ React | ⚡ Réflexes | 🎙 Mock / test |
|---|---|---|---|---|---|
| **J1 M** | Context Map → ADR-0008 | Stack `data` : DynamoDB single-table | 🏗 **Init `apps/web` from scratch** (moi) | Terminal (Ghostty, zsh) | Mock : payroll run ✅ |
| **J1 A** | Example mapping `Election` + `.feature` ; kernel | Lambda `get-election` + IAM `LeadingKeys` + Logs Insights | 🏗 Router file-based + shadcn + garde-fous (CI, env) | 🏗 Config projet from scratch | Test : DDD, BDD |
| **J2 M** | Agrégat `Election` en TDD | Lambda `cast-vote` + route + IAM + EMF | Query : liste, `queryKey` | Cursor | Mock : double paiement |
| **J2 A** | Repository + fake, verrou optimiste ; CQRS lecture | Pannes DynamoDB + dashboard CloudWatch | Form + Zod | Git | Test : + idempotence, TDD |
| **J3 M** | `cast-vote.feature` outside-in → `CastVote` ; ADR-0009 | SQS + DLQ + event source mapping | Mutation + clé d'idempotence | AWS CLI | Mock : 50k virements |
| **J3 A** | `SeatAllocator` en kata TDD ; ADR-0007 | Alarmes → SNS ; SES simulateur ; redrive | Zustand | Debug Node/TS | Test : + SQS, DLQ, SNS |
| **J4 M** | 🏗 Contexte `packages/school` from scratch ; agrégat `Invitation` + inbox ; ADR-0010 | SES → SNS → SQS (fan-out, filter policy) | Polling, hooks custom, error boundaries | pnpm / mise, HTTP, `jq` | Mock : webhooks Stripe |
| **J4 A** | Outbox (ADR-0011) + projection `ElectionResults` (ADR-0013) | Streams → Pipes → EventBridge → projection | Optimistic update, prefetch | Cursor avancé / IA | Test : + outbox, CQRS |
| **J5 M** | `CloseElection` ; ADR-0012 orchestration vs chorégraphie | Scheduler → Step Functions | Testing Library + MSW | Whiteboarding | Mock : saga de clôture de paie |
| **J5 A** | ADR-0014 Lambda vs ECS | 🏗 Worker ECS from scratch (Dockerfile ARM64) → S3 (1 h 20) | Revue best practices (30 min) | Top 10 de la semaine | **Répétition générale 2 h** |

---

## 🧠 Piste Domaine — détail
Pratiques : example mapping + `.feature` avant chaque agrégat (BDD, exécuté par Vitest via `@amiceli/vitest-cucumber`) ; red → green → refactor (TDD) ; fakes plutôt que mocks pour les ports ; lecture séparée de l'écriture (CQRS ≠ event sourcing).
- **J1 M** : Context Map School Management / Voting / Reporting (relations, langage publié, ACL) → ADR-0008 ; ADR-0005 marqué « remplacé ».
- **J1 A** : example mapping de `Election` → `election.feature` (ouverture, listes figées, clôture) ; `kernel` : `DomainEvent`, `AggregateRoot` (`pullEvents()`).
- **J2 M** : agrégat `Election` en TDD, `draft → open → closed`, événements `ElectionOpened` / `ElectionClosed`. Autonomie : un invariant ajouté sans IA, scénario d'abord.
- **J2 A** : port `ElectionRepository` + fake en mémoire + adapter DynamoDB (verrou optimiste `version`) ; `get-election` devient un query service sans agrégat.
- **J3 M** : outside-in : `cast-vote.feature` rouge → `CastVote` → vert ; adapter `TransactWriteItems` + `ClientRequestToken` ; contrainte en base vs check applicatif → ADR-0009.
- **J3 A** : `SeatAllocator` en kata (plus fort reste, égalités, triangulation) ; ADR-0007 finalisé.
- **J4 M** : 🏗 création du contexte `packages/school` from scratch (structure domain/application/infrastructure, tsconfig, lint de frontières, tests) ; `invitation.feature` → agrégat `Invitation` (`PENDING → SENT → DELIVERED | BOUNCED`, transitions monotones) ; inbox de dédoublonnage ; ADR-0010 (Standard vs FIFO).
- **J4 A** : publication des domain events, ADR-0011 (outbox vs direct) ; projection `ElectionResults` + query `get-results`, ADR-0013 (read model, cohérence à terme).
- **J5 M** : application service `CloseElection` ; ADR-0012 (orchestration vs chorégraphie).
- **J5 A** : ADR-0014 (Lambda vs ECS pour un consumer).

## ☁️ Piste Infra — détail (je code, l'IA relit ; chaque panne → `diagnostic.md`)
- **J1 M** : stack `data` : table single-table, access patterns → clés avant le code, GSI.
- **J1 A** : Lambda `get-election` réelle, rôle IAM ciblé (`dynamodb:LeadingKeys`), première requête Logs Insights. Panne : lecture GSI juste après écriture.
- **J2 M** : Lambda `cast-vote`, route, policy sans wildcard, logs JSON + métrique EMF `VoteCast` / `VoteRejected`.
- **J2 A** : pannes : deux sauvegardes concurrentes (`ConditionalCheckFailedException`), double vote concurrent (`TransactionCanceledException`, `CancellationReasons`), même token avec paramètres différents ; dashboard CloudWatch.
- **J3 M** : file + DLQ (`maxReceiveCount`), event source mapping (batch, fenêtre, `ReportBatchItemFailures`, `maximumConcurrency`), visibility timeout vs timeout Lambda. Pannes : message poison → DLQ ; visibility trop courte → double traitement ; lot sans `ReportBatchItemFailures`.
- **J3 A** : alarmes (DLQ > 0, `ApproximateAgeOfOldestMessage`) → topic **SNS** → email ; consumer `invitation-sender` → SES simulateur. Pannes : consumer non idempotent → double email ; redrive depuis la DLQ.
- **J4 M** : configuration set SES → **SNS** → SQS, fan-out vers une file d'audit avec filter policy ; comparer avec SES → EventBridge. Pannes : événement dupliqué, désordre.
- **J4 A** : DynamoDB Streams → EventBridge Pipes (filtre) → bus → règle → Lambda projection ; `correlationId` de bout en bout. Pannes : filtre trop large (un `BALLOT#` sur le bus), enregistrement poison qui bloque le shard, projection en retard. Bonus : archive + replay.
- **J5 M** : EventBridge Scheduler → Step Functions Standard (nom d'exécution = `electionId`), Retry/Catch, redrive, `ElectionClosed` en intégration directe. Pannes : double déclenchement, échec transitoire puis permanent, état non idempotent rejoué.
- **J5 A** : 🏗 worker from scratch (Dockerfile multi-stage, utilisateur non root, `.dockerignore`) ; règle EventBridge → SQS → **service ECS Fargate** ARM64 (image ECR via `docker buildx --platform linux/arm64`, VPC par défaut, IP publique) : long polling, `SIGTERM`, idempotence → PV dans **S3** (SSE, versioning, presigned GET) ; autoscaling sur le backlog, min 0. Pannes : sans IP publique, rôle d'exécution vs rôle de tâche, `exec format error`.
- Fin : `destroy` app après le test ; supprimer les images ECR.

## ⚛️ Piste React — détail (`apps/web` : init faite par moi, ensuite l'IA génère le squelette et je pratique)
- **J1 M** : 🏗 init from scratch (voir checklist) : Vite + React + TS strict, Biome, Vitest, alias, structure par feature, variables d'env validées par Zod, `pnpm dev/build/test` verts.
- **J1 A** : 🏗 TanStack Router (file-based, routes typées) + shadcn ; job CI web (lint, typecheck, test, build) ; premier écran.
- **J2 M** : TanStack Query : `useQuery`, fabrique de `queryKey`, `staleTime` vs `gcTime`.
- **J2 A** : TanStack Form + Zod (schéma partagé `packages/contracts`).
- **J3 M** : `useMutation` vote, clé d'idempotence stable côté client, 409 → message métier.
- **J3 A** : Zustand : store d'import CSV, sélecteurs, éviter les re-renders.
- **J4 M** : polling des statuts (`refetchInterval`), hooks custom, pièges de `useEffect`, error boundaries.
- **J4 A** : optimistic update + invalidation ; loader de route + `ensureQueryData`.
- **J5 M** : tests : Testing Library + MSW.
- **J5 A** : revue des best practices (mémoïsation, découpage, état serveur vs état client).

## 🏗 Fil rouge « from scratch » (PayFit attend quelqu'un d'autonome sur un projet vierge)
Pratiqué 3 fois, en autonomie (l'IA relit après) : **`apps/web`** (J1), **`packages/school`** (J4 M), **worker ECS** (J5 A). Chaque fois, je chronomètre et je complète `docs/from-scratch.md` (checklist personnelle, réutilisable en mission).

Checklist « jour 0 » à savoir dérouler et justifier :
1. **Décider avant de coder** : objectif, contraintes, un ADR-0001 (stack), README de 10 lignes (lancer, tester, déployer).
2. **Outillage reproductible** : versions épinglées (`mise.toml`, `packageManager`), lockfile commité, `.editorconfig`, `.gitignore` dès le 1er commit.
3. **Qualité dès le 1er fichier** : TS `strict` (+ `noUncheckedIndexedAccess`), Biome, Vitest, scripts uniformes (`dev`, `build`, `test`, `lint`, `typecheck`), hook pre-commit léger.
4. **Walking skeleton** : le chemin le plus fin de bout en bout (UI → API → base → déployé) **avant** les fonctionnalités ; CI verte dès le jour 1.
5. **Frontières** : structure par feature / bounded context, règle de dépendance outillée (lint d'imports), alias.
6. **Configuration** : variables d'env validées au démarrage (Zod), `.env.example`, aucun secret commité.
7. **Opérabilité dès le début** : logs JSON, `correlationId`, health check, gestion d'erreur centrale.
8. **Conventions** : Conventional Commits, petits commits, PR courtes, ADR au fil de l'eau.
9. **Dette assumée** : ce qu'on ne fait pas tout de suite est écrit (README « Not yet »), pas oublié.

Question récurrente des tests cumulatifs : *« You start a new payment service from scratch on Monday. What do you set up in the first two days, and what do you deliberately postpone? »*

## ⚡ Piste Réflexes — 5 gestes pratiqués par demi-journée → `docs/reflexes.md`
Seulement ce que les meilleurs ingénieurs font et que les devs moyens ignorent ; chaque geste est essayé, pas seulement lu.
J1 M terminal (Ghostty, zsh, fzf, zoxide, ripgrep) · J1 A 🏗 config projet from scratch (scaffolding, templates, scripts, hooks) · J2 M Cursor · J2 A Git (worktrees, fixup/autosquash, bisect) · J3 M AWS CLI (`--query`, `logs tail`, profils) · J3 A debug Node/TS · J4 M pnpm/mise, HTTP + `jq` · J4 A Cursor avancé / IA · J5 M whiteboarding · J5 A top 10.

## 🎙 Mocks et tests cumulatifs
- **Mock (matin, 40 min)** : un cas PayFit, relances, challenge ; corrections d'anglais et note à la fin → `docs/mock.md`.
- **Test cumulatif (après-midi, 40 min)** sur **tout ce qui a été vu depuis J1** : design au tableau (20 min), 5 questions rapides (10 min), 1 debug à voix haute (10 min) ; note sur 4 axes (modélisation, garanties de livraison, opérabilité, communication) + 3 points → `docs/mock.md`.
- **J5 A** : répétition générale 2 h (*payment webhook processing*, 2 tours + débrief), en remplacement du test.

## Couverture AWS
| Service | Demi-journées |
|---|---|
| DynamoDB | J1 M → J2 A, J4 A (Streams) |
| Lambda + IAM | J1 A → J4 A |
| CloudWatch | J1 A (Logs Insights), J2 M (EMF), J2 A (dashboard), J3 A (alarmes), J5 A (`awslogs`) |
| SQS | J3 M, J3 A, J4 M, J5 A |
| SNS | J3 A (alarmes), J4 M (fan-out) |
| SES | J3 A, J4 M |
| EventBridge (Pipes, bus, Scheduler) | J4 A, J5 M, J5 A |
| Step Functions | J5 M |
| ECR + ECS Fargate, S3 | J5 A |

## Fils rouges
- `docs/diagnostic.md` : une fiche par panne (je vois → qui dit non → je regarde → je répare).
- `docs/adr/` : un ADR par décision, à savoir défendre à l'oral.
- `docs/mock.md` : cas joués, relances ratées, corrections d'anglais.
- Observabilité d'abord ; règle des 15 min sur le boilerplate généré.

## Hors périmètre (bonus éventuels)
VPC sur mesure/NAT/endpoints, CloudFront, CI apply (le CI reste en `diff`), Cognito + authorizer + magic link KMS (identité électeur stubbée), envelope encryption du bulletin.
