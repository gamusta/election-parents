# Async AWS — fiche chiffres et arbitrages

Objectif : pour chaque choix, **2 alternatives + 1 limite chiffrée**, en 2 minutes, en anglais.
Chiffres vérifiés en nov. 2026 (sources en bas). ⚠️ = a changé récemment : beaucoup de supports disent encore 256 KB.

## 1. Les chiffres à savoir par cœur

| Service | Durée max | Payload max | Livraison | Coût (ordre de grandeur) |
|---|---|---|---|---|
| **Lambda** | **15 min** | sync 6 MB · async **1 MB** ⚠️ (oct. 2025) | async : 2 retries, âge max 6 h | à la ms × mémoire (128 MB → 10 GB) |
| **SQS Standard** | rétention 1 min → **14 j** (défaut 4 j) | **1 MiB** ⚠️ (août 2025) | at-least-once, **sans ordre** | ~0,40 $/M requêtes, facturé par tranche de 64 KB |
| **SQS FIFO** | idem | 1 MiB | exactly-once *processing* (dédup 5 min), ordre par `MessageGroupId` | 300 msg/s par API (3 000 en batch ; mode haut débit au-delà) |
| **SNS** | — (push) | 256 KB | at-least-once, fan-out | ~0,50 $/M publications |
| **EventBridge (bus)** | — (push) | **1 MB** ⚠️ (janv. 2026) | at-least-once, retries **24 h / 185 tentatives**, DLQ par target | ~1 $/M événements custom |
| **EventBridge Scheduler** | ponctuel ou cron | — | retries + DLQ | ~1 $/M invocations |
| **Step Functions Standard** | **1 an** | **256 KiB** par état | exactly-once par exécution | **25 $/M transitions** (retries compris) |
| **Step Functions Express** | **5 min** | 256 KiB | async : at-least-once · sync : at-most-once | ~1 $/M requêtes + durée × mémoire |
| **ECS Fargate / AWS Batch** | **illimitée** | — (lit S3/SQS) | à toi de gérer (retry Batch, SQS) | à la seconde vCPU + GB (1 min minimum), Spot −70 % |

À retenir aussi :
- **SQS** : visibility timeout de 0 à 12 h (30 s par défaut), règle AWS **≥ 6 × timeout de la Lambda** ; délai max 15 min ; long polling 20 s ; `maxReceiveCount` → DLQ.
- **Lambda ← SQS (event source mapping)** : lot de 10 en FIFO, jusqu'à 10 000 en Standard avec une fenêtre de 5 min max ; **`ReportBatchItemFailures`** sinon tout le lot est rejoué.
- **Step Functions** : historique limité à 25 000 événements par exécution (⇒ boucles longues = *Distributed Map* ou exécution enfant) ; `.sync` (lance un job ECS ou Batch et attend) ; `.waitForTaskToken` (callback humain ou externe, jusqu'à 1 an).
- **Au-delà de 1 MB (256 KiB en Step Functions)** : *claim check* : le payload va dans S3, le message ne porte que la clé.

## 2. Arbre de décision (à dérouler au tableau)

1. **Combien de temps dure le travail ?**
   < 15 min → Lambda possible · > 15 min → ECS/Fargate ou Batch (ou Step Functions qui découpe).
2. **Plusieurs étapes, ordre, attente, compensation, état visible ?**
   Oui → **Step Functions** (orchestration). Non → un consumer suffit.
3. **Absorber un pic / protéger un aval lent (backpressure) ?**
   Oui → **SQS** devant le consumer (buffer + retries + DLQ).
4. **Plusieurs consommateurs indépendants du même fait ?**
   Oui → **EventBridge** (routage par règles, schémas, archive/replay) ou **SNS** (fan-out simple et rapide, souvent SNS → SQS par consommateur).
5. **Déclenchement dans le temps ?**
   → **EventBridge Scheduler** (pas un cron sur une instance, pas un `sleep` dans une Lambda).
6. **Ordre strict par entité ?**
   → SQS FIFO avec `MessageGroupId` = id de l'entité (sinon : transitions monotones, l'ordre n'est pas nécessaire).

> Orchestration (Step Functions) vs chorégraphie (événements) : **orchestration** quand le processus a un propriétaire et doit être observable de bout en bout (clôture, paie) ; **chorégraphie** quand des contextes indépendants réagissent à un fait (envoyer des notifications, mettre à jour une projection).

## 3. Idempotence et échecs (la question qui tombe toujours)

- **Tout est at-least-once** sauf Step Functions Standard par exécution et SQS FIFO dans la fenêtre de 5 min. Donc **tout consumer est idempotent**, garanti **par la base** : `ConditionExpression attribute_not_exists`, clé de dédup, transition d'état conditionnelle (`status = open` → `closed`).
- **Step Functions** : le *nom d'exécution* est unique pendant 90 j ⇒ démarrer avec `name = close-<electionId>` = déduplication gratuite. Mais une **tâche** peut être relancée (retry) ⇒ les Lambdas appelées restent idempotentes.
- **Où vont les échecs** : Lambda async → destination `OnFailure` ou DLQ · SQS → redrive vers DLQ après `maxReceiveCount` · EventBridge → DLQ par target · Step Functions → `Retry` (backoff, `MaxAttempts`) puis `Catch` → état d'échec ou compensation · Toute DLQ a **une alarme** (`ApproximateNumberOfMessagesVisible > 0`) et une procédure de **redrive**.
- **Message poison** : il échoue toujours ⇒ sans DLQ il bloque (FIFO) ou boucle et coûte (Standard). `ReportBatchItemFailures` évite de rejouer les messages sains du lot.

## 4. Notre cas : la clôture de l'élection

**Choix** : EventBridge Scheduler (à `period.end`) → **Step Functions Standard** `close-election` → Lambdas `CloseElection` (transition conditionnelle) → `TallyVotes` (plus fort reste) → `PublishResults` (événement `ElectionResultsPublished` sur le bus).

| Alternative | Pourquoi non ici | Quand elle gagnerait |
|---|---|---|
| **SQS + Lambda** | 3 étapes ordonnées, état et reprise à coder à la main, pas de vue d'ensemble | une seule étape, gros volume, besoin de buffer |
| **Step Functions Express** | 5 min suffisent, mais at-least-once en async et pas d'historique visuel de 90 j | > 100 000 exécutions/j, courtes (coût) |
| **ECS Fargate / Batch** | le dépouillement d'une école prend < 1 s ; démarrage 30–60 s, plus d'opérations | dépouillement national > 15 min, gros calcul (lancé via `.sync` depuis la même machine à états) |
| **Chorégraphie pure** (`ElectionClosed` → consumers) | personne ne « possède » la clôture, échec partiel invisible | réactions indépendantes après les résultats (notifications) |

**Coût** : ~5 transitions par élection → 1 000 élections ≈ 5 000 transitions ≈ **0,13 $**. Le coût n'est pas un argument ici ; il le devient à des millions d'exécutions/jour (⇒ Express).

## 5. Pitch 2 minutes (anglais)

> *"Closing an election is a short, multi-step process with a clear owner: close, tally, publish. I use EventBridge Scheduler to fire at the end of the voting period and start a **Standard** Step Functions workflow named after the election id, which deduplicates starts for free. Each step is a Lambda: well under the 15-minute limit, and the payload is just identifiers, far below the 256 KB state limit. Retries with backoff live in the state machine; a Catch sends failures to an alarm. Every Lambda is still idempotent because tasks can be retried: closing is a conditional update on status, and results are written with a conditional put.*
> *Alternatives: SQS plus Lambda would buffer well but I would rebuild sequencing and state by hand. Express workflows are cheaper at very high volume but capped at 5 minutes and at-least-once. If tallying ever exceeded 15 minutes, I would keep the workflow and run that step on Fargate with the `.sync` integration. Cost is negligible: about five transitions per election, so 25 dollars per million transitions doesn't matter at our scale."*

## 6. Questions de mock (avec la réponse attendue en une ligne)

1. *Lambda times out at 15 min on a nightly export. Now what?* → Découper (Distributed Map) ou Fargate/Batch piloté par Step Functions `.sync` ; checkpoint dans S3/DynamoDB.
2. *Your SQS consumer processes some messages twice. Why, and fix?* → at-least-once + visibility timeout < durée de traitement ; visibility ≥ 6× timeout, idempotence par écriture conditionnelle.
3. *A 3 MB payload must go through SQS.* → claim check S3 (limite 1 MiB) ; message = clé S3 + checksum.
4. *SNS or EventBridge for fan-out?* → SNS : simple, très faible latence, très haut débit ; EventBridge : règles de contenu, plusieurs comptes, schémas, archive/replay, 1 MB.
5. *Step Functions bill exploded.* → Standard facture chaque transition, y compris dans les boucles et les retries ⇒ Express pour le court et volumineux, ou boucles sorties en Distributed Map / batch.
6. *How do you guarantee one payroll run per month?* → exécution Step Functions nommée `payroll-<company>-<yyyy-mm>` + écriture conditionnelle de l'état du run ; webhooks et paiements avec clé d'idempotence.

## Sources
- [SQS : messages jusqu'à 1 MiB (août 2025)](https://aws.amazon.com/about-aws/whats-new/2025/08/amazon-sqs-max-payload-size-1mib) · [quotas SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages)
- [Lambda async : 1 MB (oct. 2025)](https://aws.amazon.com/about-aws/whats-new/2025/10/aws-lambda-payload-size-256-kb-1-mb-invocations)
- [EventBridge : 1 MB (janv. 2026)](https://aws.amazon.com/about-aws/whats-new/2026/01/amazon-eventbridge-increases-event-payload-size-256-kb-1-mb)
- [Serverless : payloads jusqu'à 1 MB (AWS Compute Blog)](https://aws.amazon.com/blogs/compute/more-room-to-build-serverless-services-now-support-payloads-up-to-1-mb)
- [Quotas Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/limits.html) · [Tarifs Step Functions](https://aws.amazon.com/step-functions/pricing/)
